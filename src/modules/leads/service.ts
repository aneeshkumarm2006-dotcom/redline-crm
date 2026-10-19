import "server-only";
import { escapeRegex } from "@/lib/regex";
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
import { getPublicVehicle, getVehicle, getVehicleSummaries } from "@/modules/inventory/service";
import { listDealerships } from "@/modules/dealerships/service";
import { csvDocument } from "@/lib/csv";
import { listEmailsForLead } from "@/modules/automations/service";
import type { Settings } from "@/modules/settings/schema";
import { emit } from "@/lib/events";
import { findActiveUser, getStaffNames } from "@/modules/users/service";
import type { User } from "@/modules/users/schema";
import { inquirySchema, leadInputSchema, leadFilterSchema, stageChangeSchema, reassignSchema, noteSchema, logCallSchema, staffLeadFormSchema, type InquiryInput, type LeadFilters, type StaffLead } from "./schema";
import { inquiryCopy, leadsCopy } from "./copy";

export class InquiryError extends Error {}
export class LeadError extends Error {}

const staffLeadSchema = leadSchema.omit({ bookingToken: true, inquiryId: true });
const PAGE_SIZE = 24;
/** The pipeline shows every matching lead in its stage columns, so it is capped rather than paginated. */
const PIPELINE_LIMIT = 400;
const HOUR = 60 * 60_000;

function toStaffLead(document: unknown): StaffLead {
  const { _id, __v, createdAt, updatedAt, ...data } = JSON.parse(JSON.stringify(document));
  void __v; void updatedAt;
  return { ...staffLeadSchema.parse({ ...data, id: _id }), createdAt };
}
/** Salespeople work only their assigned leads; owners see every lead. */
const scope = (user: User) => user.role === "owner" ? {} : { assignedTo: user.id };

/** First stage by `order`: where new leads start. */
export const firstStageKey = (settings: Pick<Settings, "leadStages">) => [...settings.leadStages].sort((a, b) => a.order - b.order)[0].key;
/** The stage after `key` by order, skipping the closed (won/lost) stages; null at the end of the open stages. */
export function nextOpenStage(settings: Pick<Settings, "leadStages" | "wonStageKey" | "lostStageKey">, key: string) {
  const stages = [...settings.leadStages].sort((a, b) => a.order - b.order);
  const current = stages.find((entry) => entry.key === key);
  if (!current) return null;
  return stages.find((entry) => entry.order > current.order && entry.key !== settings.wonStageKey && entry.key !== settings.lostStageKey) ?? null;
}

function leadQuery(filters: LeadFilters, user: User, byStage = true) {
  const search = escapeRegex(filters.q);
  return {
    ...(byStage && filters.stage ? { stage: filters.stage } : {}),
    ...(filters.dealershipId ? { dealershipId: filters.dealershipId } : {}),
    ...(filters.assignedTo ? { assignedTo: filters.assignedTo === "unassigned" ? null : filters.assignedTo } : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(search ? { $or: ["name", "email", "phone"].map((field) => ({ [field]: { $regex: search, $options: "i" } })) } : {}),
    ...scope(user),
  };
}

export async function listLeads(input: unknown = {}) {
  const user = await requireRole();
  const filters = leadFilterSchema.parse(input);
  await connectDb();
  const query = leadQuery(filters, user);
  const total = await LeadModel.countDocuments(query).exec();
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const documents = await LeadModel.find(query).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean().exec();
  return { leads: documents.map(toStaffLead), total, page, pageCount };
}

/**
 * Pipeline board: every visible lead matching the filters (stage aside), newest first and without the
 * activity log. Capped; `truncated` tells the screen to suggest narrowing the filters.
 */
export async function listPipelineLeads(input: unknown = {}) {
  const user = await requireRole();
  const filters = leadFilterSchema.parse(input);
  await connectDb();
  const query = leadQuery(filters, user, false);
  const [total, documents] = await Promise.all([
    LeadModel.countDocuments(query).exec(),
    LeadModel.find(query).select("-activity").sort({ createdAt: -1, _id: -1 }).limit(PIPELINE_LIMIT).lean().exec(),
  ]);
  return { leads: documents.map(toStaffLead), total, truncated: total > documents.length };
}

/**
 * Leads matching the board/list filters as CSV (the stage filter applies too), newest first, within the caller's
 * visibility and the pipeline cap.
 */
export async function exportLeads(input: unknown = {}) {
  await requireRole();
  const filters = leadFilterSchema.parse(input);
  const [{ leads }, settings, dealerships] = await Promise.all([listPipelineLeads(filters), getSettings(), listDealerships()]);
  const rows = filters.stage ? leads.filter((lead) => lead.stage === filters.stage) : leads;
  const [vehicles, staff] = await Promise.all([
    getVehicleSummaries([...new Set(rows.map((lead) => lead.vehicleId))]),
    getStaffNames([...new Set(rows.flatMap((lead) => lead.assignedTo ? [lead.assignedTo] : []))]),
  ]);
  const label = (list: { key: string; label: string }[], key: string) => list.find((entry) => entry.key === key)?.label ?? key;
  const received = new Intl.DateTimeFormat("en-CA", { dateStyle: "short", timeStyle: "short", timeZone: settings.booking.timeZone });
  const columns = leadsCopy.csv;
  const body = csvDocument([
    [columns.received, columns.customer, columns.email, columns.phone, columns.stage, columns.source, columns.campaign, columns.vehicle, columns.stockNo, columns.location, columns.salesperson],
    ...rows.map((lead) => {
      const vehicle = vehicles.find((entry) => entry.id === lead.vehicleId);
      return [received.format(new Date(lead.createdAt)), lead.name, lead.email, lead.phone, label(settings.leadStages, lead.stage), label(settings.leadSources, lead.source),
        lead.utmSource ?? "", vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`.trim() : "", vehicle?.stockNo ?? "",
        dealerships.find((entry) => entry.id === lead.dealershipId)?.name ?? "", lead.assignedTo ? staff.find((entry) => entry.id === lead.assignedTo)?.name ?? leadsCopy.unknownStaff : leadsCopy.unassigned];
    }),
  ]);
  return { filename: `leads-${new Date().toISOString().slice(0, 10)}.csv`, body };
}

/** Owner settings screen: which of these stage and source keys are still used by any lead. */
export async function findLeadKeysInUse(input: { stages: string[]; sources: string[] }) {
  await requireRole("owner");
  const keys = z.object({ stages: z.array(z.string().max(80)), sources: z.array(z.string().max(80)) }).parse(input);
  await connectDb();
  const [stages, sources] = await Promise.all([
    keys.stages.length ? LeadModel.distinct("stage", { stage: { $in: keys.stages } }).exec() : [],
    keys.sources.length ? LeadModel.distinct("source", { source: { $in: keys.sources } }).exec() : [],
  ]);
  return { stages: stages.map(String), sources: sources.map(String) };
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

/** Appends a staff contact entry and stamps the first contact once (response-time stats, "not contacted" queue). */
async function recordContact(user: User, id: string, type: "call" | "email", message: string) {
  const activity = activitySchema.parse({ type, message, occurredAt: new Date().toISOString(), actorId: user.id });
  await connectDb();
  await LeadModel.updateOne({ _id: id, ...scope(user) }, { $push: { activity } }).exec();
  await LeadModel.updateOne({ _id: id, firstContactedAt: null, ...scope(user) }, { $set: { firstContactedAt: new Date(activity.occurredAt) } }).exec();
}

/** Log call: records the contact and, when asked, moves the lead on from the stage the user saw to the next open stage. */
export async function logLeadCall(input: unknown) {
  const user = await requireRole();
  const { id, note, advanceFrom } = logCallSchema.parse(input);
  const settings = await getSettings();
  await editableLead(user, id);
  await recordContact(user, id, "call", note ? `${leadsCopy.callLogged} ${note}` : leadsCopy.callLogged);
  const next = advanceFrom ? nextOpenStage(settings, advanceFrom) : null;
  if (!advanceFrom || !next) return {};
  // The call is saved either way; a concurrent stage change only skips the move.
  try { return await changeLeadStage({ id, from: advanceFrom, stage: next.key }); }
  catch (error) { if (error instanceof LeadError) return { warning: leadsCopy.callSavedStageStale }; throw error; }
}

/** A staff email to the customer (sent and logged by the caller) counts as contact. */
export async function recordLeadEmailContact(id: string, subject: string) {
  const user = await requireRole();
  const leadId = objectIdSchema.parse(id);
  await editableLead(user, leadId);
  await recordContact(user, leadId, "email", leadsCopy.emailLogged(subject));
}

/** Emails logged for a lead the user can see, newest first (Emails tab). */
export async function listLeadEmails(id: string) {
  const lead = await getLead(id);
  return lead ? listEmailsForLead(lead.id) : [];
}

/** Leads created in [from, to) with their activity, for journey funnels. */
export async function listLeadsCreatedBetween(from: string, to: string) {
  const user = await requireRole();
  const range = z.object({ from: z.string().datetime({ offset: true }), to: z.string().datetime({ offset: true }) }).parse({ from, to });
  await connectDb();
  const documents = await LeadModel.find({ createdAt: { $gte: new Date(range.from), $lt: new Date(range.to) }, ...scope(user) })
    .sort({ createdAt: -1, _id: -1 }).limit(1000).lean().exec();
  return documents.map(toStaffLead);
}

/**
 * Coordinator work queues, oldest first: open leads nobody owns (owners only), and leads still in the first
 * stage with no recorded contact after `settings.uncontactedLeadHours`.
 */
export async function listLeadQueues(now = Date.now(), dealershipId?: string) {
  const user = await requireRole();
  const settings = await getSettings();
  await connectDb();
  const location = dealershipId ? { dealershipId: objectIdSchema.parse(dealershipId) } : {};
  const [unassigned, uncontacted] = await Promise.all([
    user.role === "owner"
      ? LeadModel.find({ assignedTo: null, stage: { $nin: [settings.wonStageKey, settings.lostStageKey] }, ...location }).select("-activity").sort({ createdAt: 1, _id: 1 }).limit(50).lean().exec()
      : [],
    LeadModel.find({ firstContactedAt: null, stage: firstStageKey(settings), createdAt: { $lte: new Date(now - settings.uncontactedLeadHours * HOUR) }, ...location, ...scope(user) })
      .select("-activity").sort({ createdAt: 1, _id: 1 }).limit(50).lean().exec(),
  ]);
  return { unassigned: unassigned.map(toStaffLead), uncontacted: uncontacted.map(toStaffLead), hours: settings.uncontactedLeadHours };
}

/** Visible leads with the most recent activity first (coordinator live feed). */
export async function listRecentlyActiveLeads(limit = 8) {
  const user = await requireRole();
  const size = z.number().int().min(1).max(50).parse(limit);
  await connectDb();
  const match = user.role === "owner" ? {} : { assignedTo: new LeadModel.base.Types.ObjectId(user.id) };
  const documents = await LeadModel.aggregate([
    { $match: match }, { $addFields: { lastActivityAt: { $max: "$activity.occurredAt" } } },
    { $sort: { lastActivityAt: -1, _id: -1 } }, { $limit: size },
    // Aggregation ignores `select: false`: drop the bearer token and inquiry ID explicitly.
    { $project: { lastActivityAt: 0, bookingToken: 0, inquiryId: 0 } },
  ]).exec();
  return documents.map(toStaffLead);
}

/** Staff-entered lead (phone, walk-in, referral…): the same intake rules and `lead.created` automations as a website inquiry. */
export async function createStaffLead(input: unknown) {
  const user = await requireRole();
  const data = staffLeadFormSchema.parse(input);
  await connectDb();
  const replay = await LeadModel.findOne({ inquiryId: data.requestId }).select("_id").lean().exec();
  if (replay) return { leadId: replay._id.toString() };
  const [settings, vehicle] = await Promise.all([getSettings(), getVehicle(data.vehicleId)]);
  const source = settings.leadSources.find((entry) => entry.key === data.source);
  if (!source) throw new LeadError(leadsCopy.unknownSource);
  if (!vehicle || vehicle.status === settings.statusRoles.sold) throw new LeadError(leadsCopy.vehicleUnavailable);
  let assignee: User | null = null;
  if (user.role === "salesperson") {
    // Salespeople keep the leads they enter, so the car must be at their location.
    if (user.dealershipId !== vehicle.dealershipId) throw new LeadError(leadsCopy.otherLocation);
    assignee = user;
  } else if (data.assignedTo) {
    const person = await findActiveUser(data.assignedTo);
    if (!person || person.role !== "salesperson" || person.dealershipId !== vehicle.dealershipId) throw new LeadError(leadsCopy.invalidAssignee);
    assignee = person;
  }
  const now = new Date().toISOString();
  const selfAssigned = assignee?.id === user.id;
  const record = leadInputSchema.parse({
    name: data.name, email: data.email, phone: data.phone, message: data.message, vehicleId: vehicle.id, dealershipId: vehicle.dealershipId,
    stage: firstStageKey(settings), source: source.key, assignedTo: assignee?.id ?? null, firstContactedAt: data.contacted ? now : null,
    bookingToken: randomBytes(32).toString("base64url"), inquiryId: data.requestId,
    activity: [
      { type: "lead.created", message: leadsCopy.staffCreated(source.label), occurredAt: now, actorId: user.id },
      // Self-assignment needs no alert, so it is recorded here rather than through `lead.assigned`.
      ...(assignee && selfAssigned ? [{ type: "lead.assigned", message: leadsCopy.assignedActivity(assignee.name), occurredAt: now, actorId: user.id }] : []),
    ],
  });
  await LeadModel.init();
  let leadId: string;
  try { leadId = (await LeadModel.create(record))._id.toString(); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === 11000) {
      const winner = await LeadModel.findOne({ inquiryId: data.requestId }).select("_id").lean().exec();
      if (winner) return { leadId: winner._id.toString() };
    }
    throw error;
  }
  const refs = { leadId, vehicleId: vehicle.id, dealershipId: vehicle.dealershipId };
  // Same automations as a website inquiry: round-robin (when unassigned) and the customer follow-up email.
  const created = await announce(() => emit("lead.created", refs));
  const assigned = assignee && !selfAssigned
    ? await announce(() => emit("lead.assigned", { ...refs, salespersonId: assignee.id, previousSalespersonId: null, changedBy: user.id }))
    : {};
  return { leadId, ...created, ...assigned };
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

/** Quick-find for global search: name, email or phone, within the caller's visible leads. */
export async function searchLeads(text: string, limit = 6) {
  const user = await requireRole();
  const search = escapeRegex(z.string().trim().min(1).max(120).parse(text));
  await connectDb();
  const documents = await LeadModel.find({ $or: ["name", "email", "phone"].map((field) => ({ [field]: { $regex: search, $options: "i" } })), ...scope(user) })
    .select("name email phone stage").sort({ createdAt: -1, _id: -1 }).limit(limit).lean().exec();
  return documents.map((document) => ({ id: document._id.toString(), name: document.name, email: document.email, phone: document.phone, stage: document.stage }));
}

export async function countLeadsSince(since: string, dealershipId?: string) {
  const user = await requireRole();
  await connectDb();
  return LeadModel.countDocuments({ createdAt: { $gte: new Date(since) }, ...(dealershipId ? { dealershipId: objectIdSchema.parse(dealershipId) } : {}), ...scope(user) }).exec();
}

/** Visible leads per current stage key, optionally only those received since an instant and at one location. */
export async function countLeadsByStage(input: { since?: string; dealershipId?: string } = {}): Promise<Record<string, number>> {
  const user = await requireRole();
  const filters = z.object({ since: z.string().datetime({ offset: true }).optional(), dealershipId: objectIdSchema.optional() }).parse(input);
  await connectDb();
  const { Types } = LeadModel.base;
  const rows = await LeadModel.aggregate<{ _id: string; count: number }>([
    { $match: {
      ...(filters.since ? { createdAt: { $gte: new Date(filters.since) } } : {}),
      ...(filters.dealershipId ? { dealershipId: new Types.ObjectId(filters.dealershipId) } : {}),
      ...(user.role === "owner" ? {} : { assignedTo: new Types.ObjectId(user.id) }),
    } },
    { $group: { _id: "$stage", count: { $sum: 1 } } },
  ]).exec();
  return Object.fromEntries(rows.map((row) => [row._id, row.count]));
}

/** Newest activity across visible leads (optionally at one location), newest first. */
export async function listRecentLeadActivity(limit = 10, dealershipId?: string) {
  const user = await requireRole();
  await connectDb();
  const { Types } = LeadModel.base;
  const match = { ...(user.role === "owner" ? {} : { assignedTo: new Types.ObjectId(user.id) }), ...(dealershipId ? { dealershipId: new Types.ObjectId(objectIdSchema.parse(dealershipId)) } : {}) };
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

export type AssignmentResult =
  | { kind: "manual" } | { kind: "already_assigned"; salespersonId: string } | { kind: "no_staff" }
  | { kind: "assigned"; salespersonId: string; salespersonName: string } | { kind: "taken" };
/** Atomic per-dealership cursor works across processes, including concurrent inquiries. */
export async function assignCreatedLead(event: AppEvent<"lead.created">): Promise<AssignmentResult> {
  const settings = await getSettings();
  if (settings.leadAssignmentStrategy === "manual") return { kind: "manual" };
  const lead = await getLeadForAutomation(event.payload.leadId);
  if (lead.assignedTo) return { kind: "already_assigned", salespersonId: lead.assignedTo };
  const staff = await listAutomationStaff(lead.dealershipId);
  if (!staff.length) return { kind: "no_staff" }; // Keep unassigned for the owner; still send customer follow-up.
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
  if (!result.modifiedCount) return { kind: "taken" };
  // The assignment is saved; the alert recipe records its own outcome, so its failure is not this one's.
  try {
    await emit("lead.assigned", { leadId: lead.id, vehicleId: lead.vehicleId, dealershipId: lead.dealershipId, salespersonId: salesperson.id, previousSalespersonId: null });
  } catch { console.error("Lead assigned; lead.assigned handler failed.", { leadId: lead.id }); }
  return { kind: "assigned", salespersonId: salesperson.id, salespersonName: salesperson.name };
}

/** Internal reminder read: first-stage leads with no recorded contact, created at or before `before`, oldest first. */
export async function listUncontactedLeadsForAutomation(before: string) {
  const cutoff = new Date(z.string().datetime({ offset: true }).parse(before));
  const settings = await getSettings();
  await connectDb();
  const documents = await LeadModel.find({ firstContactedAt: null, stage: firstStageKey(settings), createdAt: { $lte: cutoff } })
    .select("-activity").sort({ createdAt: 1, _id: 1 }).limit(500).lean().exec();
  return documents.map(toStaffLead);
}

/** Internal: leads older than `before` that have not booked yet (stage before the appointment stage, not won or lost). */
export async function listUnbookedLeadIdsForAutomation(before: string) {
  const cutoff = new Date(z.string().datetime({ offset: true }).parse(before));
  const settings = await getSettings();
  const booked = settings.leadStages.find((stage) => stage.key === settings.booking.appointmentStageKey)?.order ?? Infinity;
  const open = settings.leadStages.filter((stage) => stage.order < booked && stage.key !== settings.wonStageKey && stage.key !== settings.lostStageKey).map((stage) => stage.key);
  await connectDb();
  const documents = await LeadModel.find({ stage: { $in: open }, createdAt: { $lte: cutoff } }).select("_id createdAt").sort({ createdAt: 1, _id: 1 }).limit(500).lean().exec();
  return documents.map((document) => ({ id: String(document._id), createdAt: new Date(document.createdAt as Date).toISOString() }));
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
  const stage = firstStageKey(settings);
  const source = settings.publicInquirySourceKey;
  if (!settings.leadSources.some((entry) => entry.key === source)) throw new Error("Public inquiry source is not a configured lead source.");
  const record = leadInputSchema.parse({ ...data, dealershipId: vehicle.dealershipId, stage, source,
    assignedTo: null, bookingToken: randomBytes(32).toString("base64url"),
    activity: [{ type: "lead.created", message: data.utmSource ? inquiryCopy.activityVia(data.utmSource) : inquiryCopy.activity, occurredAt: new Date().toISOString(), actorId: null }],
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

export type BookingStageResult = { moved: boolean; stageLabel: string | null };
/** Moves a booked lead forward to the configured stage, never backward, with an audit entry. */
export async function advanceLeadForBooking(leadId: string, stageKey: string, actorId: string | null = null): Promise<BookingStageResult> {
  const id = objectIdSchema.parse(leadId);
  const { leadStages } = await getSettings();
  const target = leadStages.find((entry) => entry.key === stageKey);
  if (!target) return { moved: false, stageLabel: null };
  await connectDb();
  const lead = await LeadModel.findById(id).select("stage").lean().exec();
  const current = leadStages.find((entry) => entry.key === lead?.stage);
  if (!lead || !current || current.order >= target.order) return { moved: false, stageLabel: target.label };
  // A null actor is the customer's own online booking; staff booking for the customer passes their ID.
  const activity = activitySchema.parse({ type: "lead.stage_changed", occurredAt: new Date().toISOString(), actorId: objectIdSchema.nullable().parse(actorId),
    message: `Stage changed from ${current.label} to ${target.label}.` });
  // Conditional on the stage just read, so a concurrent staff change wins.
  const result = await LeadModel.updateOne({ _id: id, stage: current.key }, { $set: { stage: target.key }, $push: { activity } }).exec();
  return { moved: result.modifiedCount > 0, stageLabel: target.label };
}

/** Vehicle detail respects the assignment boundary of the leads UI. */
export async function listVehicleLeads(vehicleId: string) {
  const user = await requireRole();
  const id = objectIdSchema.parse(vehicleId);
  await connectDb();
  const documents = await LeadModel.find({ vehicleId: id, ...(user.role === "owner" ? {} : { assignedTo: user.id }) })
    .select("name email phone stage assignedTo").sort({ createdAt: -1 }).lean().exec();
  return documents.map((document) => ({ id: document._id.toString(), name: document.name, email: document.email, phone: document.phone, stage: document.stage,
    assignedTo: document.assignedTo?.toString() ?? null }));
}

/** Lead counts per vehicle for the inventory board, within the caller's visible leads. */
export async function countLeadsByVehicle(vehicleIds: string[]) {
  const user = await requireRole();
  const ids = z.array(objectIdSchema).parse(vehicleIds);
  if (!ids.length) return {} as Record<string, number>;
  await connectDb();
  const { Types } = LeadModel.base;
  const rows = await LeadModel.aggregate<{ _id: { toString(): string }; count: number }>([
    { $match: { vehicleId: { $in: ids.map((id) => new Types.ObjectId(id)) }, ...(user.role === "owner" ? {} : { assignedTo: new Types.ObjectId(user.id) }) } },
    { $group: { _id: "$vehicleId", count: { $sum: 1 } } },
  ]).exec();
  return Object.fromEntries(rows.map((row) => [row._id.toString(), row.count])) as Record<string, number>;
}

export type SalespersonLeadStats = { open: number; won: number; lost: number; workingVehicles: number };
/**
 * Per-salesperson lead counts. Open = any stage except the won and lost stages; working vehicles are the
 * distinct cars on open leads. Salespeople only see their own figures.
 */
export async function summarizeLeadsBySalesperson(): Promise<Record<string, SalespersonLeadStats>> {
  const user = await requireRole();
  const settings = await getSettings();
  await connectDb();
  const { Types } = LeadModel.base;
  const rows = await LeadModel.aggregate<{ _id: { assignedTo: { toString(): string }; stage: string }; count: number; vehicles: { toString(): string }[] }>([
    { $match: user.role === "owner" ? { assignedTo: { $ne: null } } : { assignedTo: new Types.ObjectId(user.id) } },
    { $group: { _id: { assignedTo: "$assignedTo", stage: "$stage" }, count: { $sum: 1 }, vehicles: { $addToSet: "$vehicleId" } } },
  ]).exec();
  const stats: Record<string, SalespersonLeadStats & { vehicles: Set<string> }> = {};
  for (const row of rows) {
    const entry = stats[row._id.assignedTo.toString()] ??= { open: 0, won: 0, lost: 0, workingVehicles: 0, vehicles: new Set() };
    if (row._id.stage === settings.wonStageKey) entry.won += row.count;
    else if (row._id.stage === settings.lostStageKey) entry.lost += row.count;
    else { entry.open += row.count; for (const vehicle of row.vehicles) entry.vehicles.add(vehicle.toString()); }
  }
  return Object.fromEntries(Object.entries(stats).map(([id, { vehicles, ...entry }]) => [id, { ...entry, workingVehicles: vehicles.size }]));
}

/** Every lead assigned to one salesperson, newest first (owner, or the salesperson themselves). */
export async function listLeadsForSalesperson(salespersonId: string, limit = 300) {
  const user = await requireRole();
  const id = objectIdSchema.parse(salespersonId);
  if (user.role !== "owner" && user.id !== id) return [];
  await connectDb();
  const documents = await LeadModel.find({ assignedTo: id }).sort({ createdAt: -1, _id: -1 }).limit(limit).lean().exec();
  return documents.map(toStaffLead);
}

/** `vehicle.sold` handler: the lead linked to the sale moves to the won stage, with the owner as the actor. */
export async function winLeadForSale(event: AppEvent<"vehicle.sold">) {
  const { linkedLeadId, vehicleId, changedBy } = event.payload;
  if (!linkedLeadId) return;
  const settings = await getSettings();
  const won = settings.leadStages.find((entry) => entry.key === settings.wonStageKey);
  if (!won) return;
  await connectDb();
  const lead = await LeadModel.findOne({ _id: objectIdSchema.parse(linkedLeadId), vehicleId: objectIdSchema.parse(vehicleId) }).select("stage dealershipId").lean().exec();
  if (!lead || lead.stage === won.key) return;
  // Conditional on the stage just read, so a concurrent staff change wins.
  const result = await LeadModel.updateOne({ _id: linkedLeadId, stage: lead.stage }, { $set: { stage: won.key } }).exec();
  if (result.modifiedCount) await emit("lead.stage_changed", { leadId: linkedLeadId, vehicleId, dealershipId: lead.dealershipId.toString(),
    previousStage: lead.stage, stage: won.key, changedBy });
}

/** Destructive internal CLI import only; never expose through a server action. */
export async function replaceLeadsForSeed(input: unknown) {
  // Seeded leads may carry a historical `createdAt`; Mongoose keeps a value supplied on insert.
  const records = z.array(leadSchema.extend({ createdAt: z.string().datetime({ offset: true }).optional() })).parse(input);
  const settings = await getSettings();
  const keys = new Set(settings.leadStages.map((entry) => entry.key));
  const sources = new Set(settings.leadSources.map((entry) => entry.key));
  for (const record of records) {
    if (!keys.has(record.stage) || !sources.has(record.source)) {
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
