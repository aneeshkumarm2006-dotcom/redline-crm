"use server";
import { revalidatePath } from "next/cache";
import { setAutomationEnabled } from "@/modules/settings/service";
import { runScheduledAutomationsNow } from "./reminders";
import { sendTestEmail } from "./service";
import type { ScheduledRunSummary } from "./schema";

/** Owner recipe switch. Revalidation failure does not undo a saved toggle. */
export async function setRecipeEnabledAction(input: unknown) {
  try { await setAutomationEnabled(input); }
  catch { return { ok: false as const }; }
  try { revalidatePath("/crm/automations"); } catch { console.error("Recipe saved; revalidation failed."); }
  return { ok: true as const };
}

/** Owner Run now: fires today's scheduled reminders (never twice in a day) and refreshes alerts and history. */
export async function runScheduledNowAction(): Promise<{ ok: true; summary: ScheduledRunSummary } | { ok: false }> {
  let summary: ScheduledRunSummary;
  try { summary = await runScheduledAutomationsNow(); }
  catch { return { ok: false }; }
  try { revalidatePath("/crm", "layout"); } catch { console.error("Reminders ran; revalidation failed."); }
  return { ok: true, summary };
}

/** Owner: sends a test email so delivery can be checked from the Automations page. */
export async function sendTestEmailAction(to: unknown) {
  try { return await sendTestEmail(to); }
  catch { return { ok: false as const, message: "Only the owner can send a test email." }; }
}
