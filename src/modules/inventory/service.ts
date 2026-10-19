import "server-only";
import { escapeRegex } from "@/lib/regex";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { getSettings } from "@/modules/settings/service";
import { VehicleModel } from "./model";
import { vehicleSchema, vehicleFormSchema, vehicleUpdateSchema, statusChangeSchema, priceChangeSchema, inventoryFilterSchema, type InventoryVehicle, type VehicleForm } from "./schema";
import { requireRole } from "@/modules/auth/service";
import { listDealerships, listPublicDealerships } from "@/modules/dealerships/service";
import { publicVehicleSchema, publicInventoryFilterSchema, type PublicBadge, type PublicListing } from "./schema";
import { objectIdSchema } from "@/lib/data-schema";
import { emit, type EventName, type EventPayloads } from "@/lib/events";
import { activitySchema } from "@/lib/activity-schema";
import { startOfLocalMonth } from "@/modules/appointments/slots";
import { getGarage } from "@/modules/garages/service";
import { listVehicleLeads } from "@/modules/leads/service";
import { findActiveUser } from "@/modules/users/service";
import type { Settings } from "@/modules/settings/schema";
import { repairStartSchema, repairCompleteSchema, saleInputSchema, salesQuerySchema, type Vehicle, type VehicleWorkflow } from "./schema";
import { inventoryCopy } from "./copy";

/** Internal event context: includes hidden vehicles, but never invokes a staff session. */
export async function getVehicleForAutomation(id: string) {
  await connectDb();
  const document = await VehicleModel.findById(objectIdSchema.parse(id)).select(publicFields).lean().exec();
  if (!document) throw new Error("Automation vehicle missing.");
  return toPublicVehicle(document);
}

export async function appendVehicleActivity(id: string, input: unknown) {
  const activity = activitySchema.parse(input);
  await connectDb();
  await VehicleModel.updateOne({ _id: objectIdSchema.parse(id), ...(activity.eventId ? { "activity.eventId": { $ne: activity.eventId } } : {}) }, { $push: { activity } }).exec();
}

export class InventoryError extends Error {}
/** A status change that must go through a workflow sheet (repair, completion, sale) rather than a plain edit. */
export class WorkflowRequiredError extends InventoryError {
  constructor(message: string, public readonly workflow: VehicleWorkflow | null) { super(message); }
}
const errors = inventoryCopy.errors;
const publicFields = "stockNo vin year make model trim mileage price status dealershipId photos";
function toPublicVehicle(document: unknown) {
  const value = JSON.parse(JSON.stringify(document));
  return publicVehicleSchema.parse(Object.fromEntries(Object.keys(publicVehicleSchema.shape).map((key) => [key, key === "id" ? value._id : value[key]])));
}
// Public badges: a price cut in the last 30 days wins over a car acquired in the last 14 days.
const PRICE_DROP_DAYS = 30;
const NEW_ARRIVAL_DAYS = 14;
const listingFields = `${publicFields} dateInStock priceHistory`;
function toPublicListing(document: unknown, now: number): PublicListing {
  const { dateInStock, priceHistory } = JSON.parse(JSON.stringify(document)) as { dateInStock?: string; priceHistory?: { previousPrice: number; price: number; changedAt: string }[] };
  const lastChange = priceHistory?.at(-1);
  const badge: PublicBadge | null = lastChange && lastChange.price < lastChange.previousPrice && now - Date.parse(lastChange.changedAt) <= PRICE_DROP_DAYS * 86_400_000 ? "price_drop"
    : dateInStock && now - Date.parse(dateInStock) <= NEW_ARRIVAL_DAYS * 86_400_000 ? "new_arrival" : null;
  return { ...toPublicVehicle(document), badge };
}
async function publicQuery() {
  const [settings, dealerships] = await Promise.all([getSettings(), listPublicDealerships()]);
  return {
    status: { $in: settings.publicInventoryStatusKeys.filter((key) => settings.vehicleStatuses.some((status) => status.key === key)) },
    dealershipId: { $in: dealerships.map((dealership) => dealership.id) },
  };
}
export async function listPublicVehicles(input: unknown = {}) {
  const filters = publicInventoryFilterSchema.parse(input);
  const query = await publicQuery();
  if (filters.dealershipId) query.dealershipId.$in = query.dealershipId.$in.filter((id) => id === filters.dealershipId);
  const total = await VehicleModel.countDocuments(query).exec();
  const pageCount = Math.max(1, Math.ceil(total / 24));
  const page = Math.min(filters.page, pageCount);
  const documents = await VehicleModel.find(query).select(listingFields).sort({ dateInStock: -1, _id: 1 }).skip((page - 1) * 24).limit(24).lean().exec();
  const now = Date.now();
  return { vehicles: documents.map((document) => toPublicListing(document, now)), total, page, pageCount };
}
/** Publicly visible vehicles per public location, for the location chips. */
export async function countPublicVehiclesByDealership() {
  const query = await publicQuery();
  await connectDb();
  const rows = await VehicleModel.aggregate<{ _id: { toString(): string }; count: number }>([
    { $match: { status: query.status, dealershipId: { $in: query.dealershipId.$in.map((id) => new VehicleModel.base.Types.ObjectId(id)) } } },
    { $group: { _id: "$dealershipId", count: { $sum: 1 } } },
  ]).exec();
  return Object.fromEntries(rows.map((row) => [row._id.toString(), row.count])) as Record<string, number>;
}
/** Visibility is checked on direct links and again at inquiry submission. */
export async function getPublicVehicle(id: string) {
  if (!objectIdSchema.safeParse(id).success) return null;
  const query = await publicQuery();
  const document = await VehicleModel.findOne({ ...query, _id: id }).select(listingFields).lean().exec();
  return document ? toPublicListing(document, Date.now()) : null;
}
export type InventoryMutation = { vehicle: InventoryVehicle; warning?: string };
/** Acquisition cost is owner-only; every other staff member receives null. */
function toVehicle(document: unknown, owner: boolean): InventoryVehicle {
  const { _id, __v, createdAt, updatedAt, ...data } = JSON.parse(JSON.stringify(document));
  void createdAt; void updatedAt;
  const vehicle = vehicleSchema.parse({ ...data, id: _id });
  return { ...vehicle, acquisitionCost: owner ? vehicle.acquisitionCost : null, revision: __v ?? 0 };
}
function editable(vehicle: InventoryVehicle) {
  return vehicleFormSchema.parse(Object.fromEntries(Object.keys(vehicleFormSchema.shape).map((key) => [key, vehicle[key as keyof InventoryVehicle] ?? undefined])));
}
const DAY_MS = 86_400_000;
/** The board shows every matching car in its groups, so it is capped rather than paginated. */
const BOARD_LIMIT = 400;
export async function listVehicles(input: unknown = {}) {
  const user = await requireRole();
  const filters = inventoryFilterSchema.parse(input);
  const settings = await getSettings();
  await connectDb();
  const now = Date.now();
  const sold = settings.statusRoles.sold;
  const search = escapeRegex(filters.q);
  const conditions: Record<string, unknown>[] = [
    ...(filters.dealershipId ? [{ dealershipId: filters.dealershipId }] : []),
    ...(filters.status ? [{ status: filters.status }] : []),
    ...(filters.repairType ? [{ "repair.typeKey": filters.repairType }] : []),
    ...(filters.garageId ? [{ "repair.garageId": filters.garageId }] : []),
    ...(filters.aging ? [{ status: { $ne: sold }, dateInStock: { $lte: new Date(now - settings.inventoryAging.warnDays * DAY_MS) } }] : []),
    // Whole days in stock within [minDays, maxDays], matching the board's day counter.
    ...(filters.minDays !== undefined || filters.maxDays !== undefined ? [{ status: { $ne: sold }, sale: null, dateInStock: {
      ...(filters.minDays !== undefined ? { $lte: new Date(now - filters.minDays * DAY_MS) } : {}),
      ...(filters.maxDays !== undefined ? { $gt: new Date(now - (filters.maxDays + 1) * DAY_MS) } : {}),
    } }] : []),
    ...(filters.soldBy ? [{ "sale.salespersonId": filters.soldBy }] : []),
    ...(search ? [{ $or: ["make", "model", "stockNo", "vin"].map((field) => ({ [field]: { $regex: search, $options: "i" } })) }] : []),
    // Older sales stay out of the working board unless asked for; a sold car without a sale record still shows.
    ...(filters.sold === "month" ? [{ $or: [{ status: { $ne: sold } }, { sale: null }, { "sale.soldAt": { $gte: new Date(startOfLocalMonth(now, settings.booking.timeZone)) } }] }] : []),
  ];
  const query = conditions.length ? { $and: conditions } : {};
  const [total, documents] = await Promise.all([
    VehicleModel.countDocuments(query).exec(),
    VehicleModel.find(query).sort({ dateInStock: -1, _id: 1 }).limit(BOARD_LIMIT).lean().exec(),
  ]);
  // One capped page: `page`/`pageCount` stay for callers written against the paginated list.
  return { vehicles: documents.map((document) => toVehicle(document, user.role === "owner")), total, truncated: total > documents.length, page: 1, pageCount: 1 };
}

export type SaleRecord = {
  vehicleId: string; stockNo: string; year: number; make: string; model: string; trim: string; photo: string | null; dealershipId: string;
  salespersonId: string; leadId: string | null; price: number; commission: number; soldAt: string;
};
/**
 * Recorded sales, newest first, optionally within [from, to) and for one salesperson.
 * Salespeople only ever receive their own sales.
 */
export async function listSales(input: unknown = {}): Promise<SaleRecord[]> {
  const user = await requireRole();
  const filters = salesQuerySchema.parse(input);
  const person = user.role === "owner" ? filters.salespersonId : user.id;
  await connectDb();
  const soldAt = { ...(filters.from ? { $gte: new Date(filters.from) } : {}), ...(filters.to ? { $lt: new Date(filters.to) } : {}) };
  const documents = await VehicleModel.find({ sale: { $ne: null }, ...(Object.keys(soldAt).length ? { "sale.soldAt": soldAt } : {}), ...(person ? { "sale.salespersonId": person } : {}) })
    .select("stockNo year make model trim photos dealershipId sale").sort({ "sale.soldAt": -1, _id: 1 }).limit(filters.limit).lean().exec();
  return documents.flatMap((document) => {
    const { _id, stockNo, year, make, model, trim, photos, dealershipId, sale } = JSON.parse(JSON.stringify(document));
    if (!sale) return [];
    return [{ vehicleId: _id, stockNo, year, make, model, trim: trim ?? "", photo: photos?.[0] ?? null, dealershipId,
      salespersonId: sale.salespersonId, leadId: sale.leadId ?? null, price: sale.price, commission: sale.commission, soldAt: new Date(sale.soldAt).toISOString() }];
  });
}

/** Cars at a garage right now, for the garages board. */
export async function listVehiclesInRepair() {
  await requireRole("owner");
  await connectDb();
  const documents = await VehicleModel.find({ repair: { $ne: null } }).sort({ "repair.startedAt": 1, _id: 1 }).lean().exec();
  return documents.map((document) => toVehicle(document, true));
}

export type ReminderVehicle = {
  id: string; stockNo: string; year: number; make: string; model: string; trim: string; dealershipId: string; dateInStock: string;
  repair: { typeKey: string; garageId: string; startedAt: string } | null;
};
function toReminderVehicle(document: unknown): ReminderVehicle {
  const { _id, stockNo, year, make, model, trim, dealershipId, dateInStock, repair } = JSON.parse(JSON.stringify(document));
  return { id: _id, stockNo, year, make, model, trim: trim ?? "", dealershipId, dateInStock,
    repair: repair ? { typeKey: repair.typeKey, garageId: repair.garageId, startedAt: repair.startedAt } : null };
}
const reminderFields = "stockNo year make model trim dealershipId dateInStock repair";
/**
 * Internal reminder reads (no staff session): unsold cars in stock since at or before `agedBefore`, and cars
 * at a garage since at or before `repairBefore`, oldest first.
 */
export async function listReminderVehiclesForAutomation(agedBefore: string, repairBefore: string) {
  const [aged, repair] = z.array(z.string().datetime({ offset: true })).parse([agedBefore, repairBefore]).map((value) => new Date(value));
  const settings = await getSettings();
  await connectDb();
  const [aging, overdue] = await Promise.all([
    VehicleModel.find({ status: { $ne: settings.statusRoles.sold }, sale: null, dateInStock: { $lte: aged } }).select(reminderFields).sort({ dateInStock: 1, _id: 1 }).limit(BOARD_LIMIT).lean().exec(),
    VehicleModel.find({ repair: { $ne: null }, "repair.startedAt": { $lte: repair } }).select(reminderFields).sort({ "repair.startedAt": 1, _id: 1 }).limit(BOARD_LIMIT).lean().exec(),
  ]);
  return { aging: aging.map(toReminderVehicle), overdue: overdue.map(toReminderVehicle) };
}

/** Needs-attention counts for any staff member: aging stock (over the warn and critical ages) and overdue repairs. */
export async function getInventoryAttention(now: number, dealershipId?: string) {
  const user = await requireRole();
  const settings = await getSettings();
  await connectDb();
  // Owners may narrow to one location; salespeople always get their own.
  const location = user.role === "owner" ? (dealershipId ? { dealershipId: objectIdSchema.parse(dealershipId) } : {}) : { dealershipId: user.dealershipId };
  const unsold = { status: { $ne: settings.statusRoles.sold }, sale: null, ...location };
  const before = (days: number) => new Date(now - days * DAY_MS);
  const [aging, critical, overdue] = await Promise.all([
    VehicleModel.countDocuments({ ...unsold, dateInStock: { $lte: before(settings.inventoryAging.warnDays) } }).exec(),
    VehicleModel.countDocuments({ ...unsold, dateInStock: { $lte: before(settings.inventoryAging.criticalDays) } }).exec(),
    VehicleModel.countDocuments({ repair: { $ne: null }, "repair.startedAt": { $lte: before(settings.repairOverdueDays) }, ...location }).exec(),
  ]);
  return { aging, critical, overdue };
}

/** Completed repair spend per garage since an instant (e.g. the start of this month). */
export async function summarizeRepairSpend(since: string) {
  await requireRole("owner");
  const from = new Date(z.string().datetime({ offset: true }).parse(since));
  await connectDb();
  const rows = await VehicleModel.aggregate<{ _id: { toString(): string }; cost: number; count: number }>([
    { $match: { "repairHistory.completedAt": { $gte: from } } }, { $unwind: "$repairHistory" },
    { $match: { "repairHistory.completedAt": { $gte: from } } },
    { $group: { _id: "$repairHistory.garageId", cost: { $sum: "$repairHistory.cost" }, count: { $sum: 1 } } },
  ]).exec();
  return rows.map((row) => ({ garageId: row._id.toString(), cost: row.cost, count: row.count }));
}
/** Quick-find for global search: stock #, make, model or VIN. Every staff member may read inventory. */
export async function searchVehicles(text: string, limit = 6) {
  await requireRole();
  const search = escapeRegex(z.string().trim().min(1).max(120).parse(text));
  await connectDb();
  const documents = await VehicleModel.find({ $or: ["stockNo", "make", "model", "vin"].map((field) => ({ [field]: { $regex: search, $options: "i" } })) })
    .select(publicFields).sort({ dateInStock: -1, _id: 1 }).limit(limit).lean().exec();
  return documents.map(toPublicVehicle);
}
export async function getVehicle(id: string) {
  const user = await requireRole();
  if (!objectIdSchema.safeParse(id).success) return null;
  await connectDb();
  const document = await VehicleModel.findById(id).lean().exec();
  return document ? toVehicle(document, user.role === "owner") : null;
}
/** Display fields for lead/appointment screens. Every staff member may read inventory. */
export async function getVehicleSummaries(ids: string[]) {
  await requireRole();
  const valid = z.array(objectIdSchema).parse(ids);
  if (!valid.length) return [];
  await connectDb();
  const documents = await VehicleModel.find({ _id: { $in: valid } }).select(publicFields).lean().exec();
  return documents.map(toPublicVehicle);
}

/**
 * Cars a staff member can log a new lead for: everything not sold, newest stock first. Salespeople only
 * get cars at their own location, because the leads they enter are assigned to them.
 */
export async function listVehicleChoices() {
  const user = await requireRole();
  const settings = await getSettings();
  await connectDb();
  const documents = await VehicleModel.find({ status: { $ne: settings.statusRoles.sold }, ...(user.role === "owner" ? {} : { dealershipId: user.dealershipId }) })
    .select(publicFields).sort({ stockNo: 1, _id: 1 }).limit(BOARD_LIMIT).lean().exec();
  return documents.map(toPublicVehicle);
}

/** Newest vehicle activity (status/price changes) across all stock or one location, newest first. */
export async function listRecentVehicleActivity(limit = 10, dealershipId?: string) {
  await requireRole();
  await connectDb();
  const match = dealershipId ? [{ $match: { dealershipId: new VehicleModel.base.Types.ObjectId(objectIdSchema.parse(dealershipId)) } }] : [];
  const rows = await VehicleModel.aggregate<{ _id: unknown; year: number; make: string; model: string; stockNo: string; activity: { type: string; message: string; occurredAt: Date; actorId: unknown } }>([
    ...match, { $unwind: "$activity" }, { $sort: { "activity.occurredAt": -1 } }, { $limit: limit },
    { $project: { year: 1, make: 1, model: 1, stockNo: 1, activity: 1 } },
  ]).exec();
  return rows.map((row) => ({ vehicleId: String(row._id), name: `${row.year} ${row.make} ${row.model}`, stockNo: row.stockNo, type: row.activity.type,
    message: row.activity.message, occurredAt: new Date(row.activity.occurredAt).toISOString(), actorId: row.activity.actorId ? String(row.activity.actorId) : null }));
}

/** Global stock summary deliberately does not change with the list filters. */
export async function getInventorySummary() {
  await requireRole();
  await connectDb();
  const rows = await VehicleModel.aggregate<{ _id: { dealershipId: { toString(): string }; status: string }; count: number }>([
    { $group: { _id: { dealershipId: "$dealershipId", status: "$status" }, count: { $sum: 1 } } },
  ]).exec();
  return rows.map((row) => ({ dealershipId: row._id.dealershipId.toString(), status: row._id.status, count: row.count }));
}
/** Owner settings screen: which of these status and repair type keys are still used by any vehicle (current or history). */
export async function findVehicleKeysInUse(input: { statuses: string[]; repairTypes: string[] }) {
  await requireRole("owner");
  const keys = z.object({ statuses: z.array(z.string().max(80)), repairTypes: z.array(z.string().max(80)) }).parse(input);
  await connectDb();
  const [statuses, current, history] = await Promise.all([
    keys.statuses.length ? VehicleModel.distinct("status", { status: { $in: keys.statuses } }).exec() : [],
    keys.repairTypes.length ? VehicleModel.distinct("repair.typeKey", { "repair.typeKey": { $in: keys.repairTypes } }).exec() : [],
    keys.repairTypes.length ? VehicleModel.distinct("repairHistory.typeKey", { "repairHistory.typeKey": { $in: keys.repairTypes } }).exec() : [],
  ]);
  const wanted = new Set(keys.repairTypes);
  return { statuses: statuses.map(String), repairTypes: [...new Set([...current, ...history].map(String))].filter((key) => wanted.has(key)) };
}

export type StockRow = { status: string; dealershipId: string; price: number; dateInStock: string; soldAt: string | null };
/**
 * Dashboard stock snapshot: every unsold car plus cars sold since `soldSince` (the same "sold this month" rule as the
 * board), optionally at one location. Salespeople only get their own location.
 */
export async function listStockSnapshot(soldSince: string, dealershipId?: string): Promise<StockRow[]> {
  const user = await requireRole();
  const since = new Date(z.string().datetime({ offset: true }).parse(soldSince));
  const location = user.role === "owner" ? (dealershipId ? { dealershipId: objectIdSchema.parse(dealershipId) } : {}) : { dealershipId: user.dealershipId };
  const settings = await getSettings();
  await connectDb();
  const documents = await VehicleModel.find({
    ...location,
    $or: [{ status: { $ne: settings.statusRoles.sold } }, { sale: null }, { "sale.soldAt": { $gte: since } }],
  }).select("status dealershipId price dateInStock sale.soldAt").lean().exec();
  return documents.map((document) => {
    const { status, dealershipId: dealership, price, dateInStock, sale } = JSON.parse(JSON.stringify(document));
    return { status, dealershipId: dealership, price, dateInStock, soldAt: sale?.soldAt ?? null };
  });
}
async function validateReferences(data: VehicleForm, previous?: InventoryVehicle) {
  const [settings, dealerships] = await Promise.all([getSettings(), listDealerships()]);
  if (!settings.vehicleStatuses.some((entry) => entry.key === data.status) && data.status !== previous?.status) {
    throw new InventoryError("Choose a configured vehicle status.");
  }
  const dealership = dealerships.find((entry) => entry.id === data.dealershipId);
  if (!dealership || (!dealership.active && data.dealershipId !== previous?.dealershipId)) {
    throw new InventoryError("Choose an active dealership.");
  }
}
function duplicateError(error: unknown): never {
  if (error instanceof Error && "code" in error && error.code === 11000) throw new InventoryError("That stock number or VIN is already in use.");
  throw error;
}
export async function createVehicle(input: unknown): Promise<InventoryMutation> {
  await requireRole("owner");
  const data = vehicleFormSchema.parse(input);
  await validateReferences(data);
  await connectDb();
  try {
    const document = await VehicleModel.create({ ...data, priceHistory: [], statusHistory: [] });
    return { vehicle: toVehicle(document.toObject(), true) };
  } catch (error) { return duplicateError(error); }
}
/** One compare-and-swap writes fields, history and revision together. */
async function persistChange(previous: InventoryVehicle, revision: number, input: VehicleForm, actor: string): Promise<InventoryMutation> {
  if (previous.revision !== revision) throw new InventoryError(errors.stale);
  // Omitted cost/commission keep their stored values (owner-only path, so the cost is never redacted here).
  const data = { ...input, acquisitionCost: input.acquisitionCost ?? previous.acquisitionCost ?? 0, commission: input.commission ?? previous.commission };
  if (JSON.stringify(editable(previous)) === JSON.stringify(editable({ ...previous, ...data }))) return { vehicle: previous };
  const statusChanged = data.status !== previous.status;
  if (statusChanged) guardStatusChange(previous, data.status, await getSettings());
  const priceChanged = data.price !== previous.price;
  const changedAt = new Date().toISOString();
  const priceHistory = [...previous.priceHistory, ...(priceChanged ? [{ previousPrice: previous.price, price: data.price, changedAt, changedBy: actor }] : [])];
  const statusHistory = [...previous.statusHistory, ...(statusChanged ? [{ previousStatus: previous.status, status: data.status, changedAt, changedBy: actor }] : [])];
  // Repair and sale records are server-owned and carried over unchanged.
  const validated = vehicleSchema.parse({ ...data, repair: previous.repair, repairHistory: previous.repairHistory, sale: previous.sale, priceHistory, statusHistory, id: previous.id });
  const { id, activity, ...fields } = validated;
  void activity; // Event handlers append independently; edits must never replace the log.
  let document;
  try {
    document = await VehicleModel.findOneAndUpdate({ _id: id, __v: revision }, { $set: fields, $inc: { __v: 1 } }, { returnDocument: "after", runValidators: true }).lean().exec();
  } catch (error) { return duplicateError(error); }
  if (!document) throw new InventoryError(errors.stale);
  const vehicle = toVehicle(document, true);
  const ref = { vehicleId: id, dealershipId: vehicle.dealershipId, changedBy: actor };
  const results = await Promise.allSettled([
    ...(statusChanged ? [emit("vehicle.status_changed", { ...ref, previousStatus: previous.status, status: vehicle.status })] : []),
    ...(priceChanged ? [emit("vehicle.price_changed", { ...ref, previousPrice: previous.price, price: vehicle.price })] : []),
  ]);
  // Persistence succeeded. Do not tell the user to repeat a committed write.
  return { vehicle, ...(results.some((result) => result.status === "rejected") ? { warning: "Saved, but a follow-up notification could not be delivered." } : {}) };
}
async function existingVehicle(id: string) {
  const vehicle = await getVehicle(id);
  if (!vehicle) throw new InventoryError(inventoryCopy.vehicleMissing);
  return vehicle;
}
export async function updateVehicle(input: unknown) {
  const user = await requireRole("owner");
  const { id, revision, data } = vehicleUpdateSchema.parse(input);
  const previous = await existingVehicle(id);
  await validateReferences(data, previous);
  return persistChange(previous, revision, data, user.id);
}
export async function changeStatus(input: unknown) {
  const user = await requireRole("owner");
  const { id, revision, status } = statusChangeSchema.parse(input);
  const previous = await existingVehicle(id);
  const settings = await getSettings();
  if (!settings.vehicleStatuses.some((entry) => entry.key === status)) throw new InventoryError("Choose a configured vehicle status.");
  return persistChange(previous, revision, { ...editable(previous), status }, user.id);
}
export async function changePrice(input: unknown) {
  const user = await requireRole("owner");
  const { id, revision, price } = priceChangeSchema.parse(input);
  const previous = await existingVehicle(id);
  return persistChange(previous, revision, { ...editable(previous), price }, user.id);
}

/** Repair and sold statuses carry records (garage, sale), so only their workflows may enter or leave them. */
function guardStatusChange(previous: InventoryVehicle, status: string, settings: Settings) {
  const roles = settings.statusRoles;
  if (previous.sale && previous.status === roles.sold) throw new WorkflowRequiredError(errors.soldLocked, null);
  if (previous.repair) throw new WorkflowRequiredError(errors.finishRepair, "complete-repair");
  if (status === roles.repair) throw new WorkflowRequiredError(errors.useRepair, "repair");
  if (status === roles.sold) throw new WorkflowRequiredError(errors.useSale, "sell");
}
/** The configured status for a workflow role; a settings gap is reported rather than guessed. */
function roleStatus(settings: Settings, role: keyof Settings["statusRoles"]) {
  const key = settings.statusRoles[role];
  if (!settings.vehicleStatuses.some((entry) => entry.key === key)) throw new InventoryError(errors.missingRole(role));
  return key;
}
type WorkflowEvent = Extract<EventName, "vehicle.repair_started" | "vehicle.repair_completed" | "vehicle.sold">;
type WorkflowFields = Pick<Vehicle, "status" | "repair" | "repairHistory" | "sale">;
/**
 * Compare-and-swap for repair and sale workflows: status, status history and the workflow record are written
 * together with the revision bump, then the workflow event is emitted.
 */
async function applyWorkflow<K extends WorkflowEvent>(previous: InventoryVehicle, revision: number, actor: string, next: Partial<WorkflowFields>,
  event: { name: K; payload: (vehicle: InventoryVehicle) => EventPayloads[K] }): Promise<InventoryMutation> {
  if (previous.revision !== revision) throw new InventoryError(errors.stale);
  const status = next.status ?? previous.status;
  const changedAt = new Date().toISOString();
  const statusHistory = [...previous.statusHistory, ...(status !== previous.status ? [{ previousStatus: previous.status, status, changedAt, changedBy: actor }] : [])];
  const { revision: current, ...stored } = previous;
  void current;
  // Validate the whole resulting record; acquisition cost is unredacted on this owner-only path.
  const validated = vehicleSchema.parse({ ...stored, acquisitionCost: stored.acquisitionCost ?? 0, ...next, status, statusHistory });
  const fields = { status: validated.status, statusHistory: validated.statusHistory, repair: validated.repair, repairHistory: validated.repairHistory, sale: validated.sale };
  const document = await VehicleModel.findOneAndUpdate({ _id: previous.id, __v: revision }, { $set: fields, $inc: { __v: 1 } }, { returnDocument: "after", runValidators: true }).lean().exec();
  if (!document) throw new InventoryError(errors.stale);
  const vehicle = toVehicle(document, true);
  try { await emit(event.name, event.payload(vehicle)); }
  catch { return { vehicle, warning: "Saved, but a follow-up notification could not be delivered." }; }
  return { vehicle };
}

/** Owner sends a car to a garage: status becomes the repair role and the repair timer starts. */
export async function sendToRepair(input: unknown) {
  const user = await requireRole("owner");
  const data = repairStartSchema.parse(input);
  const [previous, settings, garage] = await Promise.all([existingVehicle(data.id), getSettings(), getGarage(data.garageId)]);
  const status = roleStatus(settings, "repair");
  if (previous.sale && previous.status === settings.statusRoles.sold) throw new InventoryError(errors.soldLocked);
  if (previous.repair) throw new InventoryError(errors.alreadyInRepair);
  if (!settings.repairTypes.some((entry) => entry.key === data.typeKey)) throw new InventoryError(errors.unknownRepairType);
  if (!garage?.active) throw new InventoryError(errors.inactiveGarage);
  const repair = { typeKey: data.typeKey, garageId: garage.id, startedAt: new Date().toISOString(), estimatedCost: data.estimatedCost, notes: data.notes };
  return applyWorkflow(previous, data.revision, user.id, { status, repair }, { name: "vehicle.repair_started", payload: (vehicle) => ({
    vehicleId: vehicle.id, dealershipId: vehicle.dealershipId, changedBy: user.id, previousStatus: previous.status, status: vehicle.status,
    repairTypeKey: repair.typeKey, garageId: repair.garageId }) });
}

/** Owner closes the open repair with its final cost; the car returns to the available role. */
export async function completeRepair(input: unknown) {
  const user = await requireRole("owner");
  const data = repairCompleteSchema.parse(input);
  const [previous, settings] = await Promise.all([existingVehicle(data.id), getSettings()]);
  const status = roleStatus(settings, "available");
  const repair = previous.repair;
  if (!repair) throw new InventoryError(errors.notInRepair);
  const completedAt = new Date(Math.max(Date.now(), Date.parse(repair.startedAt))).toISOString();
  const entry = { typeKey: repair.typeKey, garageId: repair.garageId, startedAt: repair.startedAt, completedAt, cost: data.cost, completedBy: user.id };
  return applyWorkflow(previous, data.revision, user.id, { status, repair: null, repairHistory: [...previous.repairHistory, entry] }, { name: "vehicle.repair_completed", payload: (vehicle) => ({
    vehicleId: vehicle.id, dealershipId: vehicle.dealershipId, changedBy: user.id, previousStatus: previous.status, status: vehicle.status,
    repairTypeKey: entry.typeKey, garageId: entry.garageId, cost: entry.cost, startedAt: entry.startedAt }) });
}

/** Owner records a sale: the car's commission is snapshotted for the salesperson and the linked lead is won (by event). */
export async function markSold(input: unknown) {
  const user = await requireRole("owner");
  const data = saleInputSchema.parse(input);
  const [previous, settings, salesperson] = await Promise.all([existingVehicle(data.id), getSettings(), findActiveUser(data.salespersonId)]);
  const status = roleStatus(settings, "sold");
  if (previous.sale || previous.status === status) throw new InventoryError(errors.soldLocked);
  if (previous.repair) throw new InventoryError(errors.finishRepair);
  if (!salesperson || salesperson.role !== "salesperson" || salesperson.dealershipId !== previous.dealershipId) throw new InventoryError(errors.invalidSalesperson);
  if (data.leadId && !(await listVehicleLeads(previous.id)).some((lead) => lead.id === data.leadId)) throw new InventoryError(errors.invalidLead);
  const sale = { salespersonId: salesperson.id, leadId: data.leadId, price: data.price, commission: previous.commission, soldAt: new Date().toISOString(), recordedBy: user.id };
  return applyWorkflow(previous, data.revision, user.id, { status, sale }, { name: "vehicle.sold", payload: (vehicle) => ({
    vehicleId: vehicle.id, dealershipId: vehicle.dealershipId, changedBy: user.id, previousStatus: previous.status, status: vehicle.status,
    salespersonId: sale.salespersonId, linkedLeadId: sale.leadId, price: sale.price, commission: sale.commission }) });
}

/** Destructive internal CLI import only; never expose through a server action. */
export async function replaceVehiclesForSeed(input: unknown) {
  const records = z.array(vehicleSchema).parse(input);
  const settings = await getSettings();
  const keys = new Set(settings.vehicleStatuses.map((entry) => entry.key));
  const repairTypes = new Set(settings.repairTypes.map((entry) => entry.key));
  for (const record of records) {
    if (!keys.has(record.status) || record.statusHistory.some((entry) => !keys.has(entry.status) || !keys.has(entry.previousStatus))
      || (record.repair && !repairTypes.has(record.repair.typeKey)) || record.repairHistory.some((entry) => !repairTypes.has(entry.typeKey))) {
      throw new Error("Record references an unknown settings key.");
    }
  }
  await connectDb();
  await VehicleModel.init();
  const documents = records.map(({ id, ...data }) => new VehicleModel({ _id: id, ...data }));
  // Validate all documents before clearing this collection.
  for (const document of documents) await document.validate();
  await VehicleModel.deleteMany({}).exec();
  if (documents.length) await VehicleModel.insertMany(documents);
  return documents.length;
}
