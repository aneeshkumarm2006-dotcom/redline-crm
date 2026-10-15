import { z } from "zod";
import { keySchema, objectIdSchema } from "@/lib/data-schema";

export const emailTemplateInputSchema = z.object({
  key: keySchema,
  subject: z.string().trim().min(1).max(300).refine((value) => !/[\r\n]/.test(value), "Use a single line."),
  body: z.string().trim().min(1).max(50_000),
}).strict();
export const emailTemplateSchema = emailTemplateInputSchema.extend({ id: objectIdSchema });
export type EmailTemplate = z.infer<typeof emailTemplateSchema>;
