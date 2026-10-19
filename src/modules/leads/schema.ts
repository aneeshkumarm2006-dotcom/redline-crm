import { z } from "zod";
import { dateTimeSchema, keySchema, objectIdSchema, textSchema } from "@/lib/data-schema";
import { activitySchema } from "@/lib/activity-schema";
export { activitySchema } from "@/lib/activity-schema";
import { emailSchema } from "@/modules/users/schema";

export const leadInputSchema = z.object({
  name: textSchema, email: emailSchema, phone: z.string().trim().min(7).max(40),
  message: z.string().trim().max(4000).default(""), vehicleId: objectIdSchema, dealershipId: objectIdSchema,
  // `source` is a `settings.leadSources` key, checked by the service on every write.
  assignedTo: objectIdSchema.nullable().default(null), stage: keySchema, source: keySchema,
  // Marketing campaign (`utm_source`) a public inquiry arrived with; absent on older and staff-entered leads.
  utmSource: z.string().trim().min(1).max(120).nullish(),
  // First staff contact (call, email, visit): response-time stats and the "not contacted" reminder.
  firstContactedAt: dateTimeSchema.nullable().default(null),
  bookingToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  inquiryId: z.string().uuid().optional(),
  activity: z.array(activitySchema).default([]),
}).strict();
export const leadSchema = leadInputSchema.extend({ id: objectIdSchema });
export type Lead = z.infer<typeof leadSchema>;

// Routing, assignment, stage and audit fields are server-owned.
export const inquirySchema = leadInputSchema.pick({ name: true, email: true, phone: true, message: true, vehicleId: true, utmSource: true }).extend({ inquiryId: z.string().uuid() }).strict();
export type InquiryInput = z.infer<typeof inquirySchema>;
export type InquiryResult = { ok: true } | { ok: false; message: string; fields?: Partial<Record<keyof InquiryInput, string>> };

// Staff list filters. `assignedTo` accepts a staff ID or "unassigned"; salespeople are always scoped to themselves.
export const leadFilterSchema = z.object({
  stage: keySchema.optional(), dealershipId: objectIdSchema.optional(),
  assignedTo: z.union([objectIdSchema, z.literal("unassigned")]).optional(),
  source: keySchema.optional(),
  q: z.string().trim().max(120).default(""), page: z.coerce.number().int().min(1).max(10_000).default(1),
}).strict();
export type LeadFilters = z.infer<typeof leadFilterSchema>;
/** Pipeline (board) view: same filters, every stage at once, no pages. */
export const leadViews = ["board", "list"] as const;
export type LeadView = (typeof leadViews)[number];

// Staff mutations carry the value the user saw, so a concurrent change is reported instead of overwritten.
export const stageChangeSchema = z.object({ id: objectIdSchema, from: keySchema, stage: keySchema }).strict();
export const reassignSchema = z.object({ id: objectIdSchema, from: objectIdSchema.nullable(), salespersonId: objectIdSchema }).strict();
export const noteSchema = z.object({ id: objectIdSchema, message: z.string().trim().min(1, "Write a note first.").max(2000) }).strict();
// Log call: `advanceFrom` is the stage the user saw; when set, the lead also moves to the next open stage.
export const logCallSchema = z.object({ id: objectIdSchema, note: z.string().trim().max(2000).default(""), advanceFrom: keySchema.nullable().default(null) }).strict();

// Staff-entered lead (phone, walk-in…). The service derives location, stage, token and activity.
// `assignedTo` null asks for automatic assignment (owners only; salespeople always keep their own leads).
export const staffLeadFormSchema = leadInputSchema.pick({ name: true, email: true, phone: true, message: true, vehicleId: true, source: true }).extend({
  assignedTo: objectIdSchema.nullable().default(null),
  // Staff already spoke with the customer (on the phone, on the lot): counts as first contact.
  contacted: z.boolean().default(false),
  requestId: z.string().uuid(),
}).strict();
export type StaffLeadInput = z.infer<typeof staffLeadFormSchema>;
export type StaffLeadResult = { ok: true; id: string; warning?: string } | { ok: false; message: string; fields?: Partial<Record<keyof StaffLeadInput, string>> };

/** Staff view of a lead: never includes the booking token or inquiry ID. */
export type StaffLead = Omit<Lead, "bookingToken" | "inquiryId"> & { createdAt: string };
export type LeadActionResult = { ok: true; warning?: string } | { ok: false; message: string };
