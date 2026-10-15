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
  notificationRules: z.array(z.object({
    event: z.enum(eventNames),
    recipients: z.array(z.enum(["customer", "assigned_salesperson", "dealership_salespeople", "owners"])).min(1).refine(unique),
    channels: z.array(z.enum(["in_app", "email"])).min(1).refine(unique),
  }).strict()),
}).strict();

export type Settings = z.infer<typeof settingsSchema>;
export type StatusDefinition = z.infer<typeof statusSchema>;
