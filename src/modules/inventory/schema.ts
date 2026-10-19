import { z } from "zod";
import { activitySchema } from "@/lib/activity-schema";
import { dateTimeSchema, keySchema, moneySchema, objectIdSchema, photoSchema, textSchema } from "@/lib/data-schema";

export const priceHistorySchema = z.object({
  previousPrice: moneySchema, price: moneySchema, changedAt: dateTimeSchema, changedBy: objectIdSchema,
}).strict();
export const statusHistorySchema = z.object({
  previousStatus: keySchema, status: keySchema, changedAt: dateTimeSchema, changedBy: objectIdSchema,
}).strict();
// The current repair. Time in repair is computed from `startedAt`, never stored.
export const repairSchema = z.object({
  typeKey: keySchema, garageId: objectIdSchema, startedAt: dateTimeSchema,
  estimatedCost: moneySchema.nullable().default(null), notes: z.string().trim().max(2000).default(""),
}).strict();
export const repairHistorySchema = z.object({
  typeKey: keySchema, garageId: objectIdSchema, startedAt: dateTimeSchema, completedAt: dateTimeSchema,
  cost: moneySchema, completedBy: objectIdSchema,
}).strict().refine((entry) => Date.parse(entry.completedAt) >= Date.parse(entry.startedAt), "A repair cannot finish before it starts.");
// `commission` is snapshotted from the vehicle when the sale is recorded.
export const saleSchema = z.object({
  salespersonId: objectIdSchema, leadId: objectIdSchema.nullable().default(null), price: moneySchema,
  commission: moneySchema, soldAt: dateTimeSchema, recordedBy: objectIdSchema,
}).strict();
export const vehicleInputSchema = z.object({
  stockNo: z.string().trim().toUpperCase().min(1).max(40),
  vin: z.string().trim().toUpperCase().regex(/^[A-HJ-NPR-Z0-9]{17}$/),
  year: z.number().int().min(1886).max(2100), make: textSchema, model: textSchema,
  trim: z.string().trim().max(120).default(""), mileage: z.number().int().nonnegative().max(10_000_000),
  price: moneySchema, priceHistory: z.array(priceHistorySchema).default([]), status: keySchema,
  statusHistory: z.array(statusHistorySchema).default([]), dealershipId: objectIdSchema,
  activity: z.array(activitySchema).default([]),
  // `dateInStock` is the acquisition date; days in stock are computed from it.
  photos: z.array(photoSchema).max(50).default([]), dateInStock: dateTimeSchema,
  // Owner-only purchase cost; services redact it for salespeople.
  acquisitionCost: moneySchema.default(0),
  // Flat CAD commission paid on this car.
  commission: moneySchema.default(0),
  repair: repairSchema.nullable().default(null),
  repairHistory: z.array(repairHistorySchema).default([]),
  sale: saleSchema.nullable().default(null),
}).strict();
export const vehicleSchema = vehicleInputSchema.extend({ id: objectIdSchema });
export type Vehicle = z.infer<typeof vehicleSchema>;
export type VehicleRepair = z.infer<typeof repairSchema>;
export type VehicleRepairHistory = z.infer<typeof repairHistorySchema>;
export type VehicleSale = z.infer<typeof saleSchema>;

// Audit, repair and sale fields are server-owned and never accepted from forms. Cost and commission
// are optional so a form that omits them keeps the stored values.
export const vehicleFormSchema = vehicleInputSchema.omit({ priceHistory: true, statusHistory: true, activity: true, repair: true, repairHistory: true, sale: true })
  .extend({ acquisitionCost: moneySchema.optional(), commission: moneySchema.optional() });
export const vehicleUpdateSchema = z.object({ id: objectIdSchema, revision: z.number().int().nonnegative(), data: vehicleFormSchema }).strict();
export const statusChangeSchema = z.object({ id: objectIdSchema, revision: z.number().int().nonnegative(), status: keySchema }).strict();
export const priceChangeSchema = z.object({ id: objectIdSchema, revision: z.number().int().nonnegative(), price: moneySchema }).strict();
// Repair and sale workflows (owner). Each carries the revision the owner saw, like every other vehicle edit.
const workflowRef = { id: objectIdSchema, revision: z.number().int().nonnegative() };
export const repairStartSchema = z.object({
  ...workflowRef, typeKey: keySchema, garageId: objectIdSchema,
  estimatedCost: moneySchema.nullable().default(null), notes: z.string().trim().max(2000).default(""),
}).strict();
export const repairCompleteSchema = z.object({ ...workflowRef, cost: moneySchema }).strict();
export const saleInputSchema = z.object({
  ...workflowRef, salespersonId: objectIdSchema, leadId: objectIdSchema.nullable().default(null), price: moneySchema,
}).strict();
/** Sales reporting: sale date range [from, to) and an optional salesperson (owners only; salespeople see their own). */
export const salesQuerySchema = z.object({
  from: dateTimeSchema.optional(), to: dateTimeSchema.optional(), salespersonId: objectIdSchema.optional(),
  limit: z.number().int().min(1).max(2000).default(1000),
}).strict();
/** Sheets a status change can require instead of a plain status edit. */
export const vehicleWorkflows = ["repair", "complete-repair", "sell"] as const;
export type VehicleWorkflow = (typeof vehicleWorkflows)[number];

export const inventoryGroupings = ["status", "location"] as const;
export const inventoryFilterSchema = z.object({
  q: z.string().trim().max(120).default(""), dealershipId: objectIdSchema.optional(), status: keySchema.optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  groupBy: z.enum(inventoryGroupings).default("status"),
  repairType: keySchema.optional(), garageId: objectIdSchema.optional(),
  // "1" keeps only unsold cars past the aging warning.
  aging: z.literal("1").optional(),
  // Sold cars on the board: sold this month (default) or every sale.
  sold: z.enum(["month", "all"]).default("month"),
  // Days-in-stock range for unsold cars (dashboard aging buckets), and cars sold by one salesperson.
  minDays: z.coerce.number().int().min(0).max(36_500).optional(), maxDays: z.coerce.number().int().min(0).max(36_500).optional(),
  soldBy: objectIdSchema.optional(),
}).strict();
export type InventoryFilters = z.infer<typeof inventoryFilterSchema>;
export type VehicleForm = z.infer<typeof vehicleFormSchema>;
/** Staff view: `acquisitionCost` is null unless the caller is the owner. */
export type InventoryVehicle = Omit<Vehicle, "acquisitionCost"> & { acquisitionCost: number | null; revision: number };

export const publicVehicleSchema = vehicleSchema.pick({ id: true, stockNo: true, vin: true, year: true, make: true, model: true, trim: true, mileage: true, price: true, status: true, dealershipId: true, photos: true });
export type PublicVehicle = z.infer<typeof publicVehicleSchema>;
/** Merchandising badge on public listings, derived on the server so dates and price history stay private. */
export const publicBadges = ["price_drop", "new_arrival"] as const;
export type PublicBadge = (typeof publicBadges)[number];
export type PublicListing = PublicVehicle & { badge: PublicBadge | null };
export const publicInventoryFilterSchema = inventoryFilterSchema.pick({ dealershipId: true, page: true });
