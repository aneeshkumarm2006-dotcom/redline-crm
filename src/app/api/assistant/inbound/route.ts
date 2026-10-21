import { createHash, timingSafeEqual } from "node:crypto";
import { ZodError } from "zod";
import { ingestWebhookEmail } from "@/modules/assistant/inbox";

export const maxDuration = 300;
const noStore = { "Cache-Control": "no-store" };
const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Push delivery for the virtual assistant: an inbound-email provider (Cloudflare Email Workers, Postmark, Mailgun…)
 * posts each customer email here with `Authorization: Bearer <ASSISTANT_INBOUND_SECRET>`. JSON body: `{ raw }` with the
 * RFC 822 message, or `{ from, subject, text, html?, messageId?, inReplyTo?, references?, headers? }`. Replays are ignored.
 */
export async function POST(request: Request) {
  const secret = process.env.ASSISTANT_INBOUND_SECRET;
  if (!secret) return Response.json({ error: "ASSISTANT_INBOUND_SECRET is not configured." }, { status: 503, headers: noStore });
  if (!timingSafeEqual(digest(request.headers.get("authorization") ?? ""), digest(`Bearer ${secret}`))) {
    return Response.json({ error: "Unauthorized." }, { status: 401, headers: noStore });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Send a JSON body." }, { status: 400, headers: noStore }); }
  try {
    const result = await ingestWebhookEmail(body);
    return Response.json({ status: result.status }, { headers: noStore });
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: "Invalid email payload." }, { status: 400, headers: noStore });
    console.error("Inbound email could not be stored.");
    return Response.json({ error: "Inbound email failed." }, { status: 500, headers: noStore });
  }
}
