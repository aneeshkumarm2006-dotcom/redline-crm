import { createHash, timingSafeEqual } from "node:crypto";
import { runAssistantCycle } from "@/modules/assistant/inbox";

// Reading mail and a few Claude replies can take a while; stay within the platform's function limit.
export const maxDuration = 300;
const noStore = { "Cache-Control": "no-store" };
const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Virtual assistant: reads the reply inbox and answers waiting customer emails. Vercel Cron calls it every minute
 * (see vercel.json) with `Authorization: Bearer <CRON_SECRET>`; each call checks every ASSISTANT_POLL_SECONDS (30).
 * Safe to call often or concurrently: polls never overlap and each email is stored and answered once.
 */
export async function GET(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured." }, { status: 503, headers: noStore });
  if (!timingSafeEqual(digest(header), digest(`Bearer ${secret}`))) return Response.json({ error: "Unauthorized." }, { status: 401, headers: noStore });
  try {
    // Vercel Cron runs at most once a minute, so one call checks the inbox several times: at 0s, 30s, ... (every
    // ASSISTANT_POLL_SECONDS, default 30). Each pass answers what it found before the next one starts.
    const interval = Math.min(60, Math.max(15, Number(process.env.ASSISTANT_POLL_SECONDS) || 30));
    const started = Date.now();
    const passes = [];
    for (let offset = 0; offset < 60_000; offset += interval * 1000) {
      const wait = started + offset - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      const { poll, queue } = await runAssistantCycle(Date.now());
      passes.push({ inbox: poll, answered: queue.outcomes.length });
    }
    return Response.json({ passes }, { headers: noStore });
  } catch {
    console.error("Assistant poll failed.");
    return Response.json({ error: "Assistant poll failed." }, { status: 500, headers: noStore });
  }
}
