import { z } from "zod";
import { eventNames } from "@/lib/event-contract";
import { dateTimeSchema, objectIdSchema } from "@/lib/data-schema";

export const notificationInputSchema = z.object({
  eventId: z.string().uuid().optional(),
  userId: objectIdSchema, event: z.enum(eventNames), message: z.string().trim().min(1).max(1000),
  link: z.string().max(2048).regex(/^\/crm(?:\/[a-zA-Z0-9/_-]*)?$/),
  readAt: dateTimeSchema.nullable().default(null),
}).strict();
export const notificationSchema = notificationInputSchema.extend({ id: objectIdSchema });
export type Notification = z.infer<typeof notificationSchema>;
