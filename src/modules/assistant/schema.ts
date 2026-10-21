import { z } from "zod";
import { dateTimeSchema, objectIdSchema } from "@/lib/data-schema";

/**
 * One message in a customer conversation: an email (or the website inquiry) from the customer, or a reply from the
 * virtual assistant or staff. Inbound statuses track what the assistant did with it; outbound statuses track delivery.
 */
export const inboundStatuses = ["pending", "processing", "replied", "drafted", "handed_off", "ignored", "skipped", "failed"] as const;
export const outboundStatuses = ["draft", "sent", "failed", "discarded"] as const;
export type InboundStatus = (typeof inboundStatuses)[number];
export type OutboundStatus = (typeof outboundStatuses)[number];
export const messageAuthors = ["customer", "assistant", "staff"] as const;
export const messageSources = ["email", "inquiry", "reply"] as const;

const messageIdSchema = z.string().trim().min(3).max(998);
export const assistantMessageInputSchema = z.object({
  // Always set in practice: mail that matches no lead is not stored (the inbox is a working mailbox).
  leadId: objectIdSchema.nullable(),
  direction: z.enum(["inbound", "outbound"]),
  // `inquiry` is the message typed in the website form; `reply` is an outbound answer.
  source: z.enum(messageSources),
  author: z.enum(messageAuthors),
  // Staff member who wrote, approved or requested this message.
  authorId: objectIdSchema.nullable().default(null),
  fromEmail: z.string().trim().max(254),
  fromName: z.string().trim().max(200).default(""),
  to: z.array(z.string().trim().max(254)).max(20).default([]),
  subject: z.string().trim().max(300).default(""),
  text: z.string().max(20_000),
  messageId: messageIdSchema.nullable().default(null),
  inReplyTo: messageIdSchema.nullable().default(null),
  references: z.array(messageIdSchema).max(30).default([]),
  status: z.enum([...inboundStatuses, ...outboundStatuses]),
  // Why the assistant acted as it did (shown to staff), or why delivery failed.
  note: z.string().trim().max(2000).default(""),
  // Inbound messages an outbound reply answers (draft approval marks them handled).
  answers: z.array(objectIdSchema).max(50).default([]),
  attempts: z.number().int().min(0).max(100).default(0),
  nextAttemptAt: dateTimeSchema.nullable().default(null),
  occurredAt: dateTimeSchema,
}).strict();
export const assistantMessageSchema = assistantMessageInputSchema.extend({ id: objectIdSchema });
export type AssistantMessage = z.infer<typeof assistantMessageSchema>;

/** Per-lead assistant state: paused (a person has taken over) or opted out (the customer asked not to be emailed). */
export type AssistantThread = { paused: boolean; pausedReason: string; pausedAt: string | null; optedOut: boolean };

/** Generic inbound webhook (Cloudflare Email Workers, Postmark, Mailgun, SendGrid…): a raw RFC 822 message or parsed fields. */
export const inboundWebhookSchema = z.union([
  z.object({ raw: z.string().min(1).max(10_000_000) }).strict(),
  z.object({
    from: z.string().trim().min(3).max(500), to: z.union([z.string(), z.array(z.string())]).optional(),
    subject: z.string().max(1000).default(""), text: z.string().max(200_000).default(""), html: z.string().max(2_000_000).optional(),
    messageId: z.string().max(998).optional(), inReplyTo: z.string().max(998).optional(),
    references: z.union([z.string().max(20_000), z.array(z.string().max(998))]).optional(),
    headers: z.record(z.string(), z.string()).optional(), date: z.string().optional(),
  }),
]);

/** Staff forms on the lead's Conversation tab. */
export const staffReplySchema = z.object({ leadId: objectIdSchema, body: z.string().trim().min(1, "Write a reply first.").max(8000) }).strict();
export const draftDecisionSchema = z.object({ id: objectIdSchema, body: z.string().trim().min(1, "The reply is empty.").max(8000) }).strict();
export const draftIdSchema = z.object({ id: objectIdSchema }).strict();
export const pauseSchema = z.object({ leadId: objectIdSchema, paused: z.boolean() }).strict();

export type AssistantActionResult = { ok: true; warning?: string } | { ok: false; message: string };
