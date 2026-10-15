import { z } from "zod";
import { activitySchema } from "@/lib/activity-schema";
import { dateTimeSchema, keySchema, moneySchema, objectIdSchema, photoSchema, textSchema } from "@/lib/data-schema";

export const priceHistorySchema = z.object({
  previousPrice: moneySchema, price: moneySchema, changedAt: dateTimeSchema, changedBy: objectIdSchema,
}).strict();
export const statusHistorySchema = z.object({
  previousStatus: keySchema, status: keySchema, changedAt: dateTimeSchema, changedBy: objectIdSchema,
}).strict();
export const vehicleInputSchema = z.object({
  stockNo: z.string().trim().toUpperCase().min(1).max(40),
  vin: z.string().trim().toUpperCase().regex(/^[A-HJ-NPR-Z0-9]{17}$/),
  year: z.number().int().min(1886).max(2100), make: textSchema, model: textSchema,
  trim: z.string().trim().max(120).default(""), mileage: z.number().int().nonnegative().max(10_000_000),
  price: moneySchema, priceHistory: z.array(priceHistorySchema).default([]), status: keySchema,
  statusHistory: z.array(statusHistorySchema).default([]), dealershipId: objectIdSchema,
  activity: z.array(activitySchema).default([]),
  photos: z.array(photoSchema).max(50).default([]), dateInStock: dateTimeSchema,
}).strict();
export const vehicleSchema = vehicleInputSchema.extend({ id: objectIdSchema });
export type Vehicle = z.infer<typeof vehicleSchema>;

// Audit fields are server-owned and never accepted from forms.
export const vehicleFormSchema = vehicleInputSchema.omit({ priceHistory: true, statusHistory: true, activity: true });
export const vehicleUpdateSchema = z.object({ id: objectIdSchema, revision: z.number().int().nonnegative(), data: vehicleFormSchema }).strict();
export const statusChangeSchema = z.object({ id: objectIdSchema, revision: z.number().int().nonnegative(), status: keySchema }).strict();
export const priceChangeSchema = z.object({ id: objectIdSchema, revision: z.number().int().nonnegative(), price: moneySchema }).strict();
export const inventoryFilterSchema = z.object({
  q: z.string().trim().max(120).default(""), dealershipId: objectIdSchema.optional(), status: keySchema.optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
}).strict();
export type VehicleForm = z.infer<typeof vehicleFormSchema>;
export type InventoryVehicle = Vehicle & { revision: number };

export const publicVehicleSchema = vehicleSchema.pick({ id: true, stockNo: true, vin: true, year: true, make: true, model: true, trim: true, mileage: true, price: true, status: true, dealershipId: true, photos: true });
export type PublicVehicle = z.infer<typeof publicVehicleSchema>;
export const publicInventoryFilterSchema = inventoryFilterSchema.pick({ dealershipId: true, page: true });
