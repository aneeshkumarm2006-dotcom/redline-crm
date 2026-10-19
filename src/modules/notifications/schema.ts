import { z } from "zod";
import { eventNames } from "@/lib/event-contract";
import { dateTimeSchema, objectIdSchema } from "@/lib/data-schema";

/** Alerts from scheduled reminders, which have no domain event behind them. */
export const reminderKinds = ["reminder.aging_inventory", "reminder.repair_overdue", "reminder.uncontacted_lead", "reminder.appointment_today"] as const;
export const notificationKinds = [...eventNames, ...reminderKinds] as const;
export type NotificationKind = (typeof notificationKinds)[number];

/** Alerts page filters. Every notification kind belongs to exactly one category. */
export const alertCategories = ["leads", "inventory", "repairs", "reminders"] as const;
export type AlertCategory = (typeof alertCategories)[number];
export function alertCategory(kind: string): AlertCategory {
  if (kind.startsWith("reminder.")) return "reminders";
  if (kind.startsWith("vehicle.repair_")) return "repairs";
  if (kind.startsWith("vehicle.")) return "inventory";
  return "leads";
}
export const alertFilterSchema = z.object({ category: z.enum(alertCategories).optional() });

export const notificationInputSchema = z.object({
  // An event UUID, or a deterministic reminder key such as `aging:<yyyy-mm-dd>` (unique per user).
  eventId: z.string().trim().min(1).max(200).optional(),
  userId: objectIdSchema, event: z.enum(notificationKinds), message: z.string().trim().min(1).max(1000),
  link: z.string().max(2048).regex(/^\/crm(?:\/[a-zA-Z0-9/_-]*)?$/),
  readAt: dateTimeSchema.nullable().default(null),
}).strict();
export const notificationSchema = notificationInputSchema.extend({ id: objectIdSchema });
export type Notification = z.infer<typeof notificationSchema>;
