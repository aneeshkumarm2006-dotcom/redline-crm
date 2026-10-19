"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { AuthorizationError } from "@/modules/auth/service";
import { createSalesperson, updateSalesperson, StaffError } from "./service";
import type { StaffActionResult } from "./schema";
import { staffCopy } from "./copy";

function failure(error: unknown): StaffActionResult {
  const message = error instanceof AuthorizationError ? staffCopy.errors.ownerOnly
    : error instanceof StaffError ? error.message
    : error instanceof ZodError ? error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(" ")
    : staffCopy.errors.failed;
  return { ok: false, message };
}
export async function createSalespersonAction(input: unknown): Promise<StaffActionResult> {
  try {
    const { user, temporaryPassword } = await createSalesperson(input);
    revalidatePath("/crm", "layout");
    return { ok: true, id: user.id, temporaryPassword };
  } catch (error) { return failure(error); }
}
export async function updateSalespersonAction(input: unknown): Promise<StaffActionResult> {
  try {
    const user = await updateSalesperson(input);
    revalidatePath("/crm", "layout");
    return { ok: true, id: user.id };
  } catch (error) { return failure(error); }
}
