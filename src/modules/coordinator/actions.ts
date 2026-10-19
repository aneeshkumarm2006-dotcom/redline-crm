"use server";
import { revalidatePath } from "next/cache";
import { CoordinatorError, getCoordinatorFeed, sendLeadEmail } from "./service";
import type { LeadEmailResult } from "./schema";
import { coordinatorCopy as copy } from "./copy";

/** Polled by the live feed. Null when the session ended, so the client stops quietly. */
export async function getCoordinatorFeedAction() {
  try { return { items: await getCoordinatorFeed(), at: new Date().toISOString() }; }
  catch { return null; }
}

export async function sendLeadEmailAction(input: unknown): Promise<LeadEmailResult> {
  try {
    await sendLeadEmail(input);
    try { revalidatePath("/crm", "layout"); } catch { console.error("Email sent; staff cache revalidation failed."); }
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof CoordinatorError ? error.message : copy.error };
  }
}
