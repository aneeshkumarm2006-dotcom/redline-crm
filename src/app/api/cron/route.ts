import { createHash, timingSafeEqual } from "node:crypto";
import { runScheduledAutomations } from "@/modules/automations/reminders";

const noStore = { "Cache-Control": "no-store" };
const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Scheduled reminders. Idempotent per day, so a retried or doubled cron call sends nothing twice.
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; other schedulers may send the same header.
 */
export async function GET(request: Request) {
  // Read the request first, so the handler always runs at request time and is never prerendered.
  const header = request.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured." }, { status: 503, headers: noStore });
  if (!timingSafeEqual(digest(header), digest(`Bearer ${secret}`))) return Response.json({ error: "Unauthorized." }, { status: 401, headers: noStore });
  try {
    return Response.json(await runScheduledAutomations(Date.now()), { headers: noStore });
  } catch {
    console.error("Scheduled automations failed.");
    return Response.json({ error: "Scheduled automations failed." }, { status: 500, headers: noStore });
  }
}
