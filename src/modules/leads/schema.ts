import { z } from "zod";
import { keySchema, objectIdSchema, textSchema } from "@/lib/data-schema";
import { activitySchema } from "@/lib/activity-schema";
export { activitySchema } from "@/lib/activity-schema";
import { emailSchema } from "@/modules/users/schema";

export const leadInputSchema = z.object({
  name: textSchema, email: emailSchema, phone: z.string().trim().min(7).max(40),
  message: z.string().trim().max(4000).default(""), vehicleId: objectIdSchema, dealershipId: objectIdSchema,
  assignedTo: objectIdSchema.nullable().default(null), stage: keySchema, source: keySchema,
  bookingToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  inquiryId: z.string().uuid().optional(),
  activity: z.array(activitySchema).default([]),
}).strict();
export const leadSchema = leadInputSchema.extend({ id: objectIdSchema });
export type Lead = z.infer<typeof leadSchema>;

// Routing, assignment, stage and audit fields are server-owned.
export const inquirySchema = leadInputSchema.pick({ name: true, email: true, phone: true, message: true, vehicleId: true }).extend({ inquiryId: z.string().uuid() }).strict();
export type InquiryInput = z.infer<typeof inquirySchema>;
export type InquiryResult = { ok: true } | { ok: false; message: string; fields?: Partial<Record<keyof InquiryInput, string>> };

// Staff list filters. `assignedTo` accepts a staff ID or "unassigned"; salespeople are always scoped to themselves.
export const leadFilterSchema = z.object({
  stage: keySchema.optional(), dealershipId: objectIdSchema.optional(),
  assignedTo: z.union([objectIdSchema, z.literal("unassigned")]).optional(),
  q: z.string().trim().max(120).default(""), page: z.coerce.number().int().min(1).max(10_000).default(1),
}).strict();
export type LeadFilters = z.infer<typeof leadFilterSchema>;

// Staff mutations carry the value the user saw, so a concurrent change is reported instead of overwritten.
export const stageChangeSchema = z.object({ id: objectIdSchema, from: keySchema, stage: keySchema }).strict();
export const reassignSchema = z.object({ id: objectIdSchema, from: objectIdSchema.nullable(), salespersonId: objectIdSchema }).strict();
export const noteSchema = z.object({ id: objectIdSchema, message: z.string().trim().min(1, "Write a note first.").max(2000) }).strict();

/** Staff view of a lead: never includes the booking token or inquiry ID. */
export type StaffLead = Omit<Lead, "bookingToken" | "inquiryId"> & { createdAt: string };
export type LeadActionResult = { ok: true; warning?: string } | { ok: false; message: string };
