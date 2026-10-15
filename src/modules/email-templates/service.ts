import "server-only";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { EmailTemplateModel } from "./model";
import { emailTemplateSchema } from "./schema";
import { keySchema } from "@/lib/data-schema";
import { emailTemplateInputSchema } from "./schema";

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

