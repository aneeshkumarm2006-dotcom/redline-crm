import { z } from "zod";
import { keySchema, objectIdSchema } from "@/lib/data-schema";

export const emailTemplateInputSchema = z.object({
  key: keySchema,
  subject: z.string().trim().min(1).max(300).refine((value) => !/[\r\n]/.test(value), "Use a single line."),
  body: z.string().trim().min(1).max(50_000),
}).strict();
export const emailTemplateSchema = emailTemplateInputSchema.extend({ id: objectIdSchema });
export type EmailTemplate = z.infer<typeof emailTemplateSchema>;
/** Placeholders every send path supplies; any template may use them. */
export const commonPlaceholders = ["companyName", "customerName", "vehicleName", "stockNo", "dealershipName", "dealershipAddress", "dealershipPhone", "salespersonName"] as const;
/** `{{name}}` placeholders used in a subject or body, in first-use order. */
export const placeholdersIn = (text: string) => [...new Set([...text.matchAll(/{{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*}}/g)].map((match) => match[1]))];
/**
 * What an edit may use: the common placeholders plus those the stored template already uses (its workflow supplies
 * them). Anything else would make every send of that template fail.
 */
export const allowedPlaceholders = (stored: { subject: string; body: string }) => [...new Set([...commonPlaceholders, ...placeholdersIn(`${stored.subject} ${stored.body}`)])];
export const emailTemplateUpdateSchema = emailTemplateSchema.pick({ id: true, subject: true, body: true }).strict();
export type EmailTemplateActionResult = { ok: true } | { ok: false; message: string };
