import "server-only";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { escapeRegex } from "@/lib/regex";
import { keySchema, objectIdSchema } from "@/lib/data-schema";
import { requireRole } from "@/modules/auth/service";
import { brandEmail } from "@/lib/email/layout";
import { getSettings } from "@/modules/settings/service";
import { ConsoleProvider, SmtpProvider, getEmailProvider, isLoggedProvider, sendAndLog, type EmailMessage, type EmailProvider, type EmailRefs } from "@/lib/email/provider";
import { AutomationRunModel, EmailLogModel } from "./model";
import { automationRunInputSchema, automationRunSchema, emailLogFilterSchema, emailLogInputSchema, emailLogSchema, type AutomationRecipeKey, type AutomationRun, type EmailLogEntry } from "./schema";

const PAGE_SIZE = 24;
function plain(document: unknown) {
  const { _id, __v, createdAt, updatedAt, ...data } = JSON.parse(JSON.stringify(document));
  void __v; void createdAt; void updatedAt;
  return { ...data, id: _id };
}
const toRun = (document: unknown): AutomationRun => automationRunSchema.parse(plain(document));
const toEmail = (document: unknown): EmailLogEntry => emailLogSchema.parse(plain(document));

/** Internal: records one handler outcome. Idempotent per (eventId, recipeKey). */
export async function recordAutomationRun(input: unknown) {
  const run = automationRunInputSchema.parse(input);
  await connectDb();
  await AutomationRunModel.init();
  try {
    await AutomationRunModel.updateOne({ eventId: run.eventId, recipeKey: run.recipeKey }, { $setOnInsert: run }, { upsert: true, runValidators: true }).exec();
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === 11000)) throw error;
  }
}

/** Internal: writes one send attempt, successful or failed, to the Email log. */
export async function recordEmail(input: unknown) {
  const entry = emailLogInputSchema.parse(input);
  await connectDb();
  await EmailLogModel.create(entry);
}

/**
 * Internal: sends one email and writes the attempt to the Email log, whether it was delivered or not.
 * Providers from `getEmailProvider()` log their own sends; any other provider (e.g. a check script's) is wrapped here.
 */
export async function sendLoggedEmail(message: EmailMessage, refs: EmailRefs = {}, provider: EmailProvider = getEmailProvider()) {
  // Every email leaves in the branded layout, so the inbox and the Email log show the same designed message.
  // The dealership's name is the sender's display name; replies can be routed to EMAIL_REPLY_TO.
  const { brand } = await getSettings();
  const replyTo = process.env.EMAIL_REPLY_TO?.trim() || undefined;
  const branded = { fromName: brand.companyName, ...(replyTo ? { replyTo } : {}), ...message, html: brandEmail(message.html, { brand, subject: message.subject }) };
  if (isLoggedProvider(provider)) return provider.send(branded, refs);
  return sendAndLog(branded, refs, provider instanceof ConsoleProvider ? "console" : provider instanceof SmtpProvider ? "smtp" : "resend", (value) => provider.send(value));
}

type RunInput = z.input<typeof automationRunInputSchema>;
/**
 * Internal: reserves one scheduled run before it acts, so a reminder fires once per (eventId, recipe) even when
 * the cron and Run now overlap. Returns false when that run already exists.
 */
export async function claimAutomationRun(input: RunInput) {
  const run = automationRunInputSchema.parse(input);
  await connectDb();
  await AutomationRunModel.init();
  try {
    const result = await AutomationRunModel.updateOne({ eventId: run.eventId, recipeKey: run.recipeKey }, { $setOnInsert: run }, { upsert: true, runValidators: true }).exec();
    return result.upsertedCount > 0;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === 11000) return false;
    throw error;
  }
}

/** Internal: the final outcome of a claimed run. */
export async function finishAutomationRun(eventId: string, recipeKey: AutomationRecipeKey, outcome: AutomationRun["outcome"], detail: string) {
  const update = automationRunInputSchema.pick({ outcome: true, detail: true }).parse({ outcome, detail });
  await connectDb();
  await AutomationRunModel.updateOne({ eventId, recipeKey }, { $set: { ...update, ranAt: new Date() } }, { runValidators: true }).exec();
}

export type RecipeRunStats = { key: string; runs: number; success: number; failed: number; skipped: number; lastRanAt: string | null; lastOutcome: AutomationRun["outcome"] | null };
/** Owner: per recipe, runs since an instant (e.g. the start of this month) by outcome, and the latest run ever. */
export async function summarizeAutomationRuns(since: string): Promise<RecipeRunStats[]> {
  await requireRole("owner");
  const from = new Date(z.string().datetime({ offset: true }).parse(since));
  await connectDb();
  const [periods, latest] = await Promise.all([
    AutomationRunModel.aggregate<{ _id: { recipeKey: string; outcome: AutomationRun["outcome"] }; count: number }>([
      { $match: { ranAt: { $gte: from } } }, { $group: { _id: { recipeKey: "$recipeKey", outcome: "$outcome" }, count: { $sum: 1 } } },
    ]).exec(),
    AutomationRunModel.aggregate<{ _id: string; ranAt: Date; outcome: AutomationRun["outcome"] }>([
      { $sort: { recipeKey: 1, ranAt: -1 } }, { $group: { _id: "$recipeKey", ranAt: { $first: "$ranAt" }, outcome: { $first: "$outcome" } } },
    ]).exec(),
  ]);
  const keys = new Set([...periods.map((row) => row._id.recipeKey), ...latest.map((row) => row._id)]);
  return [...keys].map((key) => {
    const count = (outcome: AutomationRun["outcome"]) => periods.find((row) => row._id.recipeKey === key && row._id.outcome === outcome)?.count ?? 0;
    const last = latest.find((row) => row._id === key);
    return { key, success: count("success"), failed: count("failed"), skipped: count("skipped"),
      runs: count("success") + count("failed") + count("skipped"), lastRanAt: last ? last.ranAt.toISOString() : null, lastOutcome: last?.outcome ?? null };
  });
}

const leadIdsSchema = z.array(objectIdSchema).max(1000);
/** Recipes whose outcome explains a step of the lead journey (assignment, follow-up email, CRM update). */
const journeyRecipes = ["lead_auto_assign", "lead_follow_up_email", "appointment_stage_update"];
export type JourneyEmailRecord = Pick<EmailLogEntry, "id" | "to" | "subject" | "templateKey" | "status" | "error" | "sentAt"> & { leadId: string };
export type JourneyRunRecord = Pick<AutomationRun, "recipeKey" | "outcome" | "detail" | "ranAt"> & { leadId: string };

/**
 * Email and automation records behind lead journeys, without email bodies. Lead visibility is the
 * caller's job: pass only IDs returned by the leads service for the signed-in user.
 */
export async function listJourneyRecords(leadIds: string[]) {
  await requireRole();
  const ids = leadIdsSchema.parse(leadIds);
  if (!ids.length) return { emails: [] as JourneyEmailRecord[], runs: [] as JourneyRunRecord[] };
  await connectDb();
  const [emails, runs] = await Promise.all([
    EmailLogModel.find({ leadId: { $in: ids } }).select("-html").sort({ sentAt: 1, _id: 1 }).lean().exec(),
    AutomationRunModel.find({ "subject.id": { $in: ids }, recipeKey: { $in: journeyRecipes } }).sort({ ranAt: 1, _id: 1 }).lean().exec(),
  ]);
  return {
    emails: emails.map((entry) => ({ id: entry._id.toString(), leadId: String(entry.leadId), to: entry.to, subject: entry.subject, templateKey: entry.templateKey ?? null,
      status: entry.status ?? "sent", error: entry.error ?? null, sentAt: entry.sentAt.toISOString() })) as JourneyEmailRecord[],
    runs: runs.map((entry) => ({ leadId: String(entry.subject.id), recipeKey: entry.recipeKey, outcome: entry.outcome, detail: entry.detail ?? "",
      ranAt: entry.ranAt.toISOString() })) as JourneyRunRecord[],
  };
}

/** Every email logged for one lead, newest first, with bodies for preview. The caller checks lead visibility. */
export async function listEmailsForLead(leadId: string) {
  await requireRole();
  const id = objectIdSchema.parse(leadId);
  await connectDb();
  const documents = await EmailLogModel.find({ leadId: id }).sort({ sentAt: -1, _id: -1 }).limit(100).lean().exec();
  return documents.map(toEmail);
}

const runFilterSchema = z.object({
  recipeKey: keySchema.optional(), subjectId: objectIdSchema.optional(), limit: z.number().int().min(1).max(500).default(50),
}).strict();

/** Owner view of recent handler outcomes, optionally for one recipe or one lead/vehicle. */
export async function listAutomationRuns(input: unknown = {}) {
  await requireRole("owner");
  const filters = runFilterSchema.parse(input);
  await connectDb();
  const documents = await AutomationRunModel.find({
    ...(filters.recipeKey ? { recipeKey: filters.recipeKey } : {}), ...(filters.subjectId ? { "subject.id": filters.subjectId } : {}),
  }).sort({ ranAt: -1, _id: -1 }).limit(filters.limit).lean().exec();
  return documents.map(toRun);
}

/** Owner: emails logged (sent or failed) since an instant. */
export async function countEmailsSince(since: string) {
  await requireRole("owner");
  const from = new Date(z.string().datetime({ offset: true }).parse(since));
  await connectDb();
  return EmailLogModel.countDocuments({ sentAt: { $gte: from } }).exec();
}

/** Owner Email log: every email the system sent or tried to send, newest first. */
export async function listEmailLog(input: unknown = {}) {
  await requireRole("owner");
  const filters = emailLogFilterSchema.parse(input);
  await connectDb();
  const search = escapeRegex(filters.q);
  const query = {
    ...(filters.leadId ? { leadId: filters.leadId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(search ? { $or: ["subject", "to"].map((field) => ({ [field]: { $regex: search, $options: "i" } })) } : {}),
  };
  const total = await EmailLogModel.countDocuments(query).exec();
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const documents = await EmailLogModel.find(query).sort({ sentAt: -1, _id: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean().exec();
  return { emails: documents.map(toEmail), total, page, pageCount };
}

/** Destructive internal CLI import only; never expose through a server action. */
export async function replaceAutomationRunsForSeed(input: unknown) {
  const records = z.array(automationRunSchema).parse(input);
  await connectDb();
  await AutomationRunModel.init();
  const documents = records.map(({ id, ...data }) => new AutomationRunModel({ _id: id, ...data }));
  // Validate all documents before clearing this collection.
  for (const document of documents) await document.validate();
  await AutomationRunModel.deleteMany({}).exec();
  if (documents.length) await AutomationRunModel.insertMany(documents);
  return documents.length;
}

/** Destructive internal CLI import only; never expose through a server action. */
export async function replaceEmailLogForSeed(input: unknown) {
  const records = z.array(emailLogSchema).parse(input);
  await connectDb();
  await EmailLogModel.init();
  const documents = records.map(({ id, ...data }) => new EmailLogModel({ _id: id, ...data }));
  // Validate all documents before clearing this collection.
  for (const document of documents) await document.validate();
  await EmailLogModel.deleteMany({}).exec();
  if (documents.length) await EmailLogModel.insertMany(documents);
  return documents.length;
}
