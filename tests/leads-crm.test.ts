import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test, type TestContext } from "node:test";
import mongoose from "mongoose";
import { buildDemoData, demoStaff } from "../scripts/seed/data";
import { UserModel } from "../src/modules/users/model";
import { LeadModel } from "../src/modules/leads/model";
import { NotificationModel } from "../src/modules/notifications/model";
import { SettingsModel } from "../src/modules/settings/model";
import { invalidateSettingsCache } from "../src/modules/settings/service";
import { signSession, SESSION_COOKIE } from "../src/modules/auth/session";
import { AuthorizationError } from "../src/modules/auth/service";
import { addLeadNote, changeLeadStage, getLead, listLeads, reassignLead } from "../src/modules/leads/service";
import { changeLeadStageAction } from "../src/modules/leads/actions";
import { listMyNotifications, markAllNotificationsRead, markNotificationRead } from "../src/modules/notifications/service";
import { on } from "../src/lib/events";

const require = createRequire(import.meta.url);
const headers = require("next/headers");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const filterOf = (spy: { mock: { calls: { arguments: unknown[] }[] } }) => spy.mock.calls[0].arguments[0] as Record<string, any>;
const chain = (value: unknown) => { const query = { select: () => query, sort: () => query, skip: () => query, limit: () => query, lean: () => query, exec: async () => value }; return query; };

async function setup(t: TestContext, role: "owner" | "salesperson" = "owner") {
  const previous = { AUTH_SECRET: process.env.AUTH_SECRET, MONGODB_URI: process.env.MONGODB_URI };
  process.env.AUTH_SECRET = "leads-test-only-secret-longer-than-32-bytes!";
  process.env.MONGODB_URI = "mongodb://example.invalid/leads_test";
  t.after(() => { invalidateSettingsCache(); for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  t.mock.method(mongoose, "connect", async () => mongoose);
  const data = buildDemoData(Object.fromEntries(demoStaff.map((user) => [user.email, "$2b$12$" + "a".repeat(53)])));
  const user = data.users.find((entry) => entry.role === role)!;
  const token = await signSession(user.id);
  t.mock.method(headers, "cookies", async () => ({ get: (name: string) => name === SESSION_COOKIE ? { value: token } : undefined }));
  const users = new Map(data.users.map((entry) => [entry.id, entry]));
  t.mock.method(UserModel, "findOne", (filter: { _id: string }) => { const found = users.get(filter._id); return chain(found ? { ...found, _id: found.id } : null); });
  t.mock.method(SettingsModel, "findById", () => chain(data.settings));
  invalidateSettingsCache();
  // A lead at the salesperson's location, assigned to them.
  const salesperson = data.users.find((entry) => entry.role === "salesperson")!;
  const seeded = data.leads.find((lead) => lead.assignedTo === salesperson.id && lead.stage === "contacted")
    ?? data.leads.find((lead) => lead.assignedTo === salesperson.id)!;
  const { id, bookingToken, ...fields } = seeded;
  void bookingToken;
  let document = { ...fields, _id: id, createdAt: new Date().toISOString() };
  const findOne = t.mock.method(LeadModel, "findOne", (filter: Record<string, unknown>) =>
    chain(filter._id === id && (!("assignedTo" in filter) || filter.assignedTo === document.assignedTo) ? document : null));
  const updates = t.mock.method(LeadModel, "updateOne", (filter: Record<string, unknown>, update: { $set?: Record<string, unknown>; $push?: { activity: unknown } }) => {
    const matches = Object.entries(filter).every(([key, value]) => key === "_id" ? value === id : document[key as keyof typeof document] === value);
    if (matches) document = { ...document, ...(update.$set ?? {}), ...(update.$push ? { activity: [...document.activity, update.$push.activity as never] } : {}) };
    return chain({ modifiedCount: matches ? 1 : 0 });
  });
  return { data, user, salesperson, id, findOne, updates, document: () => document };
}

test("salespeople are always scoped to their own leads, whatever the filters", async (t) => {
  const state = await setup(t, "salesperson");
  t.mock.method(LeadModel, "countDocuments", () => chain(0));
  const find = t.mock.method(LeadModel, "find", () => chain([]));
  const other = state.data.users.find((entry) => entry.role === "salesperson" && entry.id !== state.user.id)!;
  await listLeads({ assignedTo: other.id, q: "a.b" });
  assert.equal(filterOf(find).assignedTo, state.user.id);
  assert.deepEqual(filterOf(find).$or[0], { name: { $regex: "a\\.b", $options: "i" } });
  assert.equal(await getLead("not-an-id"), null);
  assert.equal(state.findOne.mock.callCount(), 0);
});

test("owners see all leads and can filter unassigned", async (t) => {
  await setup(t);
  t.mock.method(LeadModel, "countDocuments", () => chain(0));
  const find = t.mock.method(LeadModel, "find", () => chain([]));
  await listLeads({ assignedTo: "unassigned", stage: "new" });
  assert.deepEqual(filterOf(find), { stage: "new", assignedTo: null });
});

test("stage changes are validated, conditional on the seen stage, and emit with the actor", async (t) => {
  const state = await setup(t, "salesperson");
  const events: { changedBy: string; previousStage: string; stage: string }[] = [];
  t.after(on("lead.stage_changed", "leads-test", (event) => { events.push(event.payload); }));
  const from = state.document().stage;
  await assert.rejects(changeLeadStage({ id: state.id, from, stage: "unknown" }), /configured/);
  await assert.rejects(changeLeadStage({ id: state.id, from: from === "new" ? "won" : "new", stage: "lost" }), /changed/);
  await changeLeadStage({ id: state.id, from, stage: "lost" });
  assert.equal(state.document().stage, "lost");
  assert.deepEqual(events.map(({ changedBy, previousStage, stage }) => ({ changedBy, previousStage, stage })), [{ changedBy: state.user.id, previousStage: from, stage: "lost" }]);
  const action = await changeLeadStageAction({ id: state.id, from: "lost", stage: "won" });
  assert.equal(action.ok, true);
});

test("handler failure after a committed stage change reports a warning, not an error", async (t) => {
  const state = await setup(t);
  t.after(on("lead.stage_changed", "leads-test-fail", () => { throw new Error("offline"); }));
  const result = await changeLeadStage({ id: state.id, from: state.document().stage, stage: "won" });
  assert.match(result.warning!, /Saved/);
  assert.equal(state.document().stage, "won");
});

test("only owners reassign, and only to an active salesperson at the lead's location", async (t) => {
  const state = await setup(t, "salesperson");
  await assert.rejects(reassignLead({ id: state.id, from: state.salesperson.id, salespersonId: state.salesperson.id }), AuthorizationError);
  assert.equal(state.updates.mock.callCount(), 0);
});

test("owner reassignment checks location, staleness and emits the previous assignee", async (t) => {
  const state = await setup(t);
  const events: { salespersonId: string; previousSalespersonId: string | null; changedBy?: string }[] = [];
  t.after(on("lead.assigned", "leads-test", (event) => { events.push(event.payload); }));
  const colleague = state.data.users.find((entry) => entry.role === "salesperson" && entry.id !== state.salesperson.id && entry.dealershipId === state.document().dealershipId)!;
  const elsewhere = state.data.users.find((entry) => entry.role === "salesperson" && entry.dealershipId !== state.document().dealershipId)!;
  await assert.rejects(reassignLead({ id: state.id, from: state.salesperson.id, salespersonId: elsewhere.id }), /location/);
  await assert.rejects(reassignLead({ id: state.id, from: null, salespersonId: colleague.id }), /changed/);
  await reassignLead({ id: state.id, from: state.salesperson.id, salespersonId: colleague.id });
  assert.equal(state.document().assignedTo, colleague.id);
  assert.deepEqual(events, [{ leadId: state.id, vehicleId: state.document().vehicleId, dealershipId: state.document().dealershipId,
    salespersonId: colleague.id, previousSalespersonId: state.salesperson.id, changedBy: state.user.id }]);
});

test("notes are attributed to the author and rejected when empty", async (t) => {
  const state = await setup(t, "salesperson");
  await assert.rejects(addLeadNote({ id: state.id, message: "   " }));
  await addLeadNote({ id: state.id, message: "Left a voicemail." });
  const note = state.document().activity.at(-1) as unknown as { type: string; actorId: string; message: string };
  assert.deepEqual([note.type, note.actorId, note.message], ["note", state.user.id, "Left a voicemail."]);
});

test("alerts are read and marked only for the signed-in user", async (t) => {
  const state = await setup(t, "salesperson");
  const find = t.mock.method(NotificationModel, "find", () => chain([]));
  const one = t.mock.method(NotificationModel, "updateOne", () => chain({}));
  const many = t.mock.method(NotificationModel, "updateMany", () => chain({}));
  await listMyNotifications();
  await markNotificationRead("a".repeat(24));
  await markAllNotificationsRead();
  assert.equal(filterOf(find).userId, state.user.id);
  assert.equal(filterOf(one).userId, state.user.id);
  assert.deepEqual(filterOf(many), { userId: state.user.id, readAt: null });
  await assert.rejects(markNotificationRead("bad"));
});
