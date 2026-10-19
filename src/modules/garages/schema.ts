import { z } from "zod";
import { keySchema, objectIdSchema, textSchema } from "@/lib/data-schema";

// Specialties are repair type keys from settings; the service checks them against `repairTypes`.
export const garageInputSchema = z.object({
  name: textSchema, address: z.string().trim().min(1).max(500),
  phone: z.string().trim().min(7).max(40),
  specialties: z.array(keySchema).max(20).refine((keys) => new Set(keys).size === keys.length, "Specialties must be unique.").default([]),
  active: z.boolean().default(true),
}).strict();
export const garageSchema = garageInputSchema.extend({ id: objectIdSchema });
export type Garage = z.infer<typeof garageSchema>;
