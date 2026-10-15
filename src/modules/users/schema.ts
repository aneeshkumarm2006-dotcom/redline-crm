import { z } from "zod";

export const roleSchema = z.enum(["owner", "salesperson"]);
export type Role = z.infer<typeof roleSchema>;
export const userIdSchema = z.string().regex(/^[a-f0-9]{24}$/i);
export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const userSchema = z.object({
  id: userIdSchema, name: z.string().trim().min(1).max(120), email: emailSchema,
  role: roleSchema, dealershipId: userIdSchema.nullable(), active: z.boolean(),
});
export type User = z.infer<typeof userSchema>;
export const initializeUserSchema = userSchema.omit({ id: true }).extend({
  passwordHash: z.string().regex(/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/),
}).strict();
