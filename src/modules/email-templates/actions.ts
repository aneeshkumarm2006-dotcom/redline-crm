"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { AuthorizationError } from "@/modules/auth/service";
import { EmailTemplateError, updateEmailTemplate } from "./service";
import type { EmailTemplateActionResult } from "./schema";

export async function updateEmailTemplateAction(input: unknown): Promise<EmailTemplateActionResult> {
  try { await updateEmailTemplate(input); }
  catch (error) {
    return { ok: false, message: error instanceof EmailTemplateError ? error.message : error instanceof AuthorizationError ? "Owner access is required."
      : error instanceof ZodError ? error.issues[0]?.message ?? "Check the subject and body." : "The template could not be saved. Try again." };
  }
  revalidatePath("/crm/settings");
  return { ok: true };
}
