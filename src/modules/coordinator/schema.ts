import { z } from "zod";
import { objectIdSchema } from "@/lib/data-schema";
import type { JourneyStep } from "./journey";

export const coordinatorPeriods = ["week", "month"] as const;
export type CoordinatorPeriod = (typeof coordinatorPeriods)[number];
export const coordinatorQuerySchema = z.object({ period: z.enum(coordinatorPeriods).catch("week").default("week") });

/** Customer-facing templates staff can send from a lead. `appointment_reminder` needs a booked appointment. */
export const customerTemplateKeys = ["follow_up", "appointment_reminder"] as const;
export type CustomerTemplateKey = (typeof customerTemplateKeys)[number];
export const leadEmailSchema = z.object({ id: objectIdSchema, templateKey: z.enum(customerTemplateKeys) }).strict();
export type LeadEmailResult = { ok: true } | { ok: false; message: string };

/** One row of the live journeys feed: serializable, shared by the first render and the 20-second poll. */
export type FeedItem = {
  id: string; name: string; vehicle: string; assignee: string | null; createdAt: string;
  steps: Pick<JourneyStep, "key" | "state">[];
  latest: { message: string; at: string; by: string } | null;
};
