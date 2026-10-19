import { z } from "zod";
import { eventNames } from "@/lib/event-contract";

const key = z.string().regex(/^[a-z][a-z0-9_]*$/);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex colour.");
const label = z.string().trim().min(1).max(120);
export const statusSchema = z.object({ key, label, color }).strict();
const stageSchema = statusSchema.extend({ order: z.number().int().nonnegative() });
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const hoursSchema = z.object({ opensAt: time, closesAt: time }).strict()
  .refine((value) => value.opensAt < value.closesAt, "Closing time must follow opening time.");
export const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const uniqueKeys = (values: { key: string }[]) => new Set(values.map((value) => value.key)).size === values.length;
const unique = (values: string[]) => new Set(values).size === values.length;
const labelledKeys = z.array(statusSchema).min(1).refine(uniqueKeys, "Keys must be unique.");

// Defaults below keep databases seeded before v2 valid; the seed writes every value explicitly.
const defaultRepairTypes = [
  { key: "mechanical", label: "Mechanical", color: "#2563EB" },
  { key: "body_paint", label: "Body/Paint", color: "#DB2777" },
  { key: "detailing", label: "Detailing", color: "#0D9488" },
  { key: "tires", label: "Tires", color: "#475569" },
  { key: "safety_inspection", label: "Safety inspection", color: "#CA8A04" },
  { key: "electrical", label: "Electrical", color: "#7C3AED" },
];
const defaultLeadSources = [
  { key: "website", label: "Website", color: "#2563EB" },
  { key: "phone", label: "Phone", color: "#0D9488" },
  { key: "walk_in", label: "Walk-in", color: "#B45309" },
  { key: "facebook", label: "Facebook", color: "#1D4ED8" },
  { key: "autotrader", label: "AutoTrader", color: "#EA580C" },
  { key: "referral", label: "Referral", color: "#15803D" },
];

export const settingsSchema = z.object({
  emailFrom: z.string().email().nullable().default(null),
  brand: z.object({
    companyName: label,
    logoUrl: z.string().url().refine((url) => /^https?:\/\//.test(url)).nullable(),
    primaryColor: color,
  }).strict(),
  vehicleStatuses: z.array(statusSchema).min(1).refine(uniqueKeys, "Status keys must be unique."),
  // Compatibility default for databases seeded before the public site existed.
  publicInventoryStatusKeys: z.array(key).refine(unique).default(["available"]),
  leadStages: z.array(stageSchema).min(1).refine(uniqueKeys, "Stage keys must be unique.")
    .refine((stages) => new Set(stages.map((stage) => stage.order)).size === stages.length, "Stage order must be unique."),
  booking: z.object({
    // Local opening hours need an IANA zone when converted to appointment instants.
    timeZone: z.string().refine((zone) => {
      try { new Intl.DateTimeFormat("en", { timeZone: zone }); return true; } catch { return false; }
    }, "Use an IANA time zone."),
    businessHours: z.object({
      monday: hoursSchema.nullable(), tuesday: hoursSchema.nullable(),
      wednesday: hoursSchema.nullable(), thursday: hoursSchema.nullable(),
      friday: hoursSchema.nullable(), saturday: hoursSchema.nullable(), sunday: hoursSchema.nullable(),
    }).strict(),
    slotLengthMinutes: z.number().int().min(5).max(480),
    daysAhead: z.number().int().min(1).max(365),
    // Lead stage applied when a customer books. Default keeps pre-Stage 9 databases valid.
    appointmentStageKey: key.default("appointment"),
  }).strict(),
  leadAssignmentStrategy: z.enum(["round_robin", "manual"]),
  repairTypes: labelledKeys.default(defaultRepairTypes),
  leadSources: labelledKeys.default(defaultLeadSources),
  // Source recorded for public website inquiries.
  publicInquirySourceKey: key.default("website"),
  // Workflows read these instead of hardcoding vehicle status keys.
  statusRoles: z.object({ available: key, repair: key, sold: key }).strict()
    .refine((roles) => unique(Object.values(roles)), "Each status role needs its own status.")
    .default({ available: "available", repair: "in_repair", sold: "sold" }),
  // Lead stage set when a sale is recorded against the lead.
  wonStageKey: key.default("won"),
  // Closed-without-sale stage. Won and lost leads are "closed": conversion = won ÷ (won + lost).
  lostStageKey: key.default("lost"),
  // Days-in-stock thresholds for board aging colours. Default keeps older databases valid.
  inventoryAging: z.object({ warnDays: z.number().int().min(1).max(3650), criticalDays: z.number().int().min(1).max(3650) }).strict()
    .refine((value) => value.warnDays < value.criticalDays, "Critical age must follow the warning age.")
    .default({ warnDays: 45, criticalDays: 90 }),
  repairOverdueDays: z.number().int().min(1).max(365).default(7),
  uncontactedLeadHours: z.number().int().min(1).max(720).default(24),
  // Recipe on/off switches keyed by recipe key (see modules/automations). A missing key means on.
  automations: z.record(key, z.boolean()).default({}),
  notificationRules: z.array(z.object({
    event: z.enum(eventNames),
    recipients: z.array(z.enum(["customer", "assigned_salesperson", "dealership_salespeople", "owners"])).min(1).refine(unique),
    channels: z.array(z.enum(["in_app", "email"])).min(1).refine(unique),
  }).strict()),
}).strict();

export type Settings = z.infer<typeof settingsSchema>;
export type StatusDefinition = z.infer<typeof statusSchema>;

/**
 * Settings fields that point at other settings keys. A save that breaks one is rejected, so workflows never look up
 * a status, stage or source that no longer exists. Returns readable problems (empty when consistent).
 */
export function settingsReferenceProblems(settings: Settings) {
  const statuses = new Set(settings.vehicleStatuses.map((entry) => entry.key));
  const stages = new Set(settings.leadStages.map((entry) => entry.key));
  const sources = new Set(settings.leadSources.map((entry) => entry.key));
  return [
    ...Object.entries(settings.statusRoles).filter(([, key]) => !statuses.has(key)).map(([role]) => `The ${role} role needs an existing vehicle status.`),
    ...settings.publicInventoryStatusKeys.filter((key) => !statuses.has(key)).map((key) => `Public status “${key}” is not a vehicle status.`),
    ...([["won", settings.wonStageKey], ["lost", settings.lostStageKey], ["appointment", settings.booking.appointmentStageKey]] as const)
      .filter(([, key]) => !stages.has(key)).map(([role]) => `The ${role} stage must be an existing lead stage.`),
    ...(settings.wonStageKey === settings.lostStageKey ? ["The won and lost stages must be different."] : []),
    ...(sources.has(settings.publicInquirySourceKey) ? [] : ["The website inquiry source must be an existing lead source."]),
  ];
}

// Owner settings screen: each tab saves one section. Field rules come from `settingsSchema`.
const shape = settingsSchema.shape;
export const settingsSections = ["brand", "inventory", "leads", "thresholds"] as const;
export type SettingsSection = (typeof settingsSections)[number];
export const settingsSectionSchema = z.discriminatedUnion("section", [
  z.object({ section: z.literal("brand"), data: shape.brand }).strict(),
  z.object({ section: z.literal("inventory"), data: z.object({
    vehicleStatuses: shape.vehicleStatuses, repairTypes: z.array(statusSchema).min(1).refine(uniqueKeys, "Keys must be unique."),
    statusRoles: z.object({ available: key, repair: key, sold: key }).strict().refine((roles) => unique(Object.values(roles)), "Each status role needs its own status."),
    publicInventoryStatusKeys: z.array(key).refine(unique),
  }).strict() }).strict(),
  z.object({ section: z.literal("leads"), data: z.object({
    leadStages: shape.leadStages, leadSources: z.array(statusSchema).min(1).refine(uniqueKeys, "Keys must be unique."),
    wonStageKey: key, lostStageKey: key, appointmentStageKey: key, publicInquirySourceKey: key,
  }).strict() }).strict(),
  z.object({ section: z.literal("thresholds"), data: z.object({
    inventoryAging: z.object({ warnDays: z.number().int().min(1).max(3650), criticalDays: z.number().int().min(1).max(3650) }).strict()
      .refine((value) => value.warnDays < value.criticalDays, "Critical age must follow the warning age."),
    repairOverdueDays: z.number().int().min(1).max(365), uncontactedLeadHours: z.number().int().min(1).max(720),
  }).strict() }).strict(),
]);
export type SettingsSectionInput = z.infer<typeof settingsSectionSchema>;
export type SettingsActionResult = { ok: true } | { ok: false; message: string };
