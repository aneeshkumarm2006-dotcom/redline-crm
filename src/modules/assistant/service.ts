import "server-only";
import { createHash } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { objectIdSchema } from "@/lib/data-schema";
import type { AppEvent } from "@/lib/events";
import { EmailSetupError, appUrlProblem, emailDeliveryStatus, senderAddress } from "@/lib/email/provider";
import { emailUrl } from "@/lib/email/url";
import { conversationEmail } from "@/lib/email/layout";
import { isAutomatedEmail, messageIds, replySubject, stripQuotedReply, textToHtml } from "@/lib/email/text";
import { requireRole } from "@/modules/auth/service";
import { getSettings } from "@/modules/settings/service";
import type { Settings } from "@/modules/settings/schema";
import { appendLeadActivity, findLeadIdByCustomerEmail, getLead, getLeadForAutomation, getLeadSummaries, recordLeadEmailContact } from "@/modules/leads/service";
import type { Lead } from "@/modules/leads/schema";
import { getPublicVehicle, getVehicleForAutomation, listPublicVehicles } from "@/modules/inventory/service";
import { getDealershipForAutomation, listPublicDealerships } from "@/modules/dealerships/service";
import { findActiveUser, listAutomationStaff } from "@/modules/users/service";
import { BookingError, bookForAssistant, getAssistantSlots } from "@/modules/appointments/service";
import { notifyUsers } from "@/modules/notifications/service";
import { findLeadByEmailMessageIds, getLatestThreadEmail, listLeadEmailsForAssistant, newMessageId, sendLoggedEmail } from "@/modules/automations/service";
import { AssistantSetupError, DEFAULT_ASSISTANT_MODEL, runAssistantAgent, type AgentContext, type AgentDecision, type AgentHistoryItem, type AgentTools } from "./agent";
import { AssistantMessageModel, AssistantStateModel, AssistantThreadModel } from "./model";
import { assistantMessageInputSchema, assistantMessageSchema, draftDecisionSchema, draftIdSchema, pauseSchema, staffReplySchema, type AssistantMessage, type AssistantThread, type InboundStatus } from "./schema";
import { assistantActivity, assistantAlerts, assistantCopy, assistantNotes } from "./copy";

export class AssistantError extends Error {}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const LOCK_MS = 3 * MINUTE;
const MAX_ATTEMPTS = 3;
const HISTORY_ITEMS = 14;

/** A parsed inbound email, from the IMAP poller or the inbound webhook. */
export type InboundEmail = {
  messageId: string | null; from: string; fromName: string; to: string[]; subject: string; text: string;
  inReplyTo: string | null; references: string[]; headers: Record<string, string>; receivedAt: Date;
};

function plain(document: unknown) {
  const { _id, __v, createdAt, updatedAt, ...data } = JSON.parse(JSON.stringify(document));
  void __v; void createdAt; void updatedAt;
  return { ...data, id: _id };
}
const toMessage = (document: unknown): AssistantMessage => assistantMessageSchema.parse(plain(document));
const vehicleTitle = (vehicle: { year: number; make: string; model: string; trim: string }) => `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`.trim();
const money = (amount: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(amount);
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
const isDuplicateKey = (error: unknown) => error instanceof Error && "code" in error && error.code === 11000;

/** The site origin for links in replies, or null when APP_URL is unusable. */
function siteOrigin() {
  return appUrlProblem() ? null : new URL(process.env.APP_URL!.trim()).origin;
}

/** Addresses that are the dealership itself; mail from them is never treated as a customer reply. */
function ownAddresses(settings: Settings) {
  return new Set([process.env.SMTP_USER, process.env.SMTP_FROM, process.env.ASSISTANT_IMAP_USER, process.env.EMAIL_REPLY_TO, settings.emailFrom]
    .map((value) => value?.trim().toLowerCase()).filter((value): value is string => Boolean(value)));
}

// ---------------------------------------------------------------------------------------------------------------------
// Per-lead thread state and the processing lock
// ---------------------------------------------------------------------------------------------------------------------

async function ensureThread(leadId: string) {
  await connectDb();
  try {
    await AssistantThreadModel.updateOne({ _id: leadId }, { $setOnInsert: { paused: false, optedOut: false, lockedUntil: null } }, { upsert: true }).exec();
  } catch (error) { if (!isDuplicateKey(error)) throw error; }
}

async function readThread(leadId: string): Promise<AssistantThread> {
  await connectDb();
  const thread = await AssistantThreadModel.findById(leadId).lean().exec();
  return { paused: thread?.paused ?? false, pausedReason: thread?.pausedReason ?? "", pausedAt: thread?.pausedAt ? thread.pausedAt.toISOString() : null, optedOut: thread?.optedOut ?? false };
}

/** Exclusive for a few minutes per lead across instances, so two runs never answer the same conversation. */
async function lockThread(leadId: string) {
  await ensureThread(leadId);
  const now = new Date();
  const result = await AssistantThreadModel.updateOne({ _id: leadId, $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }] },
    { $set: { lockedUntil: new Date(now.getTime() + LOCK_MS) } }).exec();
  return result.modifiedCount > 0;
}
const unlockThread = (leadId: string) => AssistantThreadModel.updateOne({ _id: leadId }, { $set: { lockedUntil: null } }).exec();

async function setPaused(leadId: string, paused: boolean, reason: string, by: string | null) {
  await ensureThread(leadId);
  await AssistantThreadModel.updateOne({ _id: leadId }, { $set: paused
    ? { paused: true, pausedReason: reason.slice(0, 300), pausedAt: new Date(), pausedBy: by }
    : { paused: false, pausedReason: "", pausedAt: null, pausedBy: null } }).exec();
}

/** Internal (reminders): whether templated follow-ups should hold off for this lead. */
export async function getAssistantContactState(leadId: string, now = Date.now()) {
  const id = objectIdSchema.parse(leadId);
  await connectDb();
  const [thread, customer, reply] = await Promise.all([
    AssistantThreadModel.findById(id).select("optedOut").lean().exec(),
    AssistantMessageModel.exists({ leadId: id, direction: "inbound", source: "email", status: { $ne: "ignored" }, occurredAt: { $gte: new Date(now - 3 * DAY) } }).exec(),
    AssistantMessageModel.exists({ leadId: id, direction: "outbound", status: "sent", occurredAt: { $gte: new Date(now - 2 * DAY) } }).exec(),
  ]);
  return { optedOut: thread?.optedOut ?? false, inConversation: Boolean(customer || reply) };
}

// ---------------------------------------------------------------------------------------------------------------------
// Intake: customer emails and website inquiry messages
// ---------------------------------------------------------------------------------------------------------------------

async function insertMessage(input: z.input<typeof assistantMessageInputSchema>) {
  const record = assistantMessageInputSchema.parse(input);
  await connectDb();
  await AssistantMessageModel.init();
  try { return toMessage(await AssistantMessageModel.create(record)); }
  catch (error) { if (isDuplicateKey(error)) return null; throw error; }
}

const syntheticMessageId = (email: InboundEmail) =>
  `<${createHash("sha256").update([email.from, email.receivedAt.toISOString(), email.subject, email.text.slice(0, 500)].join("\n")).digest("hex").slice(0, 32)}@inbound.invalid>`;

export type IngestResult = { status: "own" | "duplicate" | InboundStatus; leadId: string | null };

/**
 * Stores one inbound email and queues it for the assistant. Matching: our Message-IDs in In-Reply-To/References
 * (any email the CRM sent, or an earlier message in this conversation), then the sender's address. Automatic replies,
 * unknown senders and mail older than `earliest` are stored but not answered. Idempotent per Message-ID.
 */
export async function ingestInboundEmail(email: InboundEmail, options: { earliest?: number } = {}): Promise<IngestResult> {
  const settings = await getSettings();
  const from = email.from.trim().toLowerCase();
  if (!from || ownAddresses(settings).has(from)) return { status: "own", leadId: null };
  const messageId = messageIds(email.messageId)[0] ?? syntheticMessageId(email);
  await connectDb();
  if (await AssistantMessageModel.exists({ messageId }).exec()) return { status: "duplicate", leadId: null };
  const references = messageIds([...(email.references ?? []), email.inReplyTo ?? ""]);
  let leadId = references.length ? await findLeadByEmailMessageIds(references) : null;
  if (!leadId && references.length) {
    const earlier = await AssistantMessageModel.findOne({ messageId: { $in: references }, leadId: { $ne: null } }).select("leadId").lean().exec();
    leadId = earlier?.leadId ? String(earlier.leadId) : null;
  }
  leadId ??= await findLeadIdByCustomerEmail(from);
  const lead = leadId ? await getLeadForAutomation(leadId) : null;
  const automated = isAutomatedEmail({ from, subject: email.subject, headers: email.headers });
  // Newsletters and notices to the mailbox that belong to no customer are not stored at all.
  if (!lead && automated) return { status: "ignored", leadId: null };
  let status: InboundStatus = "pending";
  let note = "";
  if (!lead) { status = "ignored"; note = assistantNotes.unmatched; }
  else if (automated) { status = "ignored"; note = automated; }
  else if (options.earliest && email.receivedAt.getTime() < options.earliest) { status = "ignored"; note = assistantNotes.stale; }
  // A reply in the thread from someone other than the customer (a forward, a spouse) goes to staff, never answered automatically.
  else if (lead.email.toLowerCase() !== from) { status = "skipped"; note = `Sent from ${from}, not the customer's address ${lead.email}.`; }
  const saved = await insertMessage({ leadId: lead?.id ?? null, direction: "inbound", source: "email", author: "customer",
    fromEmail: from.slice(0, 254), fromName: email.fromName.slice(0, 200), to: email.to.slice(0, 20).map((address) => address.slice(0, 254)),
    // Mail from unknown senders keeps only the sender and subject: the mailbox may hold unrelated personal mail.
    subject: email.subject.replace(/[\r\n]+/g, " ").trim().slice(0, 300), text: lead ? stripQuotedReply(email.text).slice(0, 20_000) : "",
    messageId, inReplyTo: messageIds(email.inReplyTo)[0] ?? null, references, status, note, occurredAt: email.receivedAt.toISOString() });
  if (!saved) return { status: "duplicate", leadId: null };
  if (lead && (status === "pending" || status === "skipped")) {
    await appendLeadActivity(lead.id, { type: "customer_email", message: assistantActivity.customerEmail(saved.subject), occurredAt: saved.occurredAt, actorId: null });
  }
  if (lead && status === "skipped") await alertStaff(lead, "assistant.customer_reply", `assistant-reply:${saved.id}`, assistantAlerts.customerReply(lead.name, "from another address"));
  if (status === "pending") scheduleAssistantProcessing();
  return { status, leadId: lead?.id ?? null };
}

/**
 * `lead.created` handler: queues the question typed in a public website inquiry, so the assistant answers it personally
 * (after the automatic thank-you email). Staff-entered leads are skipped: their message field holds staff notes.
 */
export async function queueInquiryForAssistant(event: AppEvent<"lead.created">) {
  const { assistant } = await getSettings();
  if (!assistant.enabled || !assistant.answerInquiries) return;
  const lead = await getLeadForAutomation(event.payload.leadId);
  const created = lead.activity.find((entry) => entry.type === "lead.created");
  if (!lead.message.trim() || !created || created.actorId) return;
  const saved = await insertMessage({ leadId: lead.id, direction: "inbound", source: "inquiry", author: "customer", fromEmail: lead.email, fromName: lead.name,
    subject: "", text: lead.message.slice(0, 20_000), messageId: `<inquiry-${lead.id}@inquiry.invalid>`, status: "pending", occurredAt: created.occurredAt });
  if (saved) scheduleAssistantProcessing();
}

/**
 * Runs the queue after the current response when inside a request (server action, route), else right away in the
 * background. The poll route, cron and in-process scheduler also drain it, so a lost run is picked up later.
 */
export function scheduleAssistantProcessing() {
  const run = () => processAssistantQueue().then(() => undefined, () => console.error("Assistant queue run failed; the next poll retries."));
  try { after(run); } catch { void run(); }
}

// ---------------------------------------------------------------------------------------------------------------------
// Processing: one conversation at a time
// ---------------------------------------------------------------------------------------------------------------------

const dueFilter = (now: number) => ({ $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: new Date(now) } }] });

/** Answers waiting customer messages, oldest conversation first. Internal: the poll route, cron and scheduler call it. */
export async function processAssistantQueue(now = Date.now(), maxLeads = 10) {
  await connectDb();
  // Messages a crashed run left in `processing` go back to the queue.
  await AssistantMessageModel.updateMany({ direction: "inbound", status: "processing", updatedAt: { $lt: new Date(now - 10 * MINUTE) } }, { $set: { status: "pending" } }).exec();
  const due = await AssistantMessageModel.aggregate<{ _id: unknown }>([
    { $match: { direction: "inbound", status: "pending", leadId: { $ne: null }, ...dueFilter(now) } },
    { $group: { _id: "$leadId", first: { $min: "$occurredAt" } } }, { $sort: { first: 1 } }, { $limit: maxLeads },
  ]).exec();
  const outcomes: string[] = [];
  for (const row of due) {
    try { outcomes.push((await processLead(String(row._id))).status); }
    catch { outcomes.push("failed"); console.error("Assistant could not process a conversation.", { leadId: String(row._id) }); }
  }
  return { leads: due.length, outcomes };
}

type Gate = { status: InboundStatus; note: string; alert: boolean };
async function gateFor(lead: Lead, settings: Settings, thread: AssistantThread, now: number): Promise<Gate | null> {
  if (!settings.assistant.enabled) return { status: "skipped", note: assistantNotes.off, alert: true };
  if (thread.optedOut) return { status: "skipped", note: assistantNotes.optedOut, alert: true };
  if (thread.paused) return { status: "skipped", note: assistantNotes.paused(thread.pausedReason), alert: true };
  if (lead.stage === settings.wonStageKey || lead.stage === settings.lostStageKey) return { status: "skipped", note: assistantNotes.closed, alert: true };
  const today = await AssistantMessageModel.countDocuments({ leadId: lead.id, direction: "outbound", author: "assistant", status: "sent", occurredAt: { $gte: new Date(now - DAY) } }).exec();
  if (today >= settings.assistant.maxRepliesPerDay) return { status: "handed_off", note: assistantNotes.dailyLimit(settings.assistant.maxRepliesPerDay), alert: true };
  return null;
}

/** Salesperson on the lead (owners too when urgent or nobody is assigned). Alerts are deduplicated by `eventId`. */
async function alertStaff(lead: Pick<Lead, "id" | "assignedTo" | "dealershipId">, event: "assistant.handoff" | "assistant.draft" | "assistant.customer_reply", eventId: string, message: string, urgent = false) {
  try {
    const assigned = lead.assignedTo ? await findActiveUser(lead.assignedTo) : null;
    const owners = !assigned || urgent ? (await listAutomationStaff(lead.dealershipId, true)).map((user) => user.id) : [];
    const userIds = [...(assigned ? [assigned.id] : []), ...owners];
    if (userIds.length) await notifyUsers({ userIds, event, eventId, message, link: `/crm/leads/${lead.id}?tab=conversation` });
  } catch { console.error("Assistant alert failed.", { leadId: lead.id, event }); }
}

function businessHoursText(booking: Settings["booking"]) {
  const days = Object.entries(booking.businessHours) as [string, { opensAt: string; closesAt: string } | null][];
  return days.map(([day, hours]) => `${day[0].toUpperCase()}${day.slice(1)} ${hours ? `${hours.opensAt}–${hours.closesAt}` : "closed"}`).join("; ");
}

/** Customer-facing history for Claude: conversation messages plus the dealership's automatic emails, oldest first. */
async function conversationHistory(lead: Lead, exclude: Set<string>, format: Intl.DateTimeFormat) {
  const [messages, emails] = await Promise.all([
    AssistantMessageModel.find({ leadId: lead.id, status: { $nin: ["draft", "discarded", "failed"] } }).sort({ occurredAt: -1 }).limit(HISTORY_ITEMS * 2).lean().exec(),
    listLeadEmailsForAssistant(lead.id, HISTORY_ITEMS),
  ]);
  const ours = new Set(messages.map((entry) => entry.messageId).filter(Boolean));
  const items: (AgentHistoryItem & { sort: number })[] = [
    ...messages.filter((entry) => !exclude.has(String(entry._id)) && entry.source !== "inquiry").map((entry) => ({
      sort: entry.occurredAt.getTime(), at: format.format(entry.occurredAt), subject: entry.subject ?? "", text: entry.text ?? "",
      author: (entry.direction === "inbound" ? "customer" : entry.author === "staff" ? "staff" : "assistant") as AgentHistoryItem["author"],
    })),
    // Automatic emails (follow-ups, confirmations, reminders) the customer received; our own replies are already above.
    ...emails.filter((entry) => entry.to.includes(lead.email) && !(entry.messageId && ours.has(entry.messageId))).map((entry) => ({
      sort: Date.parse(entry.sentAt), at: format.format(new Date(entry.sentAt)), subject: entry.subject, text: entry.text, author: "automated" as const,
    })),
  ];
  return items.sort((a, b) => a.sort - b.sort).slice(-HISTORY_ITEMS).map((entry) => ({ at: entry.at, author: entry.author, subject: entry.subject, text: entry.text }));
}

type Facts = { context: AgentContext; tools: AgentTools; bookedWhen: () => string | null; vehicleName: string; dealership: { name: string; phone: string } };

async function buildFacts(lead: Lead, settings: Settings, newMessages: AgentHistoryItem[], exclude: Set<string>, mode: "auto" | "draft"): Promise<Facts> {
  const zone = settings.booking.timeZone;
  const format = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: zone });
  const [vehicle, listed, dealership, assigned, slots, history, locations] = await Promise.all([
    getVehicleForAutomation(lead.vehicleId), getPublicVehicle(lead.vehicleId), getDealershipForAutomation(lead.dealershipId),
    lead.assignedTo ? findActiveUser(lead.assignedTo) : null, getAssistantSlots(lead.id), conversationHistory(lead, exclude, format), listPublicDealerships(),
  ]);
  const origin = siteOrigin();
  let bookingUrl: string | null = null;
  try { bookingUrl = emailUrl(`/book/${encodeURIComponent(lead.bookingToken)}`); } catch { bookingUrl = null; }
  const statusLabel = settings.vehicleStatuses.find((entry) => entry.key === vehicle.status)?.label ?? vehicle.status;
  const availability = listed ? "listed for sale and available"
    : vehicle.status === settings.statusRoles.sold ? "sold, no longer available"
    : `not currently available (status: ${statusLabel})`;
  const name = vehicleTitle(vehicle);
  let bookedWhen: string | null = null;
  const tools: AgentTools = {
    async checkAvailability(date) {
      const current = await getAssistantSlots(lead.id);
      if (current.state === "booked") return `The customer already has an appointment: ${current.when}${current.salespersonName ? ` with ${current.salespersonName}` : ""}. To change it, hand off to staff.`;
      if (current.state === "unassigned") return `No salesperson is assigned yet, so no times can be offered.${bookingUrl ? " You may share the booking link." : " Say the team will reach out."}`;
      const days = date ? current.days.filter((day) => day.date === date) : current.days.slice(0, 5);
      if (!days.length) return `No free times on ${date} (closed or fully booked). Open days: ${current.days.slice(0, 5).map((day) => `${day.date} (${day.label})`).join(", ") || "none in the booking window"}.`;
      return [`Free times with ${current.salespersonName} (${current.zone}). Use startsAt exactly when booking.`,
        ...days.map((day) => `${day.label} (${day.date}): ${(date ? day.slots : day.slots.slice(0, 4)).map((slot) => `${slot.label} [startsAt=${slot.startsAt}]`).join(", ")}${!date && day.slots.length > 4 ? `, +${day.slots.length - 4} more` : ""}`)].join("\n");
    },
    async bookAppointment(startsAt) {
      if (mode === "draft") return "Booking is not available while drafting for staff review. Propose the time in your reply instead.";
      try {
        const { when } = await bookForAssistant(lead.id, startsAt);
        bookedWhen = when;
        const current = await getAssistantSlots(lead.id);
        return `Booked: ${when}${current.state === "booked" && current.salespersonName ? ` with ${current.salespersonName}` : ""}. The customer automatically gets a confirmation email.`;
      } catch (error) {
        if (error instanceof BookingError) return `Not booked: ${error.message} Check availability again and offer other times.`;
        throw error;
      }
    },
    async searchInventory({ query, maxPrice }) {
      const { vehicles, total } = await listPublicVehicles({ q: (query ?? "").slice(0, 80), ...(maxPrice && maxPrice >= 1000 ? { maxPrice: Math.min(maxPrice, 1_000_000) } : {}), sort: "price_asc" });
      const shown = vehicles.filter((entry) => entry.id !== lead.vehicleId).slice(0, 6);
      if (!shown.length) return "No matching vehicles are listed right now.";
      return [`${total} listed match${total === 1 ? "es" : ""}; showing ${shown.length}:`, ...shown.map((entry) =>
        `${vehicleTitle(entry)}, ${money(entry.price)}, ${entry.mileage.toLocaleString("en-CA")} km, stock ${entry.stockNo}, at ${locations.find((location) => location.id === entry.dealershipId)?.name ?? "our dealership"}${origin ? `: ${origin}/inventory/${entry.id}` : ""}`)].join("\n");
    },
  };
  const context: AgentContext = {
    assistantName: settings.assistant.name, companyName: settings.brand.companyName, instructions: settings.assistant.instructions,
    now: new Intl.DateTimeFormat("en-CA", { dateStyle: "full", timeStyle: "short", timeZone: zone }).format(new Date()), timeZone: zone, mode,
    lead: { firstName: firstName(lead.name), fullName: lead.name, stage: settings.leadStages.find((entry) => entry.key === lead.stage)?.label ?? lead.stage,
      receivedAt: format.format(new Date(lead.activity.find((entry) => entry.type === "lead.created")?.occurredAt ?? Date.now())),
      source: settings.leadSources.find((entry) => entry.key === lead.source)?.label ?? lead.source, inquiry: lead.message },
    vehicle: { title: name, stockNo: vehicle.stockNo, price: money(vehicle.price), mileage: `${vehicle.mileage.toLocaleString("en-CA")} km`, availability,
      publicUrl: listed && origin ? `${origin}/inventory/${vehicle.id}` : null },
    dealership, salespersonName: assigned?.role === "salesperson" ? assigned.name : null,
    appointment: slots.state === "booked" ? `${slots.when}${slots.salespersonName ? ` with ${slots.salespersonName}` : ""}` : null,
    businessHours: businessHoursText(settings.booking), bookingUrl: slots.state === "open" || slots.state === "unassigned" ? bookingUrl : null,
    canBook: mode === "auto" && slots.state === "open", history, newMessages,
  };
  return { context, tools, bookedWhen: () => bookedWhen, vehicleName: name, dealership };
}

/** Subject and threading headers for a reply: the customer's latest email, else the latest email we sent them. */
async function replyThread(lead: Lead, vehicleName: string) {
  const [inbound, logged] = await Promise.all([
    AssistantMessageModel.findOne({ leadId: lead.id, direction: "inbound", source: "email", messageId: { $type: "string" } }).sort({ occurredAt: -1 }).lean().exec(),
    getLatestThreadEmail(lead.id),
  ]);
  const ownLogged = logged ? await AssistantMessageModel.findOne({ messageId: logged.messageId }).select("references").lean().exec() : null;
  const inboundNewer = inbound && (!logged || inbound.occurredAt.getTime() >= Date.parse(logged.sentAt));
  const target = inboundNewer ? { subject: inbound.subject ?? "", id: inbound.messageId!, references: inbound.references ?? [] }
    : logged ? { subject: logged.subject, id: logged.messageId, references: ownLogged?.references ?? [] } : null;
  if (!target) return { subject: replySubject(`Your inquiry about the ${vehicleName}`), inReplyTo: null, references: [] as string[] };
  const references = messageIds([...target.references, ...(inbound?.references ?? []), inbound?.messageId ?? "", target.id].filter(Boolean));
  return { subject: replySubject(target.subject || `Your inquiry about the ${vehicleName}`), inReplyTo: target.id, references: references.slice(-20) };
}

const assistantSignature = (settings: Settings, dealership: { name: string; phone: string }) =>
  [settings.assistant.name, `Virtual assistant (AI) · ${settings.brand.companyName}`, `${dealership.name} · ${dealership.phone}`, "Prefer a person? Just reply and say so."];
const staffSignature = (name: string, settings: Settings, dealership: { name: string; phone: string }) => [name, settings.brand.companyName, `${dealership.name} · ${dealership.phone}`];
const displayName = (name: string, company: string) => `${name} at ${company}`.replace(/[\r\n"<>]/g, "").slice(0, 120);

type Delivery = { lead: Lead; settings: Settings; body: string; signature: string[]; fromName: string; author: "assistant" | "staff"; authorId: string | null;
  answers: string[]; vehicleName: string; draftId?: string };
/** Emails a reply in the customer's thread and records it in the conversation (and the Email log, via sendLoggedEmail). */
async function deliverReply(delivery: Delivery) {
  const { lead, settings, body } = delivery;
  const thread = await replyThread(lead, delivery.vehicleName);
  const now = new Date().toISOString();
  let error: string | null = null;
  let from = "";
  let messageId: string | null = null;
  try {
    from = senderAddress(settings.emailFrom);
    messageId = newMessageId(from);
    const html = conversationEmail(textToHtml(body), { subject: thread.subject, signature: delivery.signature });
    await sendLoggedEmail({ from, fromName: delivery.fromName, to: [lead.email], subject: thread.subject, html, text: `${body}\n\n${delivery.signature.join("\n")}`, messageId,
      ...(thread.inReplyTo ? { inReplyTo: thread.inReplyTo } : {}), ...(thread.references.length ? { references: thread.references } : {}) },
      { leadId: lead.id, vehicleId: lead.vehicleId });
  } catch (failure) {
    error = failure instanceof EmailSetupError ? failure.message : assistantNotes.sendFailed;
  }
  const record = { leadId: lead.id, direction: "outbound" as const, source: "reply" as const, author: delivery.author, authorId: delivery.authorId,
    fromEmail: from || "unknown", fromName: delivery.fromName, to: [lead.email], subject: thread.subject, text: body.slice(0, 20_000),
    messageId: error ? null : messageId, inReplyTo: thread.inReplyTo, references: thread.references,
    status: error ? "failed" as const : "sent" as const, note: error ?? "", answers: delivery.answers, occurredAt: now };
  if (delivery.draftId) {
    const update = assistantMessageInputSchema.parse(record);
    await AssistantMessageModel.updateOne({ _id: delivery.draftId }, { $set: update }).exec();
  } else await insertMessage(record);
  return { ok: !error, subject: thread.subject, error };
}

type Manual = { userId: string };
type LeadOutcome = { status: InboundStatus | "busy" | "nothing"; draftId?: string };

/**
 * One assistant pass over a conversation: gates (off, paused, opted out, closed lead, daily cap), Claude's decision,
 * then the reply (sent in auto mode, saved as a draft otherwise), opt-out, booking note and staff handoff. With
 * `manual`, a staff member asked for a draft: gates are skipped and nothing is sent or booked.
 */
async function processLead(leadId: string, manual: Manual | null = null): Promise<LeadOutcome> {
  const id = objectIdSchema.parse(leadId);
  if (!await lockThread(id)) {
    if (manual) throw new AssistantError("The assistant is already answering this customer. Try again in a moment.");
    return { status: "busy" };
  }
  try {
    const now = Date.now();
    const [settings, lead, thread] = await Promise.all([getSettings(), getLeadForAutomation(id), readThread(id)]);
    const pending = await AssistantMessageModel.find({ leadId: id, direction: "inbound", status: "pending", ...dueFilter(now) }).sort({ occurredAt: 1 }).lean().exec();
    if (!manual && !pending.length) return { status: "nothing" };
    const pendingIds = pending.map((entry) => entry._id);
    const finish = (status: InboundStatus, note: string) => pendingIds.length
      ? AssistantMessageModel.updateMany({ _id: { $in: pendingIds } }, { $set: { status, note: note.slice(0, 2000), nextAttemptAt: null } }).exec() : null;
    if (pendingIds.length) await AssistantMessageModel.updateMany({ _id: { $in: pendingIds } }, { $set: { status: "processing" } }).exec();
    if (!manual) {
      const gate = await gateFor(lead, settings, thread, now);
      if (gate) {
        await finish(gate.status, gate.note);
        const emailed = pending.filter((entry) => entry.source === "email");
        if (gate.alert && emailed.length) {
          await alertStaff(lead, gate.status === "handed_off" ? "assistant.handoff" : "assistant.customer_reply", `assistant-gate:${String(emailed.at(-1)!._id)}`,
            gate.status === "handed_off" ? assistantAlerts.handoff(lead.name, gate.note, false) : assistantAlerts.customerReply(lead.name, gate.note.replace(/\.$/, "").toLowerCase()));
        }
        return { status: gate.status };
      }
    }
    const zone = settings.booking.timeZone;
    const format = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: zone });
    const asItem = (entry: { occurredAt: Date; subject?: string | null; text?: string | null; source: string }): AgentHistoryItem =>
      ({ at: format.format(entry.occurredAt), author: "customer", subject: entry.source === "inquiry" ? "Website inquiry" : entry.subject ?? "", text: entry.text ?? "" });
    let answerItems = pending.map(asItem);
    let exclude = new Set(pendingIds.map(String));
    if (manual && !answerItems.length) {
      // Staff asked for a draft: answer what the customer wrote since our last reply (or their latest message).
      const lastSent = await AssistantMessageModel.findOne({ leadId: id, direction: "outbound", status: "sent" }).sort({ occurredAt: -1 }).select("occurredAt").lean().exec();
      const inbound = await AssistantMessageModel.find({ leadId: id, direction: "inbound", status: { $ne: "ignored" }, ...(lastSent ? { occurredAt: { $gt: lastSent.occurredAt } } : {}) })
        .sort({ occurredAt: 1 }).limit(10).lean().exec();
      const latest = inbound.length ? inbound : await AssistantMessageModel.find({ leadId: id, direction: "inbound", status: { $ne: "ignored" } }).sort({ occurredAt: -1 }).limit(1).lean().exec();
      answerItems = latest.map(asItem);
      exclude = new Set(latest.map((entry) => String(entry._id)));
      if (!answerItems.length && lead.message.trim()) answerItems = [{ at: format.format(new Date(lead.activity[0]?.occurredAt ?? now)), author: "customer", subject: "Website inquiry", text: lead.message }];
      if (!answerItems.length) throw new AssistantError(assistantCopy.nothingToAnswer);
    }
    const mode = manual || settings.assistant.mode === "draft" ? "draft" : "auto";
    const facts = await buildFacts(lead, settings, answerItems, exclude, mode);
    let decision: AgentDecision;
    try {
      decision = await runAssistantAgent(facts.context, facts.tools, { allowedOrigin: siteOrigin() });
    } catch (error) {
      console.error("Assistant run failed.", { leadId: id, reason: error instanceof Error ? error.name : "unknown" });
      if (manual) {
        if (pendingIds.length) await AssistantMessageModel.updateMany({ _id: { $in: pendingIds } }, { $set: { status: "pending" } }).exec();
        throw new AssistantError(error instanceof AssistantSetupError ? error.message : assistantNotes.failed);
      }
      return { status: await retryOrFail(lead, pending, error) };
    }
    return await applyDecision({ lead, settings, decision, mode, manual, pendingIds: pendingIds.map(String), facts, finish });
  } finally {
    await unlockThread(id);
  }
}

/** Backs off and retries a failed run (1, 2, 4 minutes); after the last attempt, or a setup problem, staff take over. */
async function retryOrFail(lead: Lead, pending: { _id: unknown; attempts?: number | null }[], error: unknown): Promise<InboundStatus> {
  const attempts = Math.max(...pending.map((entry) => (entry.attempts ?? 0) + 1));
  const ids = pending.map((entry) => entry._id);
  if (error instanceof AssistantSetupError || attempts >= MAX_ATTEMPTS) {
    await AssistantMessageModel.updateMany({ _id: { $in: ids } }, { $set: { status: "failed", note: error instanceof AssistantSetupError ? error.message : assistantNotes.failed, attempts, nextAttemptAt: null } }).exec();
    await alertStaff(lead, "assistant.handoff", `assistant-failed:${String(ids.at(-1))}`, assistantAlerts.failed(lead.name));
    return "failed";
  }
  await AssistantMessageModel.updateMany({ _id: { $in: ids } }, { $set: { status: "pending", note: assistantNotes.retrying, attempts, nextAttemptAt: new Date(Date.now() + 2 ** (attempts - 1) * MINUTE) } }).exec();
  return "pending";
}

async function applyDecision({ lead, settings, decision, mode, manual, pendingIds, facts, finish }: {
  lead: Lead; settings: Settings; decision: AgentDecision; mode: "auto" | "draft"; manual: Manual | null; pendingIds: string[]; facts: Facts;
  finish: (status: InboundStatus, note: string) => Promise<unknown> | null;
}): Promise<LeadOutcome> {
  const occurredAt = () => new Date().toISOString();
  const activity = (message: string) => appendLeadActivity(lead.id, { type: "assistant", message: message.slice(0, 4000), occurredAt: occurredAt(), actorId: manual?.userId ?? null });
  const name = settings.assistant.name;
  if (decision.optOut) {
    await ensureThread(lead.id);
    await AssistantThreadModel.updateOne({ _id: lead.id }, { $set: { optedOut: true, optedOutAt: new Date() } }).exec();
    await activity(assistantActivity.optedOut);
  }
  const booked = facts.bookedWhen();
  if (booked) await activity(assistantActivity.booked(booked));
  let status: InboundStatus = "ignored";
  let note = decision.reason;
  let draftId: string | undefined;
  if (decision.action === "reply") {
    if (mode === "auto") {
      const sent = await deliverReply({ lead, settings, body: decision.body, signature: assistantSignature(settings, facts.dealership),
        fromName: displayName(name, settings.brand.companyName), author: "assistant", authorId: null, answers: pendingIds, vehicleName: facts.vehicleName });
      status = sent.ok ? "replied" : "failed";
      note = sent.ok ? "" : sent.error ?? assistantNotes.sendFailed;
      if (sent.ok) await activity(assistantActivity.replied(name, sent.subject));
      else await alertStaff(lead, "assistant.handoff", `assistant-failed:${pendingIds.at(-1) ?? lead.id}`, assistantAlerts.failed(lead.name));
    } else {
      const thread = await replyThread(lead, facts.vehicleName);
      const draft = await insertMessage({ leadId: lead.id, direction: "outbound", source: "reply", author: "assistant", authorId: manual?.userId ?? null,
        fromEmail: "draft", fromName: displayName(name, settings.brand.companyName), to: [lead.email], subject: thread.subject, text: decision.body.slice(0, 20_000),
        status: "draft", note: decision.handoff ? decision.handoff.reason : "", answers: pendingIds, occurredAt: occurredAt() });
      draftId = draft?.id;
      status = "drafted";
      note = "";
      if (!manual && draft) await alertStaff(lead, "assistant.draft", `assistant-draft:${draft.id}`, assistantAlerts.draft(lead.name));
      await activity(assistantActivity.drafted(name));
    }
  }
  if (decision.handoff) {
    // In auto mode the assistant steps back until staff resume it; drafts are reviewed by staff anyway.
    if (mode === "auto") await setPaused(lead.id, true, decision.handoff.reason, null);
    if (!manual) await alertStaff(lead, "assistant.handoff", `assistant-handoff:${pendingIds.at(-1) ?? lead.id}`, assistantAlerts.handoff(lead.name, decision.handoff.reason, decision.handoff.urgent), decision.handoff.urgent);
    await activity(assistantActivity.handedOff(decision.handoff.reason));
    if (status !== "failed" && status !== "drafted") {
      note = decision.action === "reply" ? assistantNotes.handoffWithReply(decision.handoff.reason) : decision.handoff.reason;
      status = "handed_off";
    }
  }
  await finish(status, note);
  return { status, draftId };
}

// ---------------------------------------------------------------------------------------------------------------------
// Staff: the lead's Conversation tab
// ---------------------------------------------------------------------------------------------------------------------

export type ConversationView = {
  messages: (AssistantMessage & { stale: boolean })[];
  thread: AssistantThread;
  assistant: { enabled: boolean; mode: Settings["assistant"]["mode"]; name: string };
};

/** The conversation for a lead the signed-in user can see, oldest first. Null when the lead is not visible. */
export async function getConversation(leadId: string): Promise<ConversationView | null> {
  const lead = await getLead(leadId);
  if (!lead) return null;
  await connectDb();
  const [settings, documents, thread] = await Promise.all([
    getSettings(), AssistantMessageModel.find({ leadId: lead.id }).sort({ occurredAt: -1, _id: -1 }).limit(200).lean().exec(), readThread(lead.id),
  ]);
  const messages = documents.reverse().map(toMessage);
  const lastInbound = messages.filter((entry) => entry.direction === "inbound").at(-1)?.occurredAt ?? null;
  return {
    messages: messages.map((entry) => ({ ...entry, stale: entry.status === "draft" && Boolean(lastInbound && lastInbound > entry.occurredAt) })),
    thread, assistant: { enabled: settings.assistant.enabled, mode: settings.assistant.mode, name: settings.assistant.name },
  };
}

async function visibleLead(leadId: string) {
  const lead = await getLead(leadId);
  if (!lead) throw new AssistantError(assistantCopy.notFound);
  return getLeadForAutomation(lead.id);
}

async function withLock<T>(leadId: string, operation: () => Promise<T>) {
  if (!await lockThread(leadId)) throw new AssistantError("The assistant is answering this customer right now. Try again in a moment.");
  try { return await operation(); } finally { await unlockThread(leadId); }
}

async function senderContext(lead: Lead) {
  const [settings, vehicle, dealership] = await Promise.all([getSettings(), getVehicleForAutomation(lead.vehicleId), getDealershipForAutomation(lead.dealershipId)]);
  return { settings, vehicleName: vehicleTitle(vehicle), dealership };
}

/** Staff reply typed on the Conversation tab: sent in the thread, counted as contact, and the assistant steps back. */
export async function sendStaffReply(input: unknown) {
  const user = await requireRole();
  const { leadId, body } = staffReplySchema.parse(input);
  const lead = await visibleLead(leadId);
  return withLock(lead.id, async () => {
    const { settings, vehicleName, dealership } = await senderContext(lead);
    await setPaused(lead.id, true, `${user.name} replied`, user.id);
    const sent = await deliverReply({ lead, settings, body, signature: staffSignature(user.name, settings, dealership), fromName: displayName(user.name, settings.brand.companyName),
      author: "staff", authorId: user.id, answers: [], vehicleName });
    if (!sent.ok) throw new AssistantError(sent.error ?? assistantNotes.sendFailed);
    await AssistantMessageModel.updateMany({ leadId: lead.id, direction: "inbound", status: { $in: ["pending", "skipped", "failed", "handed_off"] } },
      { $set: { status: "replied", note: assistantNotes.answeredByStaff(user.name), nextAttemptAt: null } }).exec();
    await recordLeadEmailContact(lead.id, sent.subject);
    return {};
  });
}

async function loadDraft(id: string) {
  await connectDb();
  const draft = await AssistantMessageModel.findOne({ _id: id, direction: "outbound", status: "draft" }).lean().exec();
  if (!draft?.leadId) throw new AssistantError(assistantCopy.draftGone);
  return { draft: toMessage(draft), lead: await visibleLead(String(draft.leadId)) };
}

/** Staff approve (and may edit) the assistant's draft; it is sent in the thread and counted as staff contact. */
export async function approveDraft(input: unknown) {
  const user = await requireRole();
  const { id, body } = draftDecisionSchema.parse(input);
  const { draft, lead } = await loadDraft(id);
  return withLock(lead.id, async () => {
    const claimed = await AssistantMessageModel.updateOne({ _id: draft.id, status: "draft" }, { $set: { status: "processing" } }).exec();
    if (!claimed.modifiedCount) throw new AssistantError(assistantCopy.draftGone);
    const { settings, vehicleName, dealership } = await senderContext(lead);
    const sent = await deliverReply({ lead, settings, body, signature: assistantSignature(settings, dealership), fromName: displayName(settings.assistant.name, settings.brand.companyName),
      author: "assistant", authorId: user.id, answers: draft.answers, vehicleName, draftId: draft.id });
    if (!sent.ok) {
      await AssistantMessageModel.updateOne({ _id: draft.id }, { $set: { status: "draft", note: sent.error ?? assistantNotes.sendFailed } }).exec();
      throw new AssistantError(sent.error ?? assistantNotes.sendFailed);
    }
    if (draft.answers.length) await AssistantMessageModel.updateMany({ _id: { $in: draft.answers } }, { $set: { status: "replied", note: assistantNotes.answeredByStaff(user.name) } }).exec();
    await recordLeadEmailContact(lead.id, sent.subject);
    return {};
  });
}

export async function discardDraft(input: unknown) {
  const user = await requireRole();
  const { id } = draftIdSchema.parse(input);
  const { draft } = await loadDraft(id);
  await AssistantMessageModel.updateOne({ _id: draft.id, status: "draft" }, { $set: { status: "discarded", note: `Discarded by ${user.name}.`, authorId: user.id } }).exec();
  return {};
}

/** Staff pause or resume the assistant for one customer. Resuming does not answer messages that arrived while paused. */
export async function setAssistantPaused(input: unknown) {
  const user = await requireRole();
  const { leadId, paused } = pauseSchema.parse(input);
  const lead = await visibleLead(leadId);
  await setPaused(lead.id, paused, paused ? `Paused by ${user.name}` : "", user.id);
  return {};
}

/** Staff ask the assistant to draft an answer now (never sent or booked automatically). */
export async function requestAssistantDraft(leadId: unknown) {
  const user = await requireRole();
  const lead = await visibleLead(objectIdSchema.parse(leadId));
  const outcome = await processLead(lead.id, { userId: user.id });
  if (outcome.status !== "drafted") throw new AssistantError(outcome.status === "handed_off"
    ? "The assistant thinks a person should answer this one; see the activity log."
    : "The assistant found nothing that needs a reply.");
  return {};
}

// ---------------------------------------------------------------------------------------------------------------------
// Owner: Assistant page
// ---------------------------------------------------------------------------------------------------------------------

/** Mailbox the poller reads (credentials never leave the server). Gmail IMAP with the SMTP account by default. */
export function inboxConfig() {
  if (process.env.ASSISTANT_INBOX?.trim().toLowerCase() === "off") return null;
  const smtpHost = process.env.SMTP_HOST?.trim() || (process.env.EMAIL_PROVIDER === "smtp" ? "smtp.gmail.com" : "");
  const host = process.env.ASSISTANT_IMAP_HOST?.trim() || (smtpHost.includes("gmail") ? "imap.gmail.com" : "");
  const user = process.env.ASSISTANT_IMAP_USER?.trim() || process.env.SMTP_USER?.trim() || "";
  const pass = (process.env.ASSISTANT_IMAP_PASS ?? process.env.SMTP_PASS ?? "").replace(/\s+/g, "");
  const port = Number(process.env.ASSISTANT_IMAP_PORT || 993);
  if (!host || !user || !pass || !Number.isInteger(port)) return null;
  return { host, port, user, pass };
}

export async function getAssistantOverview(now = Date.now()) {
  await requireRole("owner");
  const settings = await getSettings();
  await connectDb();
  const week = new Date(now - 7 * DAY);
  const [state, drafts, paused, failures, recent, unmatched, repliesSent, customerEmails, handedOff] = await Promise.all([
    AssistantStateModel.findById("inbox").lean().exec(),
    AssistantMessageModel.find({ direction: "outbound", status: "draft" }).sort({ occurredAt: -1 }).limit(20).lean().exec(),
    AssistantThreadModel.find({ paused: true }).sort({ pausedAt: -1 }).limit(20).lean().exec(),
    AssistantMessageModel.find({ direction: "inbound", status: "failed", occurredAt: { $gte: week } }).sort({ occurredAt: -1 }).limit(20).lean().exec(),
    AssistantMessageModel.find({ leadId: { $ne: null }, status: { $nin: ["draft", "discarded"] } }).sort({ occurredAt: -1 }).limit(20).lean().exec(),
    AssistantMessageModel.find({ leadId: null, direction: "inbound" }).sort({ occurredAt: -1 }).limit(10).lean().exec(),
    AssistantMessageModel.countDocuments({ direction: "outbound", author: "assistant", status: "sent", occurredAt: { $gte: week } }).exec(),
    AssistantMessageModel.countDocuments({ direction: "inbound", source: "email", leadId: { $ne: null }, occurredAt: { $gte: week } }).exec(),
    AssistantMessageModel.countDocuments({ direction: "inbound", status: "handed_off", occurredAt: { $gte: week } }).exec(),
  ]);
  const leadIds = [...new Set([...drafts, ...failures, ...recent].map((entry) => String(entry.leadId)).concat(paused.map((entry) => String(entry._id))))];
  const names = new Map((await getLeadSummaries(leadIds)).map((entry) => [entry.id, entry.name]));
  const row = (entry: { _id: unknown; leadId?: unknown; direction: string; author: string; status: string; subject?: string | null; text?: string | null; note?: string | null; occurredAt: Date; fromEmail?: string | null }) => ({
    id: String(entry._id), leadId: entry.leadId ? String(entry.leadId) : null, leadName: entry.leadId ? names.get(String(entry.leadId)) ?? "Customer" : null,
    direction: entry.direction, author: entry.author, status: entry.status, subject: entry.subject ?? "", preview: (entry.text ?? "").slice(0, 220),
    note: entry.note ?? "", at: entry.occurredAt.toISOString(), from: entry.fromEmail ?? "",
  });
  const inbox = inboxConfig();
  return {
    settings: settings.assistant, timeZone: settings.booking.timeZone,
    status: {
      apiKey: Boolean(process.env.ANTHROPIC_API_KEY?.trim() || process.env.ANTHROPIC_AUTH_TOKEN?.trim()),
      model: process.env.ASSISTANT_MODEL?.trim() || DEFAULT_ASSISTANT_MODEL,
      inbox: inbox ? `${inbox.user} (${inbox.host})` : null,
      lastPollAt: state?.lastPollAt ? state.lastPollAt.toISOString() : null, lastError: state?.lastError ?? null,
      emailProblems: emailDeliveryStatus().problems,
    },
    stats: { repliesSent, customerEmails, handedOff },
    drafts: drafts.map(row), failures: failures.map(row), recent: recent.map(row), unmatched: unmatched.map(row),
    paused: paused.map((entry) => ({ leadId: String(entry._id), leadName: names.get(String(entry._id)) ?? "Customer", reason: entry.pausedReason ?? "", at: entry.pausedAt ? entry.pausedAt.toISOString() : null })),
  };
}
export type AssistantOverview = Awaited<ReturnType<typeof getAssistantOverview>>;
