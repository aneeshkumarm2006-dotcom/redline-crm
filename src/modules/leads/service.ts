import "server-only";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { getSettings } from "@/modules/settings/service";
import { LeadModel, AssignmentCursorModel } from "./model";
import { listAutomationStaff } from "@/modules/users/service";
import { activitySchema } from "@/lib/activity-schema";
import type { AppEvent } from "@/lib/events";
import { leadSchema } from "./schema";
import { requireRole } from "@/modules/auth/service";
import { objectIdSchema } from "@/lib/data-schema";
import { randomBytes } from "node:crypto";
import { getPublicVehicle } from "@/modules/inventory/service";
import { emit } from "@/lib/events";
import { findActiveUser } from "@/modules/users/service";
import type { User } from "@/modules/users/schema";
import { inquirySchema, leadInputSchema, leadFilterSchema, stageChangeSchema, reassignSchema, noteSchema, type InquiryInput, type StaffLead } from "./schema";
import { inquiryCopy, leadsCopy } from "./copy";

export class InquiryError extends Error {}
export class LeadError extends Error {}

const staffLeadSchema = leadSchema.omit({ bookingToken: true, inquiryId: true });
const PAGE_SIZE = 24;

function toStaffLead(document: unknown): StaffLead {
  const { _id, __v, createdAt, updatedAt, ...data } = JSON.parse(JSON.stringify(document));
  void __v; void updatedAt;
  return { ...staffLeadSchema.parse({ ...data, id: _id }), createdAt };
}
/** Salespeople work only their assigned leads; owners see every lead. */
const scope = (user: User) => user.role === "owner" ? {} : { assignedTo: user.id };

export async function listLeads(input: unknown = {}) {
  const user = await requireRole();
  const filters = leadFilterSchema.parse(input);
  await connectDb();
  const search = filters.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const query = {
    ...(filters.stage ? { stage: filters.stage } : {}),
    ...(filters.dealershipId ? { dealershipId: filters.dealershipId } : {}),
    ...(filters.assignedTo ? { assignedTo: filters.assignedTo === "unassigned" ? null : filters.assignedTo } : {}),
    ...(search ? { $or: ["name", "email", "phone"].map((field) => ({ [field]: { $regex: search, $options: "i" } })) } : {}),
    ...scope(user),
  };
  const total = await LeadModel.countDocuments(query).exec();
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const documents = await LeadModel.find(query).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean().exec();
  return { leads: documents.map(toStaffLead), total, page, pageCount };
}

/** Returns null for missing leads and for leads outside the salesperson's assignment. */
export async function getLead(id: string) {
  const user = await requireRole();
  if (!objectIdSchema.safeParse(id).success) return null;
  await connectDb();
  const document = await LeadModel.findOne({ _id: id, ...scope(user) }).lean().exec();
  return document ? toStaffLead(document) : null;
}

async function editableLead(user: User, id: string) {
  await connectDb();
  const document = await LeadModel.findOne({ _id: id, ...scope(user) }).lean().exec();
  if (!document) throw new LeadError(leadsCopy.notFound);
  return toStaffLead(document);
}
async function announce(operation: () => Promise<unknown>) {
  // Persistence succeeded. Do not tell the user to repeat a committed write.
  try { await operation(); return {}; }
  catch { return { warning: leadsCopy.savedWithWarning }; }
}

export async function changeLeadStage(input: unknown) {
  const user = await requireRole();
  const { id, from, stage } = stageChangeSchema.parse(input);
  const settings = await getSettings();
  if (!settings.leadStages.some((entry) => entry.key === stage)) throw new LeadError(leadsCopy.unknownStage);
  const lead = await editableLead(user, id);
  if (lead.stage !== from) throw new LeadError(leadsCopy.stale);
  if (from === stage) return {};
  const result = await LeadModel.updateOne({ _id: id, stage: from, ...scope(user) }, { $set: { stage } }).exec();
  if (!result.modifiedCount) throw new LeadError(leadsCopy.stale);
  // The activity handler records the change with this user as the actor.
  return announce(() => emit("lead.stage_changed", { leadId: id, vehicleId: lead.vehicleId, dealershipId: lead.dealershipId,
    previousStage: from, stage, changedBy: user.id }));
}

export async function reassignLead(input: unknown) {
  const user = await requireRole("owner");
  const { id, from, salespersonId } = reassignSchema.parse(input);
  const lead = await editableLead(user, id);
  if (lead.assignedTo !== from) throw new LeadError(leadsCopy.stale);
  if (from === salespersonId) return {};
  const salesperson = await findActiveUser(salespersonId);
  if (!salesperson || salesperson.role !== "salesperson" || salesperson.dealershipId !== lead.dealershipId) throw new LeadError(leadsCopy.invalidAssignee);
  const result = await LeadModel.updateOne({ _id: id, assignedTo: from }, { $set: { assignedTo: salesperson.id } }).exec();
  if (!result.modifiedCount) throw new LeadError(leadsCopy.stale);
  return announce(() => emit("lead.assigned", { leadId: id, vehicleId: lead.vehicleId, dealershipId: lead.dealershipId,
    salespersonId: salesperson.id, previousSalespersonId: from, changedBy: user.id }));
}

export async function addLeadNote(input: unknown) {
  const user = await requireRole();
  const { id, message } = noteSchema.parse(input);
  await editableLead(user, id);
  const activity = activitySchema.parse({ type: "note", message, occurredAt: new Date().toISOString(), actorId: user.id });
  await LeadModel.updateOne({ _id: id, ...scope(user) }, { $push: { activity } }).exec();
  return {};
}

/** Minimal display fields for other staff screens (appointments, dashboard), within the same visibility rules. */
export async function getLeadSummaries(ids: string[]) {
  const user = await requireRole();
  const valid = z.array(objectIdSchema).parse(ids);
  if (!valid.length) return [];
  await connectDb();
  const documents = await LeadModel.find({ _id: { $in: valid }, ...scope(user) }).select("name phone stage vehicleId").lean().exec();
  return documents.map((document) => ({ id: document._id.toString(), name: document.name, phone: document.phone, stage: document.stage, vehicleId: document.vehicleId.toString() }));
}

export async function countLeadsSince(since: string) {
  const user = await requireRole();
  await connectDb();
  return LeadModel.countDocuments({ createdAt: { $gte: new Date(since) }, ...scope(user) }).exec();
}

/** Newest activity across visible leads, newest first. */
export async function listRecentLeadActivity(limit = 10) {
  const user = await requireRole();
  await connectDb();
  const match = user.role === "owner" ? {} : { assignedTo: new LeadModel.base.Types.ObjectId(user.id) };
  const rows = await LeadModel.aggregate<{ _id: unknown; name: string; activity: { type: string; message: string; occurredAt: Date; actorId: unknown } }>([
    { $match: match }, { $unwind: "$activity" }, { $sort: { "activity.occurredAt": -1 } }, { $limit: limit },
    { $project: { name: 1, activity: 1 } },
  ]).exec();
  return rows.map((row) => ({ leadId: String(row._id), name: row.name, type: row.activity.type, message: row.activity.message,
    occurredAt: new Date(row.activity.occurredAt).toISOString(), actorId: row.activity.actorId ? String(row.activity.actorId) : null }));
}

/** Internal automation lookup; includes a bearer token, never return to staff/public UI. */
export async function getLeadForAutomation(id: string) {
  await connectDb();
  const document = await LeadModel.findById(objectIdSchema.parse(id)).select("+bookingToken").lean().exec();
  if (!document) throw new Error("Automation lead missing.");
  const { _id, __v, createdAt, updatedAt, ...data } = JSON.parse(JSON.stringify(document));
  void __v; void createdAt; void updatedAt;
  return leadSchema.parse({ ...data, id: _id });
}

/** Atomic per-dealership cursor works across processes, including concurrent inquiries. */
export async function assignCreatedLead(event: AppEvent<"lead.created">) {
  const settings = await getSettings();
  if (settings.leadAssignmentStrategy === "manual") return;
  const lead = await getLeadForAutomation(event.payload.leadId);
  if (lead.assignedTo) return;
  const staff = await listAutomationStaff(lead.dealershipId);
  if (!staff.length) return; // Keep unassigned for the owner; still send customer follow-up.
  await AssignmentCursorModel.init();
  try {
    await AssignmentCursorModel.updateOne({ _id: lead.dealershipId }, { $setOnInsert: { next: 0 } }, { upsert: true }).exec();
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === 11000)) throw error;
  }
  const cursor = await AssignmentCursorModel.findOneAndUpdate({ _id: lead.dealershipId }, { $inc: { next: 1 } }, { returnDocument: "after" }).lean().exec();
  if (!cursor) throw new Error("Assignment cursor missing.");
  const salesperson = staff[(cursor.next - 1) % staff.length];
  const result = await LeadModel.updateOne({ _id: lead.id, assignedTo: null }, { $set: { assignedTo: salesperson.id } }).exec();
  if (result.modifiedCount) await emit("lead.assigned", {
    leadId: lead.id, vehicleId: lead.vehicleId, dealershipId: lead.dealershipId,
    salespersonId: salesperson.id, previousSalespersonId: null,
  });
}

/** Internal event audit. Reprocessing the same event cannot duplicate activity. */
export async function appendLeadActivity(id: string, input: unknown) {
  const activity = activitySchema.parse(input);
  await connectDb();
  await LeadModel.updateOne({ _id: objectIdSchema.parse(id), ...(activity.eventId ? { "activity.eventId": { $ne: activity.eventId } } : {}) }, { $push: { activity } }).exec();
}
async function priorInquiry(input: InquiryInput) {
  const existing = await LeadModel.findOne({ inquiryId: input.inquiryId }).select("name email phone message vehicleId").lean().exec();
  if (!existing) return null;
  if (existing.name !== input.name || existing.email !== input.email || existing.phone !== input.phone || existing.message !== input.message || existing.vehicleId.toString() !== input.vehicleId) throw new InquiryError(inquiryCopy.reused);
  return { leadId: existing._id.toString() };
}
/** Public intake: vehicle and settings determine all internal fields. */
export async function create(input: unknown) {
  const data = inquirySchema.parse(input);
  await connectDb();
  const previous = await priorInquiry(data);
  if (previous) return previous;
  const [vehicle, settings] = await Promise.all([getPublicVehicle(data.vehicleId), getSettings()]);
  if (!vehicle) throw new InquiryError(inquiryCopy.unavailable);
  const stage = [...settings.leadStages].sort((a, b) => a.order - b.order)[0].key;
  const record = leadInputSchema.parse({ ...data, dealershipId: vehicle.dealershipId, stage, source: "public_inventory",
    assignedTo: null, bookingToken: randomBytes(32).toString("base64url"),
    activity: [{ type: "lead.created", message: inquiryCopy.activity, occurredAt: new Date().toISOString(), actorId: null }],
  });
  await LeadModel.init();
  let lead;
  try { lead = await LeadModel.create(record); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === 11000) {
      const previous = await priorInquiry(data);
      if (previous) return previous;
    }
    throw error;
  }
  const leadId = lead._id.toString();
  try { await emit("lead.created", { leadId, vehicleId: vehicle.id, dealershipId: vehicle.dealershipId }); }
  catch {
    // Persistence succeeded. Do not invite a repeat submission after handler failure.
    console.error("Lead saved; lead.created handler failed.", { leadId });
  }
  return { leadId };
}

/** Public booking lookup by bearer token. Returns only booking fields, never the token itself. */
export async function getLeadForBooking(token: string) {
  const parsed = leadInputSchema.shape.bookingToken.safeParse(token);
  if (!parsed.success) return null;
  await connectDb();
  const document = await LeadModel.findOne({ bookingToken: parsed.data }).select("name vehicleId dealershipId assignedTo stage").lean().exec();
  if (!document) return null;
  return { id: document._id.toString(), name: document.name, vehicleId: document.vehicleId.toString(),
    dealershipId: document.dealershipId.toString(), assignedTo: document.assignedTo?.toString() ?? null, stage: document.stage };
}

/** Moves a booked lead forward to the configured stage, never backward, with an audit entry. */
export async function advanceLeadForBooking(leadId: string, stageKey: string) {
  const id = objectIdSchema.parse(leadId);
  const { leadStages } = await getSettings();
  const target = leadStages.find((entry) => entry.key === stageKey);
  if (!target) return;
  await connectDb();
  const lead = await LeadModel.findById(id).select("stage").lean().exec();
  const current = leadStages.find((entry) => entry.key === lead?.stage);
  if (!lead || !current || current.order >= target.order) return;
  const activity = activitySchema.parse({ type: "lead.stage_changed", occurredAt: new Date().toISOString(), actorId: null,
    message: `Stage changed from ${current.label} to ${target.label}.` });
  // Conditional on the stage just read, so a concurrent staff change wins.
  await LeadModel.updateOne({ _id: id, stage: current.key }, { $set: { stage: target.key }, $push: { activity } }).exec();
}

/** Vehicle detail respects the assignment boundary of the leads UI. */
export async function listVehicleLeads(vehicleId: string) {
  const user = await requireRole();
  const id = objectIdSchema.parse(vehicleId);
  await connectDb();
  const documents = await LeadModel.find({ vehicleId: id, ...(user.role === "owner" ? {} : { assignedTo: user.id }) })
    .select("name email phone stage").sort({ createdAt: -1 }).lean().exec();
  return documents.map((document) => ({ id: document._id.toString(), name: document.name, email: document.email, phone: document.phone, stage: document.stage }));
}

/** Destructive internal CLI import only; never expose through a server action. */
export async function replaceLeadsForSeed(input: unknown) {
  const records = z.array(leadSchema).parse(input);
  const settings = await getSettings();
  const keys = new Set(settings.leadStages.map((entry) => entry.key));
  for (const record of records) {
    if (!keys.has(record.stage)) {
      throw new Error("Record references an unknown settings key.");
    }
  }
  await connectDb();
  await LeadModel.init();
  const documents = records.map(({ id, ...data }) => new LeadModel({ _id: id, ...data }));
  // Validate all documents before clearing this collection.
  for (const document of documents) await document.validate();
  await LeadModel.deleteMany({}).exec();
  await AssignmentCursorModel.deleteMany({}).exec();
  if (documents.length) await LeadModel.insertMany(documents);
  return documents.length;
}
