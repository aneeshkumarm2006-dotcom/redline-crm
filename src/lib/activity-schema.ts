import { z } from "zod";
import { eventNames } from "./event-contract";
import { dateTimeSchema, objectIdSchema } from "./data-schema";

export const activitySchema = z.object({
  // `call` and `email` are staff contact entries logged from the lead (they also set `firstContactedAt`).
  type: z.enum([...eventNames, "note", "call", "email"]), message: z.string().trim().min(1).max(4000),
  occurredAt: dateTimeSchema, actorId: objectIdSchema.nullable(),
  eventId: z.string().uuid().optional(),
}).strict();
