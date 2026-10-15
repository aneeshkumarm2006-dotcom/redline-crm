import "server-only";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { getSettings } from "@/modules/settings/service";
import { VehicleModel } from "./model";
import { vehicleSchema, vehicleFormSchema, vehicleUpdateSchema, statusChangeSchema, priceChangeSchema, inventoryFilterSchema, type InventoryVehicle, type VehicleForm } from "./schema";
import { requireRole } from "@/modules/auth/service";
import { listDealerships, listPublicDealerships } from "@/modules/dealerships/service";
import { publicVehicleSchema, publicInventoryFilterSchema } from "./schema";
import { objectIdSchema } from "@/lib/data-schema";
import { emit } from "@/lib/events";
import { activitySchema } from "@/lib/activity-schema";

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
const publicFields = "stockNo vin year make model trim mileage price status dealershipId photos";
function toPublicVehicle(document: unknown) {
  const value = JSON.parse(JSON.stringify(document));
  return publicVehicleSchema.parse(Object.fromEntries(Object.keys(publicVehicleSchema.shape).map((key) => [key, key === "id" ? value._id : value[key]])));
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
  const documents = await VehicleModel.find(query).select(publicFields).sort({ dateInStock: -1, _id: 1 }).skip((page - 1) * 24).limit(24).lean().exec();
  return { vehicles: documents.map(toPublicVehicle), total, page, pageCount };
}
/** Visibility is checked on direct links and again at inquiry submission. */
export async function getPublicVehicle(id: string) {
  if (!objectIdSchema.safeParse(id).success) return null;
  const query = await publicQuery();
  const document = await VehicleModel.findOne({ ...query, _id: id }).select(publicFields).lean().exec();
  return document ? toPublicVehicle(document) : null;
}
export type InventoryMutation = { vehicle: InventoryVehicle; warning?: string };
function toVehicle(document: unknown): InventoryVehicle {
  const { _id, __v, createdAt, updatedAt, ...data } = JSON.parse(JSON.stringify(document));
  void createdAt; void updatedAt;
  return { ...vehicleSchema.parse({ ...data, id: _id }), revision: __v ?? 0 };
}
function editable(vehicle: InventoryVehicle) {
  return vehicleFormSchema.parse(Object.fromEntries(Object.keys(vehicleFormSchema.shape).map((key) => [key, vehicle[key as keyof InventoryVehicle]])));
}
export async function listVehicles(input: unknown = {}) {
  await requireRole();
  const filters = inventoryFilterSchema.parse(input);
  await connectDb();
  const search = filters.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const query = {
    ...(filters.dealershipId ? { dealershipId: filters.dealershipId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(search ? { $or: ["make", "model", "stockNo"].map((field) => ({ [field]: { $regex: search, $options: "i" } })) } : {}),
  };
  const total = await VehicleModel.countDocuments(query).exec();
  const pageCount = Math.max(1, Math.ceil(total / 24));
  const page = Math.min(filters.page, pageCount);
  const documents = await VehicleModel.find(query).sort({ dateInStock: -1, _id: 1 }).skip((page - 1) * 24).limit(24).lean().exec();
  return { vehicles: documents.map(toVehicle), total, page, pageCount };
}
export async function getVehicle(id: string) {
  await requireRole();
  if (!objectIdSchema.safeParse(id).success) return null;
  await connectDb();
  const document = await VehicleModel.findById(id).lean().exec();
  return document ? toVehicle(document) : null;
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

/** Newest vehicle activity (status/price changes) across all stock, newest first. */
export async function listRecentVehicleActivity(limit = 10) {
  await requireRole();
  await connectDb();
  const rows = await VehicleModel.aggregate<{ _id: unknown; year: number; make: string; model: string; stockNo: string; activity: { type: string; message: string; occurredAt: Date; actorId: unknown } }>([
    { $unwind: "$activity" }, { $sort: { "activity.occurredAt": -1 } }, { $limit: limit },
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
    return { vehicle: toVehicle(document.toObject()) };
  } catch (error) { return duplicateError(error); }
}
/** One compare-and-swap writes fields, history and revision together. */
async function persistChange(previous: InventoryVehicle, revision: number, data: VehicleForm, actor: string): Promise<InventoryMutation> {
  if (previous.revision !== revision) throw new InventoryError("This vehicle changed. Refresh and try again.");
  if (JSON.stringify(editable(previous)) === JSON.stringify(data)) return { vehicle: previous };
  const statusChanged = data.status !== previous.status;
  const priceChanged = data.price !== previous.price;
  const changedAt = new Date().toISOString();
  const priceHistory = [...previous.priceHistory, ...(priceChanged ? [{ previousPrice: previous.price, price: data.price, changedAt, changedBy: actor }] : [])];
  const statusHistory = [...previous.statusHistory, ...(statusChanged ? [{ previousStatus: previous.status, status: data.status, changedAt, changedBy: actor }] : [])];
  const validated = vehicleSchema.parse({ ...data, priceHistory, statusHistory, id: previous.id });
  const { id, activity, ...fields } = validated;
  void activity; // Event handlers append independently; edits must never replace the log.
  let document;
  try {
    document = await VehicleModel.findOneAndUpdate({ _id: id, __v: revision }, { $set: fields, $inc: { __v: 1 } }, { returnDocument: "after", runValidators: true }).lean().exec();
  } catch (error) { return duplicateError(error); }
  if (!document) throw new InventoryError("This vehicle changed. Refresh and try again.");
  const vehicle = toVehicle(document);
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
  if (!vehicle) throw new InventoryError("Vehicle not found.");
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

/** Destructive internal CLI import only; never expose through a server action. */
export async function replaceVehiclesForSeed(input: unknown) {
  const records = z.array(vehicleSchema).parse(input);
  const settings = await getSettings();
  const keys = new Set(settings.vehicleStatuses.map((entry) => entry.key));
  for (const record of records) {
    if (!keys.has(record.status) || record.statusHistory.some((entry) => !keys.has(entry.status) || !keys.has(entry.previousStatus))) {
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
