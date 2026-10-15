import assert from "node:assert/strict";
import { test } from "node:test";
import { emailUrl } from "../src/lib/email/url";
import { getEmailProvider, ConsoleProvider } from "../src/lib/email/provider";
import { settingsSchema } from "../src/modules/settings/schema";
import { demoSettings } from "../scripts/seed/settings";
import { vehicleFormSchema } from "../src/modules/inventory/schema";
import { buildDemoData, demoStaff } from "../scripts/seed/data";
import { createEventBus } from "../src/lib/events";

test("email URLs require a trusted HTTP(S) origin and reject credentials and unsafe paths", (t) => {
  const prior = process.env.APP_URL;
  t.after(() => { if (prior === undefined) delete process.env.APP_URL; else process.env.APP_URL = prior; });
  for (const url of ["", "javascript:alert(1)", "https://user:password@example.com", "https://example.com/path", "https://example.com/?q=a", "https://example.com/#hash"]) {
    process.env.APP_URL = url; assert.throws(() => emailUrl("/book/token"));
  }
  process.env.APP_URL = "https://example.com";
  assert.equal(emailUrl("/book/token"), "https://example.com/book/token");
  for (const path of ["//evil.com", "https://evil.com"]) assert.throws(() => emailUrl(path));
});

test("explicit console delivery works in production; invalid provider modes fail closed", (t) => {
  const prior = process.env.EMAIL_PROVIDER;
  const priorNode = process.env.NODE_ENV;
  t.after(() => {
    if (prior === undefined) delete process.env.EMAIL_PROVIDER; else process.env.EMAIL_PROVIDER = prior;
    if (priorNode === undefined) Reflect.deleteProperty(process.env, "NODE_ENV"); else Object.assign(process.env, { NODE_ENV: priorNode });
  });
  Object.assign(process.env, { NODE_ENV: "production" });
  process.env.EMAIL_PROVIDER = "console"; assert.ok(getEmailProvider() instanceof ConsoleProvider);
  process.env.EMAIL_PROVIDER = "typo"; assert.throws(getEmailProvider, /Invalid/);
});

test("existing settings default to an unset sender and reject malformed sender addresses", () => {
  const { emailFrom, ...legacy } = demoSettings; void emailFrom;
  assert.equal(settingsSchema.parse(legacy).emailFrom, null);
  assert.equal(settingsSchema.safeParse({ ...legacy, emailFrom: "bad\r\nBcc: other@example.com" }).success, false);
});

test("vehicle forms cannot accept forged activity", () => {
  const data = buildDemoData(Object.fromEntries(demoStaff.map((user) => [user.email, "$2b$12$" + "a".repeat(53)])));
  const { id, priceHistory, statusHistory, activity, ...fields } = data.vehicles[0];
  void id; void priceHistory; void statusHistory; void activity;
  assert.equal(vehicleFormSchema.safeParse(fields).success, true);
  assert.equal(vehicleFormSchema.safeParse({ ...fields, activity: [] }).success, false);
});

test("re-registering the same handler survives the earlier registration's unsubscribe", async () => {
  const bus = createEventBus();
  let calls = 0;
  const handler = () => { calls++; };
  const old = bus.on("lead.created", "leads:assign", handler);
  bus.on("lead.created", "leads:assign", handler);
  old();
  await bus.emit("lead.created", { leadId: "a", vehicleId: "b", dealershipId: "c" });
  assert.equal(calls, 1);
});
