import { z } from "zod";
import { objectIdSchema, textSchema } from "@/lib/data-schema";

export const dealershipInputSchema = z.object({
  name: textSchema, address: z.string().trim().min(1).max(500),
  phone: z.string().trim().min(7).max(40), active: z.boolean().default(true),
}).strict();
export const dealershipSchema = dealershipInputSchema.extend({ id: objectIdSchema });
export type Dealership = z.infer<typeof dealershipSchema>;
