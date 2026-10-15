"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { AuthorizationError } from "@/modules/auth/service";
import { create, InquiryError, LeadError, changeLeadStage, reassignLead, addLeadNote } from "./service";
import { inquirySchema, type InquiryResult, type LeadActionResult } from "./schema";
import { inquiryCopy, leadsCopy } from "./copy";

export async function submitInquiry(input: unknown): Promise<InquiryResult> {
  const parsed = inquirySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: inquiryCopy.invalid,
    fields: Object.fromEntries(Object.entries(parsed.error.flatten().fieldErrors).map(([key, errors]) => [key, errors?.[0] ?? inquiryCopy.invalid])),
  };
  try { await create(parsed.data); }
  catch (error) { return { ok: false, message: error instanceof InquiryError ? error.message : inquiryCopy.error }; }
  // Cache failure must not turn a committed inquiry into a failed submission.
  try { revalidatePath("/crm", "layout"); revalidatePath(`/crm/inventory/${parsed.data.vehicleId}`); }
  catch { console.error("Inquiry saved; staff cache revalidation failed."); }
  return { ok: true };
}

async function run(operation: () => Promise<{ warning?: string }>): Promise<LeadActionResult> {
  try {
    const result = await operation();
    // Cache failure must not report a committed change as failed.
    try { revalidatePath("/crm", "layout"); } catch { console.error("Lead saved; staff cache revalidation failed."); }
    return { ok: true, warning: result.warning };
  } catch (error) {
    const message = error instanceof AuthorizationError ? leadsCopy.ownerOnly
      : error instanceof LeadError ? error.message
      : error instanceof ZodError ? error.issues.map((issue) => issue.message).join(" ")
      : leadsCopy.genericError;
    return { ok: false, message };
  }
}
export async function changeLeadStageAction(input: unknown) { return run(() => changeLeadStage(input)); }
export async function reassignLeadAction(input: unknown) { return run(() => reassignLead(input)); }
export async function addLeadNoteAction(input: unknown) { return run(() => addLeadNote(input)); }
