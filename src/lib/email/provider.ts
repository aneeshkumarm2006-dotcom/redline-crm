import "server-only";

import { randomUUID } from "node:crypto";
import nodemailer, { type Transporter } from "nodemailer";
import { Resend } from "resend";
import { z } from "zod";

const messageSchema = z.object({
  from: z.string().email(),
  // Display name shown to recipients, e.g. the dealership's company name.
  fromName: z.string().trim().min(1).max(120).refine((value) => !/[\r\n"<>]/.test(value)).optional(),
  to: z.array(z.string().email()).min(1),
  subject: z.string().min(1).refine((value) => !/[\r\n]/.test(value)),
  html: z.string().min(1),
  text: z.string().optional(),
  replyTo: z.string().email().optional(),
});
export type EmailMessage = z.infer<typeof messageSchema>;
export type EmailReceipt = { id: string; provider: "console" | "resend" | "smtp" };
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
    const { fromName, ...validated } = messageSchema.parse(message);
    const { data, error } = await this.client.emails.send({ ...validated, from: fromName ? `"${fromName}" <${validated.from}>` : validated.from });
    if (error || !data) throw new Error("Email delivery failed.");
    return { id: data.id, provider: "resend" };
  }
}

/**
 * SMTP (e.g. Gmail with an app password). Gmail only sends as the signed-in account (or its verified aliases), so the
 * sender address comes from SMTP_FROM / SMTP_USER and the brand appears as the display name.
 */
export class SmtpProvider implements EmailProvider {
  private readonly transport: Transporter;

  constructor(options: { host: string; port: number; user: string; pass: string }) {
    if (!options.user.trim() || !options.pass.trim()) throw new Error("SMTP_USER and SMTP_PASS are required for SMTP delivery.");
    this.transport = nodemailer.createTransport({ host: options.host, port: options.port, secure: options.port === 465,
      auth: { user: options.user, pass: options.pass } });
  }

  async send(message: EmailMessage): Promise<EmailReceipt> {
    const { fromName, ...validated } = messageSchema.parse(message);
    try {
      const info = await this.transport.sendMail({ ...validated, from: fromName ? { name: fromName, address: validated.from } : validated.from });
      return { id: info.messageId, provider: "smtp" };
    } catch {
      // Provider diagnostics can echo credentials or addresses; callers get a generic failure.
      throw new Error("Email delivery failed.");
    }
  }
}

const emailMode = () => {
  const mode = process.env.EMAIL_PROVIDER;
  if (mode && mode !== "console" && mode !== "resend" && mode !== "smtp") throw new Error("Invalid EMAIL_PROVIDER.");
  return mode ?? (process.env.NODE_ENV === "production" ? "resend" : "console");
};

/** Sender for system email: the configured address, or a placeholder that only the console provider accepts. */
export function senderAddress(emailFrom: string | null) {
  // SMTP accounts can only send as themselves, so their address wins over the settings value.
  if (emailMode() === "smtp") {
    const account = (process.env.SMTP_FROM || process.env.SMTP_USER || "").trim();
    if (!z.string().email().safeParse(account).success) throw new Error("Set SMTP_USER (or SMTP_FROM) to the sending address.");
    return account;
  }
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
/**
 * Reserved test domains (RFC 2606/6761) can never receive mail. Demo data uses them, so real delivery skips them:
 * they are logged through the console provider instead of producing bounces in the sending mailbox.
 */
export const isUndeliverable = (address: string) => {
  const domain = address.split("@").pop()?.toLowerCase() ?? "";
  return /(^|\.)(example|invalid|test|localhost)$/.test(domain) || /^example\.(com|net|org)$/.test(domain);
};

class LoggedSmtpProvider extends SmtpProvider {
  readonly [logged] = true;
  override send(message: EmailMessage, refs: EmailRefs = {}) {
    if (message.to.every(isUndeliverable)) return sendAndLog(message, refs, "console", (value) => new ConsoleProvider().send(value));
    const deliverable = { ...message, to: message.to.filter((address) => !isUndeliverable(address)) };
    return sendAndLog(deliverable, refs, "smtp", (value) => super.send(value));
  }
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
  const mode = emailMode();
  if (mode === "smtp") return new LoggedSmtpProvider({ host: process.env.SMTP_HOST || "smtp.gmail.com", port: Number(process.env.SMTP_PORT || 465),
    user: process.env.SMTP_USER ?? "", pass: (process.env.SMTP_PASS ?? "").replace(/\s+/g, "") });
  return mode === "resend" ? new LoggedResendProvider(process.env.RESEND_API_KEY ?? "") : new LoggedConsoleProvider();
}
