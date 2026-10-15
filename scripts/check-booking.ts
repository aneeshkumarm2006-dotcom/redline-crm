import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
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
import { replaceAppointmentsForSeed, getBookingPage, book, getAvailableSlots, BookingError } from "../src/modules/appointments/service";
import { initializeEmailTemplates } from "../src/modules/email-templates/service";
import { registerAutomation } from "../src/lib/automation";
import { ConsoleProvider, type EmailMessage } from "../src/lib/email/provider";
import { bookingCopy } from "../src/modules/appointments/copy";

async function main() {
  const { values } = parseArgs({ options: { "mongo-binary": { type: "string" } } });
  if (!values["mongo-binary"]) throw new Error("Pass --mongo-binary with a local mongod executable.");
  const output = path.resolve(".booking-check", new Date().toISOString().replace(/[:.]/g, "-"));
  await mkdir(path.join(output, "db"), { recursive: true });
  const listener = createServer().listen(0, "127.0.0.1");
  await once(listener, "listening");
  const address = listener.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>((resolve) => listener.close(() => resolve()));
  const uri = `mongodb://127.0.0.1:${port}/booking_check`;
  Object.assign(process.env, { MONGODB_URI: uri, EMAIL_PROVIDER: "console", RESEND_API_KEY: "", APP_URL: "https://crm.example.test" });
  const mongo = spawn(values["mongo-binary"], ["--bind_ip", "127.0.0.1", "--port", String(port), "--dbpath", path.join(output, "db"), "--quiet"], { windowsHide: true, stdio: "ignore" });
  const exited = once(mongo, "exit");
  const emails: EmailMessage[] = [];
  let failEmail = false;
  const send = ConsoleProvider.prototype.send;
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
    await replaceAppointmentsForSeed([]);
    await initializeEmailTemplates(demoEmailTemplates);
    unregister = registerAutomation();
    async function settings(patch: Record<string, unknown>) {
      await db.collection("settings").updateOne({ _id: "singleton" } as never, { $set: patch });
      invalidateSettingsCache();
    }
    const jeep = data.vehicles.find((vehicle) => vehicle.stockNo === "CLA-001")!;
    const customer = (email = `customer-${randomUUID()}@example.test`) => ({ inquiryId: randomUUID(), vehicleId: jeep.id, name: "Jordan <Demo>", email, phone: "416-555-0101", message: "" });
    const newLead = async (email?: string) => getLeadForAutomation((await create(customer(email))).leadId);
    const firstSlot = async (salespersonId: string) => (await getAvailableSlots(salespersonId))[0].slots[0];

    const lead = await newLead("jordan@example.test");
    const page = await getBookingPage(lead.bookingToken);
    assert.equal(page.state, "open");
    if (page.state !== "open") throw new Error("unreachable");
    assert.ok(page.days.length > 0 && page.days[0].slots.length > 0);
    assert.equal(page.customerName, "Jordan");
    const serialized = JSON.stringify(page);
    for (const secret of [lead.bookingToken, lead.email, lead.id, lead.assignedTo!]) assert.ok(!serialized.includes(secret));
    checks.push("Booking page lists future slots for the assigned salesperson without exposing token, IDs or contact details");

    const slot = page.days[0].slots[0];
    const before = emails.length;
    const result = await book({ token: lead.bookingToken, startsAt: slot.startsAt });
    assert.equal(result.when, slot.when);
    const appointments = await db.collection("appointments").find({ leadId: new mongoose.Types.ObjectId(lead.id) }).toArray();
    assert.equal(appointments.length, 1);
    assert.equal(appointments[0].salespersonId.toString(), lead.assignedTo);
    assert.equal(appointments[0].dealershipId.toString(), jeep.dealershipId);
    assert.equal(appointments[0].status, "booked");
    assert.equal(appointments[0].startsAt.toISOString(), slot.startsAt);
    const booked = await getLeadForAutomation(lead.id);
    assert.equal(booked.stage, "appointment");
    assert.deepEqual(booked.activity.map((entry) => entry.type), ["lead.created", "lead.assigned", "lead.stage_changed", "appointment.booked"]);
    assert.equal(booked.activity[2].message, "Stage changed from New to Appointment.");
    const sent = emails.slice(before);
    const salesperson = data.users.find((user) => user.id === lead.assignedTo)!;
    assert.deepEqual(sent.map((email) => email.to[0]).sort(), [lead.email, salesperson.email].sort());
    const confirmation = sent.find((email) => email.to[0] === lead.email)!;
    assert.match(confirmation.subject, /Your appointment/);
    assert.ok(confirmation.html.includes(slot.when));
    // Formatted times end in "a.m."/"p.m.": no message may add a second full stop.
    for (const text of [...sent.map((email) => email.html), ...booked.activity.map((entry) => entry.message)]) assert.ok(!text.includes("m.."), text);
    const alert = await db.collection("notifications").findOne({ userId: new mongoose.Types.ObjectId(salesperson.id), event: "appointment.booked" });
    assert.ok(!alert!.message.includes(".."));
    assert.ok(confirmation.html.includes(salesperson.name));
    assert.ok(!confirmation.html.includes(lead.bookingToken));
    assert.match(sent.find((email) => email.to[0] === salesperson.email)!.subject, /Appointment/);
    assert.equal(await db.collection("notifications").countDocuments({ userId: new mongoose.Types.ObjectId(salesperson.id), event: "appointment.booked" }), 1);
    assert.ok(!(await getAvailableSlots(salesperson.id)).flatMap((day) => day.slots).some((entry) => entry.startsAt === slot.startsAt));
    checks.push("Booking creates the appointment, moves the lead to the configured stage, logs activity, emails customer + salesperson, alerts the salesperson and removes the slot");

    const replayEmails = emails.length;
    assert.equal((await book({ token: lead.bookingToken, startsAt: slot.startsAt })).when, slot.when);
    assert.equal(emails.length, replayEmails);
    await assert.rejects(book({ token: lead.bookingToken, startsAt: page.days[0].slots[1].startsAt }), (error) => error instanceof BookingError && error.message === bookingCopy.alreadyBooked);
    const used = await getBookingPage(lead.bookingToken);
    assert.equal(used.state, "booked");
    if (used.state === "booked") { assert.equal(used.when, slot.when); assert.equal(used.salespersonName, salesperson.name); }
    checks.push("A repeated request is an inert replay; a second time is refused; a used link shows the existing appointment");

    for (const token of ["", "nope", randomBytes(32).toString("base64url"), "../../crm"]) {
      assert.equal((await getBookingPage(token)).state, "invalid");
      await assert.rejects(book({ token, startsAt: slot.startsAt }), (error) => error instanceof BookingError && error.message === bookingCopy.invalidTitle);
    }
    checks.push("Malformed, unknown and path-like tokens show the invalid state and cannot book");

    const sameSalesperson = [];
    while (sameSalesperson.length < 2) {
      const candidate = await newLead();
      if (candidate.assignedTo === lead.assignedTo) sameSalesperson.push(candidate);
    }
    const contested = await firstSlot(lead.assignedTo!);
    const race = await Promise.allSettled(sameSalesperson.map((entry) => book({ token: entry.bookingToken, startsAt: contested.startsAt })));
    assert.equal(race.filter((entry) => entry.status === "fulfilled").length, 1);
    const loser = race.find((entry) => entry.status === "rejected") as PromiseRejectedResult;
    assert.ok(loser.reason instanceof BookingError && loser.reason.message === bookingCopy.taken);
    assert.equal(await db.collection("appointments").countDocuments({ salespersonId: new mongoose.Types.ObjectId(lead.assignedTo!), startsAt: new Date(contested.startsAt), status: "booked" }), 1);
    const greedy = await newLead();
    const options = (await getAvailableSlots(greedy.assignedTo!))[0].slots.slice(0, 5);
    const burst = await Promise.allSettled(options.map((option) => book({ token: greedy.bookingToken, startsAt: option.startsAt })));
    assert.equal(burst.filter((entry) => entry.status === "fulfilled").length, 1);
    assert.equal(await db.collection("appointments").countDocuments({ leadId: new mongoose.Types.ObjectId(greedy.id), status: "booked" }), 1);
    checks.push("Concurrent bookings: two customers racing for one salesperson slot get exactly one appointment; one lead racing five slots books once");

    const offGrid = new Date(Date.parse(contested.startsAt) + 7 * 60_000).toISOString();
    const fresh = await newLead();
    await assert.rejects(book({ token: fresh.bookingToken, startsAt: offGrid }), (error) => error instanceof BookingError && error.message === bookingCopy.taken);
    await assert.rejects(book({ token: fresh.bookingToken, startsAt: "2020-01-06T14:00:00.000Z" }), (error) => error instanceof BookingError && error.message === bookingCopy.taken);
    checks.push("Off-grid and past times are rejected");

    await db.collection("leads").updateOne({ _id: new mongoose.Types.ObjectId(fresh.id) }, { $set: { stage: "won" } });
    await book({ token: fresh.bookingToken, startsAt: (await firstSlot(fresh.assignedTo!)).startsAt });
    assert.equal((await getLeadForAutomation(fresh.id)).stage, "won");
    await db.collection("appointments").updateOne({ leadId: new mongoose.Types.ObjectId(fresh.id) }, { $set: { status: "cancelled" } });
    assert.equal((await getBookingPage(fresh.bookingToken)).state, "open");
    await book({ token: fresh.bookingToken, startsAt: (await firstSlot(fresh.assignedTo!)).startsAt });
    checks.push("Booking never moves a lead backward; a cancelled appointment frees the link for rebooking");

    await settings({ leadAssignmentStrategy: "manual" });
    const unassigned = await newLead();
    assert.equal(unassigned.assignedTo, null);
    const unavailable = await getBookingPage(unassigned.bookingToken);
    assert.equal(unavailable.state, "unavailable");
    await assert.rejects(book({ token: unassigned.bookingToken, startsAt: slot.startsAt }), (error) => error instanceof BookingError && error.message === bookingCopy.unavailableBody);
    await settings({ leadAssignmentStrategy: "round_robin" });
    const departed = await newLead();
    await db.collection("users").updateOne({ _id: new mongoose.Types.ObjectId(departed.assignedTo!) }, { $set: { active: false } });
    assert.equal((await getBookingPage(departed.bookingToken)).state, "unavailable");
    await db.collection("users").updateOne({ _id: new mongoose.Types.ObjectId(departed.assignedTo!) }, { $set: { active: true } });
    checks.push("Unassigned leads and inactive salespeople show the call-the-dealership state and cannot book");

    await settings({ "booking.appointmentStageKey": "contacted" });
    const custom = await newLead();
    await book({ token: custom.bookingToken, startsAt: (await firstSlot(custom.assignedTo!)).startsAt });
    assert.equal((await getLeadForAutomation(custom.id)).stage, "contacted");
    await settings({ "booking.appointmentStageKey": "missing_stage" });
    const unknownStage = await newLead();
    await book({ token: unknownStage.bookingToken, startsAt: (await firstSlot(unknownStage.assignedTo!)).startsAt });
    assert.equal((await getLeadForAutomation(unknownStage.id)).stage, "new");
    await settings({ "booking.appointmentStageKey": "appointment" });
    checks.push("The booking stage comes from settings; an unknown key books without changing the stage");

    failEmail = true;
    const outage = await newLead();
    const outageSlot = await firstSlot(outage.assignedTo!);
    assert.equal((await book({ token: outage.bookingToken, startsAt: outageSlot.startsAt })).when.length > 0, true);
    failEmail = false;
    assert.equal(await db.collection("appointments").countDocuments({ leadId: new mongoose.Types.ObjectId(outage.id), status: "booked" }), 1);
    assert.equal(await db.collection("notifications").countDocuments({ userId: new mongoose.Types.ObjectId(outage.assignedTo!), event: "appointment.booked" }) > 0, true);
    assert.ok(!JSON.stringify(failures).includes(outage.email));
    checks.push("An email outage still books, alerts the salesperson in-app and logs no customer data");

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
