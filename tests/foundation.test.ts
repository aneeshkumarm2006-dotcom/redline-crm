import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import mongoose from "mongoose";
import { connectDb } from "../src/lib/db";
import { createEventBus } from "../src/lib/events";
import { ConsoleProvider, getEmailProvider, ResendProvider } from "../src/lib/email/provider";
import { renderEmailTemplate, renderTemplate } from "../src/lib/email/template";
import { settingsSchema } from "../src/modules/settings/schema";
import { SettingsModel } from "../src/modules/settings/model";
import { getSettings, initializeSettings, invalidateSettingsCache } from "../src/modules/settings/service";
import { demoSettings } from "../scripts/seed/settings";

function environment(t: TestContext, values: Record<string, string>) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test("events await delivery, replace keyed handlers, and unsubscribe safely", async () => {
  const bus = createEventBus();
  const logs: string[] = [];
  const provider = new ConsoleProvider((message) => logs.push(message));
  const old = bus.on("lead.created", "mail", () => { throw new Error("stale handler"); });
  const unsubscribe = bus.on("lead.created", "mail", async (event) => {
    await provider.send({ from: "demo@example.com", to: ["test@example.com"],
      ...renderEmailTemplate({ subject: "Lead {{id}}", body: "<p>{{id}}</p>" }, { id: event.payload.leadId }) });
  });
  old();
  const payload = { leadId: "lead-1", vehicleId: "vehicle-1", dealershipId: "dealer-1" };
  const event = await bus.emit("lead.created", payload);
  assert.equal(event.name, "lead.created");
  assert.ok(event.id);
  assert.ok(!Number.isNaN(Date.parse(event.occurredAt)));
  assert.equal(logs.length, 1);
  assert.match(logs[0], /Lead lead-1/);
  unsubscribe();
  await bus.emit("lead.created", payload);
  assert.equal(logs.length, 1);
});

test("failed handlers do not skip others and emission reports errors", async () => {
  const bus = createEventBus();
  let ran = false;
  bus.on("lead.created", "failure", () => { throw new Error("failure"); });
  bus.on("lead.created", "success", async () => { ran = true; });
  await assert.rejects(bus.emit("lead.created", { leadId: "1", vehicleId: "2", dealershipId: "3" }), AggregateError);
  assert.ok(ran);
});

test("templates escape customer HTML, require own values, and reject subject injection", () => {
  assert.equal(renderTemplate("{{ name }}", { name: '<img src="x">&\'' }), "&lt;img src=&quot;x&quot;&gt;&amp;&#39;");
  assert.throws(() => renderTemplate("{{missing}}", {}), /Missing/);
  assert.throws(() => renderTemplate("{{constructor}}", {}), /Missing/);
  assert.throws(() => renderEmailTemplate({ subject: "{{name}}", body: "ok" }, { name: "hi\r\nBcc: x" }), /single line/);
  assert.equal(renderTemplate("{{a}}", { a: "{{b}}", b: "unexpected" }), "{{b}}");
});

test("provider selection never silently drops production mail", (t) => {
  environment(t, { NODE_ENV: "development", RESEND_API_KEY: "" });
  assert.ok(getEmailProvider() instanceof ConsoleProvider);
  Object.assign(process.env, { NODE_ENV: "production", RESEND_API_KEY: "" });
  assert.throws(getEmailProvider, /RESEND_API_KEY/);
  process.env.RESEND_API_KEY = "test-key";
  assert.ok(getEmailProvider() instanceof ResendProvider);
});

test("settings reject duplicate keys, malformed hours, missing weekdays and unknown events", () => {
  assert.ok(settingsSchema.safeParse(demoSettings).success);
  const duplicate = structuredClone(demoSettings);
  duplicate.vehicleStatuses.push(duplicate.vehicleStatuses[0]);
  assert.equal(settingsSchema.safeParse(duplicate).success, false);
  const hours = structuredClone(demoSettings);
  hours.booking.businessHours.monday = { opensAt: "18:00", closesAt: "09:00" };
  assert.equal(settingsSchema.safeParse(hours).success, false);
  assert.equal(settingsSchema.safeParse({ ...demoSettings, booking: { ...demoSettings.booking, businessHours: {} } }).success, false);
  assert.equal(settingsSchema.safeParse({ ...demoSettings, notificationRules: [{ event: "unknown", recipients: ["owners"], channels: ["email"] }] }).success, false);
});

test("connection attempts coalesce, redact failures, and retry", async (t) => {
  environment(t, { MONGODB_URI: "mongodb://example.invalid/redline" });
  let calls = 0;
  const connect = t.mock.method(mongoose, "connect", async () => {
    calls++;
    await Promise.resolve();
    if (calls === 1) throw new Error("secret connection details");
    return mongoose;
  });
  const results = await Promise.allSettled([connectDb(), connectDb()]);
  assert.equal(connect.mock.callCount(), 1);
  for (const result of results) {
    assert.equal(result.status, "rejected");
    if (result.status === "rejected") assert.doesNotMatch(String(result.reason), /secret/);
  }
  assert.equal(await connectDb(), mongoose);
  assert.equal(connect.mock.callCount(), 2);
});

test("settings coalesce reads, isolate returned values, invalidate, and retry missing settings", async (t) => {
  environment(t, { MONGODB_URI: "mongodb://example.invalid/redline" });
  t.mock.method(mongoose, "connect", async () => mongoose);
  let document: object | null = { _id: "singleton", ...demoSettings };
  const find = t.mock.method(SettingsModel, "findById", () => ({ lean: () => ({ exec: async () => structuredClone(document) }) }));
  invalidateSettingsCache();
  const [first, second] = await Promise.all([getSettings(), getSettings()]);
  assert.equal(find.mock.callCount(), 1);
  first.brand.companyName = "changed";
  assert.equal(second.brand.companyName, demoSettings.brand.companyName);
  assert.equal((await getSettings()).brand.companyName, demoSettings.brand.companyName);
  assert.equal(find.mock.callCount(), 1);
  invalidateSettingsCache();
  document = null;
  await assert.rejects(getSettings(), /seed:settings/);
  document = { _id: "singleton", ...demoSettings };
  await getSettings();
  assert.equal(find.mock.callCount(), 3);
  invalidateSettingsCache();
});

test("bootstrap validates before database access and only inserts missing settings", async (t) => {
  environment(t, { MONGODB_URI: "mongodb://example.invalid/redline" });
  t.mock.method(mongoose, "connect", async () => mongoose);
  const existing = { ...demoSettings, brand: { ...demoSettings.brand, companyName: "Existing dealership" } };
  t.mock.method(SettingsModel, "findById", () => ({ lean: () => ({ exec: async () => ({ _id: "singleton", ...existing }) }) }));
  const write = t.mock.method(SettingsModel, "updateOne", () => ({ exec: async () => ({}) }));
  await assert.rejects(initializeSettings({}));
  assert.equal(write.mock.callCount(), 0);
  assert.equal((await initializeSettings(demoSettings)).brand.companyName, "Existing dealership");
  assert.deepEqual(write.mock.calls[0].arguments[0], { _id: "singleton" });
  assert.deepEqual(write.mock.calls[0].arguments[1], { $setOnInsert: demoSettings });
  invalidateSettingsCache();
});

