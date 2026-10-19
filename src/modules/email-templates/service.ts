import "server-only";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { EmailTemplateModel } from "./model";
import { emailTemplateSchema } from "./schema";
import { keySchema } from "@/lib/data-schema";
import { allowedPlaceholders, emailTemplateInputSchema, emailTemplateUpdateSchema, placeholdersIn } from "./schema";
import { requireRole } from "@/modules/auth/service";

/** Non-destructive CLI upgrade for existing databases. Never replaces edited templates. */
export async function initializeEmailTemplates(input: unknown) {
  const templates = z.array(emailTemplateInputSchema).parse(input);
  await connectDb();
  await EmailTemplateModel.init();
  for (const template of templates) {
    try {
      await EmailTemplateModel.updateOne({ key: template.key }, { $setOnInsert: template }, { upsert: true, runValidators: true }).exec();
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === 11000)) throw error;
    }
  }
}

/** Internal email workflow lookup. Template markup is trusted owner-managed HTML. */
export async function getEmailTemplate(key: string) {
  const validated = keySchema.parse(key);
  await connectDb();
  const document = await EmailTemplateModel.findOne({ key: validated }).lean().exec();
  if (!document) throw new Error("Email template is missing.");
  return emailTemplateSchema.parse({ id: document._id.toString(), key: document.key, subject: document.subject, body: document.body });
}

/** Destructive internal CLI import only; never expose through a server action. */
export async function replaceEmailTemplatesForSeed(input: unknown) {
  const records = z.array(emailTemplateSchema).parse(input);
  await connectDb();
  await EmailTemplateModel.init();
  const documents = records.map(({ id, ...data }) => new EmailTemplateModel({ _id: id, ...data }));
  // Validate all documents before clearing this collection.
  for (const document of documents) await document.validate();
  await EmailTemplateModel.deleteMany({}).exec();
  if (documents.length) await EmailTemplateModel.insertMany(documents);
  return documents.length;
}


export class EmailTemplateError extends Error {}

/** Owner settings screen: every template, by key. */
export async function listEmailTemplates() {
  await requireRole("owner");
  await connectDb();
  const documents = await EmailTemplateModel.find().sort({ key: 1 }).lean().exec();
  return documents.map((document) => emailTemplateSchema.parse({ id: document._id.toString(), key: document.key, subject: document.subject, body: document.body }));
}

/** Owner: edits a template's subject and body. The key is fixed, because workflows send templates by key. */
export async function updateEmailTemplate(input: unknown) {
  await requireRole("owner");
  const data = emailTemplateUpdateSchema.parse(input);
  await connectDb();
  const stored = await EmailTemplateModel.findById(data.id).select("subject body").lean().exec();
  if (!stored) throw new EmailTemplateError("That template no longer exists.");
  const allowed = new Set(allowedPlaceholders(stored));
  const unknown = placeholdersIn(`${data.subject} ${data.body}`).filter((name) => !allowed.has(name));
  if (unknown.length) throw new EmailTemplateError(`This template can’t use ${unknown.map((name) => `{{${name}}}`).join(", ")}. Use one of the listed placeholders.`);
  const result = await EmailTemplateModel.updateOne({ _id: data.id }, { $set: { subject: data.subject, body: data.body } }, { runValidators: true }).exec();
  if (!result.matchedCount) throw new EmailTemplateError("That template no longer exists.");
}
