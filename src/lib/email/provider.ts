import "server-only";

import { randomUUID } from "node:crypto";
import { Resend } from "resend";
import { z } from "zod";

const messageSchema = z.object({
  from: z.string().email(),
  to: z.array(z.string().email()).min(1),
  subject: z.string().min(1).refine((value) => !/[\r\n]/.test(value)),
  html: z.string().min(1),
  text: z.string().optional(),
  replyTo: z.string().email().optional(),
});
export type EmailMessage = z.infer<typeof messageSchema>;
export type EmailReceipt = { id: string; provider: "console" | "resend" };
/** Optional context stored with the Email log entry. */
export type EmailRefs = { templateKey?: string | null; leadId?: string | null; vehicleId?: string | null };
export interface EmailProvider { send(message: EmailMessage, refs?: EmailRefs): Promise<EmailReceipt> }

export class ConsoleProvider implements EmailProvider {
  constructor(private readonly log: (message: string) => void = console.info) {}

  async send(message: EmailMessage): Promise<EmailReceipt> {
    const validated = messageSchema.parse(message);
    const id = `console-${randomUUID()}`;
    this.log(`[email:console] ${JSON.stringify({ id, ...validated })}`);
    return { id, provider: "console" };
  }
}

export class ResendProvider implements EmailProvider {
  private readonly client: Resend;

  constructor(apiKey: string) {
    if (!apiKey.trim()) throw new Error("RESEND_API_KEY is required for email delivery.");
    this.client = new Resend(apiKey);
  }

  async send(message: EmailMessage): Promise<EmailReceipt> {
    const validated = messageSchema.parse(message);
    const { data, error } = await this.client.emails.send(validated);
    if (error || !data) throw new Error("Email delivery failed.");
    return { id: data.id, provider: "resend" };
  }
}

/** Sender for system email: the configured address, or a placeholder that only the console provider accepts. */
export function senderAddress(emailFrom: string | null) {
  const consoleMode = process.env.EMAIL_PROVIDER === "console" || (!process.env.EMAIL_PROVIDER && process.env.NODE_ENV !== "production");
  const from = emailFrom ?? (consoleMode ? "demo@example.invalid" : null);
  if (!from) throw new Error("Configure settings.emailFrom with a verified sender before sending email.");
  return from;
}

/** Stored instead of provider diagnostics, which can echo addresses or account details. */
const DELIVERY_FAILED = "Email delivery failed.";
const logged = Symbol("emailLog");

/**
 * Sends through `deliver` and writes the attempt to the Email log, delivered or not. A logging failure never
 * hides the delivery outcome; a delivery failure is re-thrown after it is logged.
 */
export async function sendAndLog(message: EmailMessage, refs: EmailRefs, provider: EmailReceipt["provider"], deliver: (message: EmailMessage) => Promise<EmailReceipt>) {
  let failure: unknown = null;
  let receipt: EmailReceipt | null = null;
  try { receipt = await deliver(message); } catch (error) { failure = error; }
  try {
    // Loaded lazily: the automations module owns the Email log and itself sends through this provider.
    const { recordEmail } = await import("@/modules/automations/service");
    await recordEmail({ to: message.to, subject: message.subject, html: message.html, templateKey: refs.templateKey ?? null,
      leadId: refs.leadId ?? null, vehicleId: refs.vehicleId ?? null, provider: receipt?.provider ?? provider,
      status: failure ? "failed" : "sent", error: failure ? DELIVERY_FAILED : null, sentAt: new Date().toISOString() });
  } catch { console.error("Email log write failed.", { leadId: refs.leadId ?? null, templateKey: refs.templateKey ?? null }); }
  if (failure) throw failure;
  return receipt!;
}

class LoggedConsoleProvider extends ConsoleProvider {
  readonly [logged] = true;
  override send(message: EmailMessage, refs: EmailRefs = {}) { return sendAndLog(message, refs, "console", (value) => super.send(value)); }
}
class LoggedResendProvider extends ResendProvider {
  readonly [logged] = true;
  override send(message: EmailMessage, refs: EmailRefs = {}) { return sendAndLog(message, refs, "resend", (value) => super.send(value)); }
}
/** True for providers from `getEmailProvider()`, whose sends already land in the Email log. */
export const isLoggedProvider = (provider: EmailProvider) => logged in provider;

/**
 * Development always stays local. Production fails closed if delivery is unconfigured.
 * Every send through the returned provider (console or Resend) is written to the Email log, failures included.
 */
export function getEmailProvider(): EmailProvider {
  const mode = process.env.EMAIL_PROVIDER;
  if (mode && mode !== "console" && mode !== "resend") throw new Error("Invalid EMAIL_PROVIDER.");
  return (mode === "resend" || (!mode && process.env.NODE_ENV === "production"))
    ? new LoggedResendProvider(process.env.RESEND_API_KEY ?? "")
    : new LoggedConsoleProvider();
}
