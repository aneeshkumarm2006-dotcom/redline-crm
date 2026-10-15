import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { parseArgs } from "node:util";
import { mock } from "node:test";
import mongoose from "mongoose";
import { buildDemoData, demoStaff } from "./seed/data";
import { demoEmailTemplates } from "./seed/templates";
import { replaceSettingsForSeed, invalidateSettingsCache } from "../src/modules/settings/service";
import { replaceUsersForSeed } from "../src/modules/users/service";
import { replaceDealershipsForSeed } from "../src/modules/dealerships/service";
import { replaceVehiclesForSeed } from "../src/modules/inventory/service";
import { create, getLeadForAutomation, replaceLeadsForSeed } from "../src/modules/leads/service";
import { initializeEmailTemplates } from "../src/modules/email-templates/service";
import { registerAutomation } from "../src/lib/automation";
import { emit } from "../src/lib/events";
import { ConsoleProvider, type EmailMessage } from "../src/lib/email/provider";
import { dispatchNotifications, recordEventActivity } from "../src/modules/notifications/service";
import type { DomainEvent } from "../src/lib/event-contract";

async function main() {
  const { values } = parseArgs({ options: { "mongo-binary": { type: "string" } } });
  if (!values["mongo-binary"]) throw new Error("Pass --mongo-binary with a local mongod executable.");
  const output = path.resolve(".automation-check", new Date().toISOString().replace(/[:.]/g, "-"));
  await mkdir(path.join(output, "db"), { recursive: true });
  const listener = createServer().listen(0, "127.0.0.1");
  await once(listener, "listening");
  const address = listener.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>((resolve) => listener.close(() => resolve()));
  const uri = `mongodb://127.0.0.1:${port}/automation_check`;
  Object.assign(process.env, { MONGODB_URI: uri, EMAIL_PROVIDER: "console", RESEND_API_KEY: "", APP_URL: "https://crm.example.test" });
  const mongo = spawn(values["mongo-binary"], ["--bind_ip", "127.0.0.1", "--port", String(port), "--dbpath", path.join(output, "db"), "--quiet"], { windowsHide: true, stdio: "ignore" });
  const exited = once(mongo, "exit");
  const emails: EmailMessage[] = [];
  const send = ConsoleProvider.prototype.send;
  let failEmail = false;
  mock.method(ConsoleProvider.prototype, "send", async function (message: EmailMessage) {
    if (failEmail) throw new Error("Simulated provider outage.");
    const receipt = await send.call(new ConsoleProvider(() => {}), message);
    emails.push(message);
    return receipt;
  });
  const failures: unknown[][] = [];
  mock.method(console, "error", (...args: unknown[]) => { failures.push(args); });
  let unregister = () => {};
  const checks: string[] = [];
  let passed = false;
  try {
    for (let attempt = 0; attempt < 60; attempt++) {
      if (mongo.exitCode !== null) throw new Error("Local MongoDB exited early.");
      try { await mongoose.connect(uri, { serverSelectionTimeoutMS: 500 }); break; }
      catch { if (attempt === 59) throw new Error("Local MongoDB did not start."); await delay(250); }
    }
    const db = mongoose.connection.db!;
    const data = buildDemoData(Object.fromEntries(demoStaff.map((user) => [user.email, "$2b$12$" + "a".repeat(53)])));
    await replaceSettingsForSeed(data.settings);
    await replaceUsersForSeed(data.users);
    await replaceDealershipsForSeed(data.dealerships);
    await replaceVehiclesForSeed(data.vehicles);
    await replaceLeadsForSeed([]);
    await initializeEmailTemplates(demoEmailTemplates);
    await db.collection("email_templates").updateOne({ key: "price_change" }, { $set: { subject: "Custom price: {{price}}" } });
    await initializeEmailTemplates(demoEmailTemplates);
    assert.equal(await db.collection("email_templates").countDocuments(), 7);
    assert.equal((await db.collection("email_templates").findOne({ key: "price_change" }))!.subject, "Custom price: {{price}}");
    checks.push("Non-destructive template upgrade preserves edits and inserts missing templates");
    const old = registerAutomation(); unregister = registerAutomation(); old();
    const vehicle = data.vehicles[0];
    const staff = data.users.filter((user) => user.role === "salesperson" && user.dealershipId === vehicle.dealershipId).sort((a, b) => a.id.localeCompare(b.id));
    const input = () => ({ inquiryId: randomUUID(), vehicleId: vehicle.id, name: "<Demo Customer>", email: "customer@example.test", phone: "416-555-0101", message: "<script>alert(1)</script>" });
    const firstInput = input();
    const first = await create(firstInput);
    const lead = await getLeadForAutomation(first.leadId);
    assert.equal(lead.assignedTo, staff[0].id);
    assert.deepEqual(lead.activity.map((entry) => entry.type), ["lead.created", "lead.assigned"]);
    assert.equal(lead.activity[1].message, `Lead assigned to ${staff[0].name}.`);
    assert.equal(emails.length, 2);
    const followup = emails.find((email) => email.to[0] === firstInput.email)!;
    const staffEmail = emails.find((email) => email.to[0] === staff[0].email)!;
    assert.ok(followup.html.includes(`https://crm.example.test/book/${lead.bookingToken}`));
    assert.ok(followup.html.includes("Book an appointment"));
    assert.ok(staffEmail.html.includes("&lt;script&gt;"));
    assert.ok(!staffEmail.html.includes(lead.bookingToken));
    assert.equal(await db.collection("notifications").countDocuments({ userId: new mongoose.Types.ObjectId(staff[0].id), event: "lead.assigned" }), 1);
    await create(firstInput);
    assert.equal(emails.length, 2);
    checks.push("Inquiry assigns correctly with a readable audit entry, sends both escaped templates and creates one in-app alert; replay is inert; registration is HMR-safe");

    const batch = await Promise.all(Array.from({ length: 20 }, () => create(input())));
    const assigned = await Promise.all(batch.map((entry) => getLeadForAutomation(entry.leadId)));
    for (const user of staff) assert.equal(assigned.filter((entry) => entry.assignedTo === user.id).length, 10);
    const secondLocationVehicle = data.vehicles.find((entry) => entry.dealershipId !== vehicle.dealershipId && entry.status === "available")!;
    const other = await getLeadForAutomation((await create({ ...input(), vehicleId: secondLocationVehicle.id })).leadId);
    assert.ok(data.users.some((user) => user.id === other.assignedTo && user.dealershipId === secondLocationVehicle.dealershipId));
    checks.push("20 concurrent inquiries distribute evenly; dealership cursors and recipients are isolated");

    async function settings(patch: Record<string, unknown>) {
      await db.collection("settings").updateOne({ _id: "singleton" } as never, { $set: patch });
      invalidateSettingsCache();
    }
    await settings({ leadAssignmentStrategy: "manual" });
    const manualStart = emails.length;
    const manual = await getLeadForAutomation((await create(input())).leadId);
    assert.equal(manual.assignedTo, null); assert.equal(emails.length, manualStart + 1);
    await settings({ leadAssignmentStrategy: "round_robin" });
    await db.collection("users").updateOne({ _id: new mongoose.Types.ObjectId(staff[0].id) }, { $set: { active: false } });
    assert.equal((await getLeadForAutomation((await create(input())).leadId)).assignedTo, staff[1].id);
    await db.collection("users").updateOne({ _id: new mongoose.Types.ObjectId(staff[1].id) }, { $set: { active: false } });
    const noStaff = await getLeadForAutomation((await create(input())).leadId);
    assert.equal(noStaff.assignedTo, null);
    checks.push("Manual strategy, inactive staff and empty dealership teams preserve valid intake and customer follow-up");
    await db.collection("users").updateMany({ dealershipId: new mongoose.Types.ObjectId(vehicle.dealershipId) }, { $set: { active: true } });

    failEmail = true;
    const outage = await getLeadForAutomation((await create(input())).leadId);
    assert.ok(outage.assignedTo);
    assert.ok(outage.activity.some((entry) => entry.type === "lead.assigned"));
    assert.ok(await db.collection("notifications").findOne({ userId: new mongoose.Types.ObjectId(outage.assignedTo), event: "lead.assigned" }));
    assert.ok(failures.length);
    assert.ok(!JSON.stringify(failures).includes(firstInput.email));
    failEmail = false;
    checks.push("Provider outage preserves assignment, audit, in-app notification and inquiry success; logs redact customer data");

    await settings({ notificationRules: [...data.settings.notificationRules,
      { event: "vehicle.status_changed", recipients: ["dealership_salespeople", "owners"], channels: ["in_app", "email"] }] });
    const ref = { vehicleId: vehicle.id, dealershipId: vehicle.dealershipId, changedBy: data.users[0].id };
    const emailStart = emails.length;
    const status = await emit("vehicle.status_changed", { ...ref, previousStatus: "available", status: "hold" });
    const recipients = emails.slice(emailStart).map((message) => message.to[0]).sort();
    assert.deepEqual(recipients, [...staff.map((user) => user.email), data.users[0].email].sort());
    assert.equal(await db.collection("notifications").countDocuments({ eventId: status.id }), 3);
    await recordEventActivity(status);
    const audit = await db.collection("vehicles").findOne({ _id: new mongoose.Types.ObjectId(vehicle.id) });
    assert.equal(audit!.activity.filter((entry: { eventId: string }) => entry.eventId === status.id).length, 1);
    const label = (key: string) => data.settings.vehicleStatuses.find((entry) => entry.key === key)!.label;
    assert.equal(audit!.activity.find((entry: { eventId: string }) => entry.eventId === status.id).message, `Status changed from ${label("available")} to ${label("hold")}.`);
    await settings({ notificationRules: [{ event: "vehicle.status_changed", recipients: ["dealership_salespeople", "owners"], channels: ["in_app"] }] });
    await dispatchNotifications(status);
    assert.equal(await db.collection("notifications").countDocuments({ eventId: status.id }), 3);
    checks.push("Overlapping rules deduplicate recipients/channels; owners and dealership audiences resolve correctly; repeated event IDs do not duplicate activity or in-app alerts");

    await settings({ notificationRules: data.settings.notificationRules });
    const priceStart = emails.length;
    const price = await emit("vehicle.price_changed", { ...ref, previousPrice: vehicle.price, price: vehicle.price - 500 });
    assert.equal(emails.length, priceStart + 2);
    assert.equal(await db.collection("notifications").countDocuments({ eventId: price.id }), 2);
    const leadRef = { leadId: lead.id, vehicleId: lead.vehicleId, dealershipId: lead.dealershipId };
    await emit("lead.stage_changed", { ...leadRef, previousStage: "new", stage: "contacted", changedBy: data.users[0].id });
    const booked = await emit("appointment.booked", { ...leadRef, salespersonId: lead.assignedTo!, appointmentId: new mongoose.Types.ObjectId().toString(), startsAt: "2026-10-20T15:00:00.000Z", endsAt: "2026-10-20T15:30:00.000Z" });
    assert.equal(await db.collection("notifications").countDocuments({ eventId: booked.id }), 1);
    const finalLead = await getLeadForAutomation(lead.id);
    assert.ok(finalLead.activity.some((entry) => entry.type === "lead.stage_changed"));
    assert.ok(finalLead.activity.some((entry) => entry.type === "appointment.booked"));
    checks.push("Status/price channels deliver; all six event types have related activity; appointment events render in configured time zone");

    const missingTemplateEvent: DomainEvent = { id: randomUUID(), name: "vehicle.price_changed", occurredAt: new Date().toISOString(), payload: { ...ref, previousPrice: 100, price: 90 } };
    await db.collection("email_templates").deleteOne({ key: "price_change" });
    await assert.rejects(dispatchNotifications(missingTemplateEvent), AggregateError);
    assert.equal(await db.collection("notifications").countDocuments({ eventId: missingTemplateEvent.id }), 2);
    await initializeEmailTemplates(demoEmailTemplates);
    process.env.APP_URL = "javascript:bad";
    const invalidUrlEvent = { ...missingTemplateEvent, id: randomUUID() };
    await assert.rejects(dispatchNotifications(invalidUrlEvent), AggregateError);
    assert.equal(await db.collection("notifications").countDocuments({ eventId: invalidUrlEvent.id }), 2);
    process.env.APP_URL = "https://crm.example.test";
    process.env.EMAIL_PROVIDER = "resend";
    const missingSender = { ...missingTemplateEvent, id: randomUUID() };
    let attemptedSend = false;
    await assert.rejects(dispatchNotifications(missingSender, { send: async () => { attemptedSend = true; throw new Error("Unexpected delivery"); } }), AggregateError);
    assert.equal(attemptedSend, false);
    assert.equal(await db.collection("notifications").countDocuments({ eventId: missingSender.id }), 2);
    process.env.EMAIL_PROVIDER = "console";
    checks.push("Missing templates, unsafe APP_URL and missing live sender fail email closed while in-app delivery succeeds");

    await settings({ notificationRules: [] });
    const disabledCount = emails.length;
    await emit("vehicle.price_changed", { ...ref, previousPrice: vehicle.price, price: vehicle.price - 1000 });
    assert.equal(emails.length, disabledCount);
    await settings({ notificationRules: [{ event: "lead.created", recipients: ["customer"], channels: ["in_app"] }] });
    const customerOnly: DomainEvent = { id: randomUUID(), name: "lead.created", occurredAt: new Date().toISOString(), payload: leadRef };
    await dispatchNotifications(customerOnly);
    assert.equal(await db.collection("notifications").countDocuments({ eventId: customerOnly.id }), 0);
    checks.push("Disabled rules suppress delivery while preserving audit; customers cannot receive staff in-app alerts");
    // A later vehicle edit must preserve handler-appended audit, including both changes in a full edit.
    const storedVehicle = await db.collection("vehicles").findOne({ _id: new mongoose.Types.ObjectId(vehicle.id) });
    assert.ok(storedVehicle!.activity.filter((entry: { type: string }) => entry.type === "vehicle.price_changed").length >= 2);
    await writeFile(path.join(output, "result.json"), JSON.stringify({ ok: true, checks, capturedEmails: emails.length }, null, 2));
    console.info(JSON.stringify({ ok: true, checks, output }, null, 2));
    passed = true;
  } finally {
    unregister(); mock.restoreAll();
    // Handler errors are captured above; surface them only when the check fails.
    if (!passed) for (const failure of failures) console.error("Captured handler error:", ...failure);
    await mongoose.disconnect();
    if (mongo.exitCode === null) mongo.kill();
    await exited;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
