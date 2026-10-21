"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { AuthorizationError } from "@/modules/auth/service";
import { setAssistantSettings } from "@/modules/settings/service";
import { AssistantError, approveDraft, discardDraft, requestAssistantDraft, sendStaffReply, setAssistantPaused } from "./service";
import { runAssistantCycleNow } from "./inbox";
import type { AssistantActionResult } from "./schema";
import { assistantCopy as copy } from "./copy";

function failure(error: unknown) {
  return error instanceof AssistantError ? error.message
    : error instanceof ZodError ? error.issues.map((issue) => issue.message).join(" ")
    : error instanceof AuthorizationError ? "Sign in again to continue." : copy.error;
}

async function run(operation: () => Promise<unknown>, path = "/crm"): Promise<AssistantActionResult> {
  try { await operation(); }
  catch (error) { return { ok: false, message: failure(error) }; }
  // Cache failure must not report a committed change as failed.
  try { revalidatePath(path, "layout"); } catch { console.error("Assistant change saved; revalidation failed."); }
  return { ok: true };
}

export async function sendStaffReplyAction(input: unknown) { return run(() => sendStaffReply(input)); }
export async function approveDraftAction(input: unknown) { return run(() => approveDraft(input)); }
export async function discardDraftAction(input: unknown) { return run(() => discardDraft(input)); }
export async function setAssistantPausedAction(input: unknown) { return run(() => setAssistantPaused(input)); }
export async function requestAssistantDraftAction(leadId: unknown) { return run(() => requestAssistantDraft(leadId)); }
export async function saveAssistantSettingsAction(input: unknown) { return run(() => setAssistantSettings(input), "/crm/automations"); }

/** Owner: check the reply inbox and answer what is waiting now. */
export async function runAssistantNowAction(): Promise<{ ok: true; fetched: number; error: string | null } | { ok: false; message: string }> {
  try {
    const { poll } = await runAssistantCycleNow();
    try { revalidatePath("/crm", "layout"); } catch { console.error("Assistant ran; revalidation failed."); }
    return { ok: true, fetched: poll.fetched, error: poll.error };
  } catch (error) {
    return { ok: false, message: failure(error) };
  }
}
