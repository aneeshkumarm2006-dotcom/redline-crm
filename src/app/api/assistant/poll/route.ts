import { createHash, timingSafeEqual } from "node:crypto";
import { runAssistantCycle } from "@/modules/assistant/inbox";

// Reading mail and a few Claude replies can take a while; stay within the platform's function limit.
export const maxDuration = 300;
const noStore = { "Cache-Control": "no-store" };
const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Virtual assistant: reads the reply inbox and answers waiting customer emails. Call it every few minutes from a
 * scheduler with `Authorization: Bearer <CRON_SECRET>` (Vercel Cron on a paid plan, or any external cron service).
 * Safe to call often or concurrently: polls never overlap and each email is stored and answered once.
 */
export async function GET(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured." }, { status: 503, headers: noStore });
  if (!timingSafeEqual(digest(header), digest(`Bearer ${secret}`))) return Response.json({ error: "Unauthorized." }, { status: 401, headers: noStore });
  try {
    const { poll, queue } = await runAssistantCycle(Date.now());
    return Response.json({ inbox: poll, answered: queue.outcomes.length }, { headers: noStore });
  } catch {
    console.error("Assistant poll failed.");
    return Response.json({ error: "Assistant poll failed." }, { status: 500, headers: noStore });
  }
}
