import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test, type TestContext } from "node:test";
import mongoose from "mongoose";
import { buildDemoData, demoStaff } from "../scripts/seed/data";
import { VehicleModel } from "../src/modules/inventory/model";
import { UserModel } from "../src/modules/users/model";
import { DealershipModel } from "../src/modules/dealerships/model";
import { LeadModel } from "../src/modules/leads/model";
import { SettingsModel } from "../src/modules/settings/model";
import { invalidateSettingsCache } from "../src/modules/settings/service";
import { signSession, SESSION_COOKIE } from "../src/modules/auth/session";
import { AuthorizationError } from "../src/modules/auth/service";
import { changePrice, changeStatus, createVehicle, updateVehicle, getVehicle, listVehicles } from "../src/modules/inventory/service";
import { listVehicleLeads } from "../src/modules/leads/service";
import { vehicleFormSchema } from "../src/modules/inventory/schema";
import { on } from "../src/lib/events";

const require = createRequire(import.meta.url);
const headers = require("next/headers");
const chain = (value: unknown) => { const query = { select: () => query, sort: () => query, skip: () => query, limit: () => query, lean: () => query, exec: async () => value }; return query; };
async function setup(t: TestContext, role: "owner" | "salesperson" | null = "owner") {
  const previous = { AUTH_SECRET: process.env.AUTH_SECRET, MONGODB_URI: process.env.MONGODB_URI };
  process.env.AUTH_SECRET = "inventory-test-only-secret-longer-than-32-bytes";
  process.env.MONGODB_URI = "mongodb://example.invalid/inventory_test";
  t.after(() => { invalidateSettingsCache(); for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  t.mock.method(mongoose, "connect", async () => mongoose);
  const data = buildDemoData(Object.fromEntries(demoStaff.map((user) => [user.email, "$2b$12$" + "a".repeat(53)])));
  const user = data.users.find((entry) => entry.role === (role ?? "owner"))!;
  const token = await signSession(user.id);
  t.mock.method(headers, "cookies", async () => ({ get: (name: string) => role && name === SESSION_COOKIE ? { value: token } : undefined }));
  t.mock.method(UserModel, "findOne", () => chain({ ...user, _id: user.id }));
  t.mock.method(SettingsModel, "findById", () => chain(data.settings));
  invalidateSettingsCache();
  t.mock.method(DealershipModel, "find", () => chain(data.dealerships.map((entry) => ({ ...entry, _id: entry.id }))));
  const { id, ...fields } = data.vehicles[0];
  let document = { ...fields, _id: id, __v: 0 };
  t.mock.method(VehicleModel, "findById", () => chain(document));
  const writes = t.mock.method(VehicleModel, "findOneAndUpdate", (filter: { __v: number }, update: { $set: typeof fields }) => {
    if (filter.__v !== document.__v) return chain(null);
    document = { ...document, ...update.$set, __v: document.__v + 1 };
    return chain(document);
  });
  const form = vehicleFormSchema.parse(Object.fromEntries(Object.keys(vehicleFormSchema.shape).map((key) => [key, fields[key as keyof typeof fields]])));
  return { id, data, user, writes, form, document: () => document };
}

test("inventory guards deny anonymous reads and salesperson mutations", async (t) => {
  await setup(t, null);
  await assert.rejects(listVehicles(), AuthorizationError);
  await assert.rejects(getVehicle("bad"), AuthorizationError);
});
test("salespeople can read inventory but cannot bypass owner-only writes", async (t) => {
  const state = await setup(t, "salesperson");
  assert.equal((await getVehicle(state.id))?.id, state.id);
  for (const operation of [() => createVehicle(state.form), () => updateVehicle({}), () => changeStatus({}), () => changePrice({})]) await assert.rejects(operation, AuthorizationError);
  assert.equal(state.writes.mock.callCount(), 0);
});
test("status and price changes persist actor histories, emit after persistence, and skip no-ops", async (t) => {
  const state = await setup(t);
  const statusEvents: unknown[] = [], priceEvents: unknown[] = [];
  t.after(on("vehicle.status_changed", "inventory-test", (event) => { assert.equal(state.document().status, event.payload.status); statusEvents.push(event.payload); }));
  t.after(on("vehicle.price_changed", "inventory-test", (event) => { priceEvents.push(event.payload); }));
  const first = await changeStatus({ id: state.id, revision: 0, status: "hold" });
  assert.equal(first.vehicle.statusHistory.at(-1)?.changedBy, state.user.id);
  assert.equal(first.vehicle.statusHistory.at(-1)?.previousStatus, "available");
  await changeStatus({ id: state.id, revision: 1, status: "hold" });
  assert.equal(state.writes.mock.callCount(), 1);
  const second = await changePrice({ id: state.id, revision: 1, price: 31999.95 });
  assert.equal(second.vehicle.priceHistory.at(-1)?.previousPrice, state.form.price);
  assert.equal(second.vehicle.priceHistory.at(-1)?.changedBy, state.user.id);
  assert.equal(statusEvents.length, 1); assert.equal(priceEvents.length, 1);
  await assert.rejects(changePrice({ id: state.id, revision: 0, price: 1 }), /changed/);
});
test("concurrent writes cannot overwrite history or emit twice", async (t) => {
  const state = await setup(t);
  const results = await Promise.allSettled([changeStatus({ id: state.id, revision: 0, status: "hold" }), changePrice({ id: state.id, revision: 0, price: 1 })]);
  assert.equal(results.filter((entry) => entry.status === "fulfilled").length, 1);
  assert.equal(state.document().__v, 1);
});
test("full edits atomically audit both changes; handler failure reports saved warning", async (t) => {
  const state = await setup(t);
  t.after(on("vehicle.status_changed", "inventory-failure", () => { throw new Error("offline"); }));
  let prices = 0;
  t.after(on("vehicle.price_changed", "inventory-price", () => { prices++; }));
  const result = await updateVehicle({ id: state.id, revision: 0, data: { ...state.form, status: "hold", price: 100, trim: "Updated" } });
  assert.equal(result.vehicle.trim, "Updated");
  assert.equal(result.vehicle.statusHistory.length, 1);
  assert.equal(result.vehicle.priceHistory.length, state.data.vehicles[0].priceHistory.length + 1);
  assert.match(result.warning!, /Saved/);
  assert.equal(prices, 1);
});
test("inputs reject invalid references, unsafe photos, forged audit fields and duplicate stock", async (t) => {
  const state = await setup(t);
  await assert.rejects(changeStatus({ id: state.id, revision: 0, status: "unknown" }), /configured/);
  await assert.rejects(changePrice({ id: state.id, revision: 0, price: -1 }));
  await assert.rejects(createVehicle({ ...state.form, statusHistory: [] }));
  await assert.rejects(createVehicle({ ...state.form, photos: ["javascript:alert(1)"] }));
  await assert.rejects(createVehicle({ ...state.form, dealershipId: "a".repeat(24) }), /active dealership/);
  t.mock.method(VehicleModel, "create", async () => { throw Object.assign(new Error("duplicate"), { code: 11000 }); });
  await assert.rejects(createVehicle(state.form), /already in use/);
  assert.equal(state.writes.mock.callCount(), 0);
});
test("search escapes regex, applies combined filters and clamps pagination", async (t) => {
  const state = await setup(t);
  t.mock.method(VehicleModel, "countDocuments", () => chain(1));
  const find = t.mock.method(VehicleModel, "find", () => chain([state.document()]));
  const result = await listVehicles({ q: "Jeep.*", status: "available", dealershipId: state.form.dealershipId, page: 5 });
  assert.equal(result.page, 1);
  assert.equal(result.vehicles[0].revision, 0);
  assert.deepEqual(find.mock.calls[0].arguments[0], { dealershipId: state.form.dealershipId, status: "available", $or: ["make", "model", "stockNo"].map((field) => ({ [field]: { $regex: "Jeep\\.\\*", $options: "i" } })) });
});
test("linked leads are restricted to the salesperson's assignments", async (t) => {
  const state = await setup(t, "salesperson");
  const find = t.mock.method(LeadModel, "find", () => chain([]));
  await listVehicleLeads(state.id);
  assert.deepEqual(find.mock.calls[0].arguments[0], { vehicleId: state.id, assignedTo: state.user.id });
});
