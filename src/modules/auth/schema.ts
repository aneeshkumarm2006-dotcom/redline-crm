import { z } from "zod";
import { emailSchema } from "@/modules/users/schema";

// bcrypt truncates after 72 bytes. Reject instead, including multibyte input.
export const passwordSchema = z.string().min(8).max(72)
  .refine((value) => new TextEncoder().encode(value).length <= 72);
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72).refine((value) => new TextEncoder().encode(value).length <= 72),
}).strict();
export type LoginState = { error?: string };
