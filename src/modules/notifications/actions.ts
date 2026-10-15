"use server";
import { revalidatePath } from "next/cache";
import { getUnreadSummary, markAllNotificationsRead, markNotificationRead } from "./service";

/** Polled by the header bell. Returns null when the session has ended so the client can stop quietly. */
export async function getUnreadSummaryAction() {
  try { return await getUnreadSummary(); }
  catch { return null; }
}
export async function markNotificationReadAction(id: unknown) {
  try { await markNotificationRead(id); revalidatePath("/crm", "layout"); return { ok: true as const }; }
  catch { return { ok: false as const }; }
}
export async function markAllNotificationsReadAction() {
  try { await markAllNotificationsRead(); revalidatePath("/crm", "layout"); return { ok: true as const }; }
  catch { return { ok: false as const }; }
}
