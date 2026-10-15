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
export interface EmailProvider { send(message: EmailMessage): Promise<EmailReceipt> }

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

/** Development always stays local. Production fails closed if delivery is unconfigured. */
export function getEmailProvider(): EmailProvider {
  const mode = process.env.EMAIL_PROVIDER;
  if (mode && mode !== "console" && mode !== "resend") throw new Error("Invalid EMAIL_PROVIDER.");
  return (mode === "resend" || (!mode && process.env.NODE_ENV === "production"))
    ? new ResendProvider(process.env.RESEND_API_KEY ?? "")
    : new ConsoleProvider();
}
