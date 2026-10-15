import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test, type TestContext } from "node:test";
import mongoose from "mongoose";
import { buildDemoData, demoStaff } from "../scripts/seed/data";
import { VehicleModel } from "../src/modules/inventory/model";
import { DealershipModel } from "../src/modules/dealerships/model";
import { LeadModel } from "../src/modules/leads/model";
import { SettingsModel } from "../src/modules/settings/model";
import { invalidateSettingsCache } from "../src/modules/settings/service";
import { getPublicVehicle, listPublicVehicles } from "../src/modules/inventory/service";
import { create } from "../src/modules/leads/service";
import { submitInquiry } from "../src/modules/leads/actions";
import { inquirySchema } from "../src/modules/leads/schema";
import { on } from "../src/lib/events";

const chain = (value: unknown) => { const query = { select: () => query, sort: () => query, skip: () => query, limit: () => query, lean: () => query, exec: async () => value }; return query; };
function setup(t: TestContext) {
  const previous = process.env.MONGODB_URI;
  process.env.MONGODB_URI = "mongodb://example.invalid/public_test";
  t.after(() => { invalidateSettingsCache(); if (previous === undefined) delete process.env.MONGODB_URI; else process.env.MONGODB_URI = previous; });
  t.mock.method(mongoose, "connect", async () => mongoose);
  const data = buildDemoData(Object.fromEntries(demoStaff.map((user) => [user.email, "$2b$12$" + "a".repeat(53)])));
  t.mock.method(SettingsModel, "findById", () => chain(data.settings));
  invalidateSettingsCache();
  const locations = t.mock.method(DealershipModel, "find", () => chain(data.dealerships.map((entry) => ({ ...entry, _id: entry.id }))));
  const vehicle = { ...data.vehicles[0], _id: data.vehicles[0].id };
  const lookup = t.mock.method(VehicleModel, "findOne", () => chain(vehicle));
  t.mock.method(VehicleModel, "countDocuments", () => chain(1));
  const list = t.mock.method(VehicleModel, "find", () => chain([vehicle]));
  const records: Record<string, unknown>[] = [];
  t.mock.method(LeadModel, "init", async () => LeadModel);
  t.mock.method(LeadModel, "findOne", (filter: { inquiryId: string }) => chain(records.find((entry) => entry.inquiryId === filter.inquiryId) ?? null));
  const writes = t.mock.method(LeadModel, "create", async (record: Record<string, unknown>) => {
    if (records.some((entry) => entry.inquiryId === record.inquiryId)) throw Object.assign(new Error("duplicate"), { code: 11000 });
    const result = { ...record, _id: new mongoose.Types.ObjectId() };
    records.push(result); return result;
  });
  const input = { name: " Demo Customer ", email: "CUSTOMER@example.com", phone: "416-555-0101", message: "Is this Jeep available?", vehicleId: vehicle.id, inquiryId: randomUUID() };
  return { data, vehicle, locations, lookup, list, writes, input, records };
}

test("public inventory uses configured statuses and active dealerships, returning only public fields", async (t) => {
  const state = setup(t);
  state.data.settings.publicInventoryStatusKeys = ["custom", "retired"];
  state.data.settings.vehicleStatuses.push({ key: "custom", label: "Ready", color: "#123456" });
  const result = await listPublicVehicles({ dealershipId: state.vehicle.dealershipId, page: 100 });
  assert.equal(result.page, 1);
  assert.deepEqual(state.locations.mock.calls[0].arguments[0], { active: true });
  assert.deepEqual(state.list.mock.calls[0].arguments[0], { status: { $in: ["custom"] }, dealershipId: { $in: [state.vehicle.dealershipId] } });
  for (const field of ["priceHistory", "statusHistory", "__v", "dateInStock"]) assert.equal(field in result.vehicles[0], false);
  assert.equal(result.vehicles[0].stockNo, "CLA-001");
});

test("public detail restricts direct links and invalid IDs never reach the database", async (t) => {
  const state = setup(t);
  assert.equal(await getPublicVehicle("bad"), null);
  assert.equal(state.lookup.mock.callCount(), 0);
  await getPublicVehicle(state.vehicle.id);
  assert.deepEqual(state.lookup.mock.calls[0].arguments[0], { _id: state.vehicle.id, status: { $in: ["available"] }, dealershipId: { $in: state.data.dealerships.map((entry) => entry.id) } });
  state.lookup.mock.mockImplementation(() => chain(null));
  assert.equal(await getPublicVehicle(state.vehicle.id), null);
});

test("inquiry derives references and initial stage, creates a secret token and emits only after persistence", async (t) => {
  const state = setup(t);
  state.data.settings.leadStages[0].key = "fresh";
  const events: unknown[] = [];
  t.after(on("lead.created", "public-test", (event) => { assert.equal(state.records.length, 1); events.push(event.payload); }));
  const result = await create(state.input);
  const saved = state.records[0];
  assert.equal(saved.dealershipId, state.vehicle.dealershipId);
  assert.equal(saved.stage, "fresh"); assert.equal(saved.source, "public_inventory"); assert.equal(saved.assignedTo, null);
  assert.equal(saved.name, "Demo Customer"); assert.equal(saved.email, "customer@example.com");
  assert.match(String(saved.bookingToken), /^[A-Za-z0-9_-]{43}$/);
  assert.equal((saved.activity as { type: string }[])[0].type, "lead.created");
  assert.deepEqual(events, [{ leadId: result.leadId, vehicleId: state.vehicle.id, dealershipId: state.vehicle.dealershipId }]);
  assert.deepEqual(Object.keys(result), ["leadId"]);
});

test("inquiry rejects invalid input and forged internal fields before any write", async (t) => {
  const state = setup(t);
  for (const patch of [{ name: " " }, { email: "bad" }, { phone: "12" }, { message: "x".repeat(4001) }, { vehicleId: { $ne: null } }, { dealershipId: state.vehicle.dealershipId }, { assignedTo: state.data.users[0].id }, { stage: "won" }, { source: "staff" }]) {
    await assert.rejects(create({ ...state.input, ...patch }));
  }
  assert.equal(state.writes.mock.callCount(), 0);
  assert.equal(inquirySchema.safeParse({ ...state.input, message: "" }).success, true);
});

test("a vehicle removed from public availability rejects a stale form", async (t) => {
  const state = setup(t);
  state.lookup.mock.mockImplementation(() => chain(null));
  await assert.rejects(create(state.input), /no longer available/);
  assert.equal(state.writes.mock.callCount(), 0);
});

test("retries and concurrent submissions create one lead and emit once", async (t) => {
  const state = setup(t);
  let events = 0;
  t.after(on("lead.created", "retry-test", () => { events++; }));
  const results = await Promise.all([create(state.input), create(state.input)]);
  assert.equal(results[0].leadId, results[1].leadId);
  assert.equal(state.records.length, 1); assert.equal(events, 1);
  state.lookup.mock.mockImplementation(() => chain(null));
  assert.equal((await create(state.input)).leadId, results[0].leadId);
  await assert.rejects(create({ ...state.input, message: "changed" }), /reload/);
});

test("post-save handler failure still acknowledges the inquiry and does not expose customer data", async (t) => {
  const state = setup(t);
  t.after(on("lead.created", "failed-test", () => { throw new Error("provider failure"); }));
  const log = t.mock.method(console, "error", () => {});
  assert.deepEqual(await submitInquiry(state.input), { ok: true });
  assert.equal(state.records.length, 1);
  assert.equal(JSON.stringify(log.mock.calls).includes("customer@example.com"), false);
});

test("action returns field errors and redacts unexpected database errors", async (t) => {
  const state = setup(t);
  const invalid = await submitInquiry({ ...state.input, email: "bad" });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.ok(invalid.fields?.email);
  state.writes.mock.mockImplementation(async () => { throw new Error("private database details"); });
  assert.deepEqual(await submitInquiry(state.input), { ok: false, message: "Unable to send your inquiry. Please try again." });
});
