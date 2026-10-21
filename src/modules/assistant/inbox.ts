import "server-only";
import { ImapFlow } from "imapflow";
import { simpleParser, type AddressObject, type ParsedMail } from "mailparser";
import { connectDb } from "@/lib/db";
import { htmlToText, messageIds } from "@/lib/email/text";
import { requireRole } from "@/modules/auth/service";
import { AssistantStateModel } from "./model";
import { inboundWebhookSchema } from "./schema";
import { inboxConfig, ingestInboundEmail, processAssistantQueue, type InboundEmail, type IngestResult } from "./service";

const MINUTE = 60_000;
const MAX_PER_POLL = 40;
const MAX_BYTES = 5 * 1024 * 1024;
// The first poll (or a mailbox reset) only picks up very recent mail, so turning the assistant on never answers a backlog.
const FIRST_POLL_WINDOW = 30 * MINUTE;
// Never answer mail older than this, even if the poller was down for a while.
const MAX_AGE = 3 * 24 * 60 * MINUTE;

const addresses = (value: AddressObject | AddressObject[] | undefined) =>
  (Array.isArray(value) ? value : value ? [value] : []).flatMap((entry) => entry.value).map((entry) => entry.address?.toLowerCase() ?? "").filter(Boolean);

/** A parsed RFC 822 message in the shape the assistant stores. */
export function toInboundEmail(parsed: ParsedMail, receivedAt?: Date): InboundEmail {
  const sender = parsed.from?.value[0];
  const headers: Record<string, string> = {};
  for (const { key, line } of parsed.headerLines) headers[key.toLowerCase()] = line.slice(line.indexOf(":") + 1).trim().slice(0, 500);
  return {
    messageId: messageIds(parsed.messageId)[0] ?? null, from: sender?.address?.toLowerCase() ?? "", fromName: sender?.name ?? "",
    to: addresses(parsed.to), subject: parsed.subject ?? "", text: parsed.text?.trim() || htmlToText(typeof parsed.html === "string" ? parsed.html : ""),
    inReplyTo: messageIds(parsed.inReplyTo)[0] ?? null, references: messageIds(parsed.references), headers,
    receivedAt: receivedAt ?? parsed.date ?? new Date(),
  };
}

export const parseRawEmail = async (raw: string | Buffer, receivedAt?: Date) => toInboundEmail(await simpleParser(raw, { skipImageLinks: true }), receivedAt);

/** Inbound webhook body (raw message, or parsed fields from providers such as Postmark or Mailgun). */
export async function ingestWebhookEmail(body: unknown): Promise<IngestResult> {
  const data = inboundWebhookSchema.parse(body);
  if ("raw" in data) return ingestInboundEmail(await parseRawEmail(data.raw));
  const sender = data.from.match(/<([^<>\s]+@[^<>\s]+)>/)?.[1] ?? data.from.trim();
  const name = data.from.includes("<") ? data.from.slice(0, data.from.indexOf("<")).replace(/"/g, "").trim() : "";
  const date = data.date ? new Date(data.date) : new Date();
  return ingestInboundEmail({
    messageId: messageIds(data.messageId)[0] ?? null, from: sender.toLowerCase(), fromName: name,
    to: (Array.isArray(data.to) ? data.to : data.to ? [data.to] : []).map((entry) => entry.toLowerCase()),
    subject: data.subject, text: data.text || htmlToText(data.html ?? ""), inReplyTo: messageIds(data.inReplyTo)[0] ?? null,
    references: messageIds(data.references), headers: Object.fromEntries(Object.entries(data.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value])),
    receivedAt: Number.isNaN(date.getTime()) ? new Date() : date,
  });
}

export type PollSummary = { configured: boolean; fetched: number; queued: number; error: string | null };

/** Owner-safe reason for an IMAP failure; never echoes server responses or credentials. */
function pollFailure(error: unknown) {
  const text = error && typeof error === "object" ? `${"code" in error ? String(error.code) : ""} ${"authenticationFailed" in error && error.authenticationFailed ? "AUTH" : ""} ${"responseText" in error ? String(error.responseText) : ""}` : "";
  if (/AUTH|AUTHENTICATIONFAILED|Invalid credentials/i.test(text)) return "The mailbox rejected the sign-in: check the app password, and that IMAP is enabled in Gmail settings.";
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ECONNRESET|EAI_AGAIN/i.test(text)) return "Could not connect to the mail server; check ASSISTANT_IMAP_HOST and ASSISTANT_IMAP_PORT.";
  return "The inbox could not be read.";
}

/**
 * Reads new mail from the reply inbox (INBOX, by UID) and stores each message for the assistant. The mailbox is left
 * untouched (nothing is marked read or moved). One poll at a time across instances; repeated polls never store twice.
 */
export async function pollInbox(now = Date.now()): Promise<PollSummary> {
  const config = inboxConfig();
  if (!config) return { configured: false, fetched: 0, queued: 0, error: null };
  await connectDb();
  try {
    await AssistantStateModel.updateOne({ _id: "inbox" }, { $setOnInsert: { lastUid: 0 } }, { upsert: true }).exec();
  } catch (error) { if (!(error instanceof Error && "code" in error && error.code === 11000)) throw error; }
  const claimed = await AssistantStateModel.findOneAndUpdate({ _id: "inbox", $or: [{ lockedUntil: null }, { lockedUntil: { $lte: new Date(now) } }] },
    { $set: { lockedUntil: new Date(now + 2 * MINUTE) } }, { returnDocument: "after" }).lean().exec();
  if (!claimed) return { configured: true, fetched: 0, queued: 0, error: null };
  const client = new ImapFlow({ host: config.host, port: config.port, secure: config.port === 993, auth: { user: config.user, pass: config.pass },
    logger: false, connectionTimeout: 20_000, greetingTimeout: 15_000, socketTimeout: 60_000 });
  let fetched = 0;
  let queued = 0;
  let lastUid = claimed.lastUid ?? 0;
  let uidValidity = claimed.uidValidity ?? null;
  let error: string | null = null;
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const mailbox = client.mailbox;
      if (!mailbox) throw new Error("INBOX is not open.");
      const validity = String(mailbox.uidValidity);
      const fresh = validity !== uidValidity;
      const uids = fresh
        ? await client.search({ since: new Date(now - 2 * 24 * 60 * MINUTE) }, { uid: true })
        : await client.search({ uid: `${lastUid + 1}:*` }, { uid: true });
      const candidates = (uids || []).filter((uid) => fresh || uid > lastUid).sort((a, b) => a - b);
      // A first poll starts at the newest mail: everything older is skipped for good, never read on a later poll.
      const pending = fresh ? candidates.slice(-MAX_PER_POLL) : candidates.slice(0, MAX_PER_POLL);
      if (fresh) { uidValidity = validity; lastUid = candidates.at(-1) ?? Math.max(0, Number(mailbox.uidNext ?? 1) - 1); }
      const earliest = fresh ? now - FIRST_POLL_WINDOW : now - MAX_AGE;
      for (const uid of pending) {
        lastUid = Math.max(lastUid, uid);
        // Dates first (cheap), so old mail is skipped without downloading it.
        const header = await client.fetchOne(String(uid), { uid: true, size: true, internalDate: true }, { uid: true });
        const receivedAt = header && header.internalDate ? new Date(header.internalDate) : undefined;
        if (!header || (header.size ?? 0) > MAX_BYTES || !receivedAt || receivedAt.getTime() < earliest) continue;
        const message = await client.fetchOne(String(uid), { uid: true, source: true }, { uid: true });
        if (!message || !message.source) continue;
        const result = await ingestInboundEmail(await parseRawEmail(message.source, receivedAt), { earliest });
        fetched++;
        if (result.status === "pending") queued++;
      }
    } finally { lock.release(); }
    await client.logout();
  } catch (failure) {
    error = pollFailure(failure);
    console.error("Assistant inbox poll failed.", { reason: error });
    client.close();
  } finally {
    await AssistantStateModel.updateOne({ _id: "inbox" }, { $set: { uidValidity, lastUid, lastPollAt: new Date(), lastError: error, lastFetched: fetched, lockedUntil: null } }).exec();
  }
  return { configured: true, fetched, queued, error };
}

/** Poll the inbox, then answer everything waiting. Used by the poll route, the cron job and the in-process scheduler. */
export async function runAssistantCycle(now = Date.now()) {
  const poll = await pollInbox(now);
  const queue = await processAssistantQueue(Date.now());
  return { poll, queue };
}

/** Owner's Check inbox now button. */
export async function runAssistantCycleNow() {
  await requireRole("owner");
  return runAssistantCycle();
}
