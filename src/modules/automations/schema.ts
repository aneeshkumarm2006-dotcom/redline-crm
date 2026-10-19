import { z } from "zod";
import { dateTimeSchema, keySchema, objectIdSchema } from "@/lib/data-schema";
import { emailSchema } from "@/modules/users/schema";

/** Recipe keys for `settings.automations` toggles and `automation_runs.recipeKey` (Stage 6 builds the recipes). */
export const automationRecipeKeys = [
  // Event-driven
  "lead_auto_assign", "lead_follow_up_email", "lead_assigned_alert",
  "appointment_confirmation", "appointment_alert", "appointment_stage_update",
  "vehicle_status_alert", "vehicle_price_alert", "repair_alert", "sale_recorded",
  // Scheduled reminders
  "aging_inventory_reminder", "repair_overdue_reminder", "uncontacted_lead_reminder",
  "appointment_customer_reminder", "appointment_morning_alert", "lead_customer_follow_up",
] as const;
export type AutomationRecipeKey = (typeof automationRecipeKeys)[number];
export const isAutomationRecipeKey = (key: string): key is AutomationRecipeKey => (automationRecipeKeys as readonly string[]).includes(key);
/** `settings.automations` is a key → boolean map; a missing key means the recipe is on. */
export const isRecipeEnabled = (toggles: Record<string, boolean>, key: AutomationRecipeKey) => toggles[key] !== false;

/** Where each recipe sits on the Automations page, and how it runs (on an event, or on the reminder schedule). */
export const recipeGroups = ["leads", "inventory", "reminders"] as const;
export type RecipeGroup = (typeof recipeGroups)[number];
export const recipeCatalog: { key: AutomationRecipeKey; group: RecipeGroup; trigger: "event" | "schedule" }[] = [
  { key: "lead_auto_assign", group: "leads", trigger: "event" },
  { key: "lead_follow_up_email", group: "leads", trigger: "event" },
  { key: "lead_assigned_alert", group: "leads", trigger: "event" },
  { key: "appointment_confirmation", group: "leads", trigger: "event" },
  { key: "appointment_alert", group: "leads", trigger: "event" },
  { key: "appointment_stage_update", group: "leads", trigger: "event" },
  { key: "lead_customer_follow_up", group: "leads", trigger: "schedule" },
  { key: "vehicle_status_alert", group: "inventory", trigger: "event" },
  { key: "vehicle_price_alert", group: "inventory", trigger: "event" },
  { key: "repair_alert", group: "inventory", trigger: "event" },
  { key: "sale_recorded", group: "inventory", trigger: "event" },
  { key: "aging_inventory_reminder", group: "reminders", trigger: "schedule" },
  { key: "repair_overdue_reminder", group: "reminders", trigger: "schedule" },
  { key: "uncontacted_lead_reminder", group: "reminders", trigger: "schedule" },
  { key: "appointment_customer_reminder", group: "reminders", trigger: "schedule" },
  { key: "appointment_morning_alert", group: "reminders", trigger: "schedule" },
];
/** Explained in the demo, not built: shown on the Automations page as Coming soon. */
export const plannedRecipeKeys = ["sms_follow_up", "website_chatbot", "listing_feed_sync", "review_request"] as const;
export type PlannedRecipeKey = (typeof plannedRecipeKeys)[number];

export const recipeToggleSchema = z.object({ key: z.enum(automationRecipeKeys), enabled: z.boolean() }).strict();

export const automationOutcomes = ["success", "failed", "skipped"] as const;
export const automationSubjectTypes = ["lead", "vehicle", "appointment", "user"] as const;

export const automationRunInputSchema = z.object({
  // Event UUID for event handlers, or a deterministic key (e.g. `aging:<vehicleId>:<yyyy-mm-dd>`) for reminders.
  eventId: z.string().trim().min(1).max(200),
  recipeKey: keySchema,
  // The trigger: an event name (`lead.created`) or `schedule` for reminders.
  name: z.string().trim().min(1).max(120),
  subject: z.object({ type: z.enum(automationSubjectTypes), id: objectIdSchema }).strict(),
  outcome: z.enum(automationOutcomes),
  detail: z.string().trim().max(1000).default(""),
  ranAt: dateTimeSchema,
}).strict();
export const automationRunSchema = automationRunInputSchema.extend({ id: objectIdSchema });
export type AutomationRun = z.infer<typeof automationRunSchema>;

export const emailProviders = ["console", "resend", "smtp"] as const;
export const emailLogInputSchema = z.object({
  to: z.array(emailSchema).min(1).max(50),
  subject: z.string().trim().min(1).max(300).refine((value) => !/[\r\n]/.test(value), "Use a single line."),
  html: z.string().min(1).max(200_000),
  // Null for one-off emails that did not come from a stored template.
  templateKey: keySchema.nullable().default(null),
  leadId: objectIdSchema.nullable().default(null),
  vehicleId: objectIdSchema.nullable().default(null),
  provider: z.enum(emailProviders),
  // Failed sends are logged too, so the Email log shows every attempt.
  status: z.enum(["sent", "failed"]).default("sent"),
  error: z.string().trim().max(1000).nullable().default(null),
  sentAt: dateTimeSchema,
}).strict();
export const emailLogSchema = emailLogInputSchema.extend({ id: objectIdSchema });
export type EmailLogEntry = z.infer<typeof emailLogSchema>;

export const emailLogFilterSchema = z.object({
  q: z.string().trim().max(120).default(""), leadId: objectIdSchema.optional(),
  status: z.enum(["sent", "failed"]).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
}).strict();

/** One scheduled pass: per recipe, how many reminders fired now, were already done today, or were turned off. */
export type ScheduledRunSummary = {
  ranAt: string;
  recipes: { key: AutomationRecipeKey; fired: number; alreadyDone: number; failed: number; off: boolean }[];
};
