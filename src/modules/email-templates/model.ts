import "server-only";
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { validateRecord } from "@/lib/validate-record";
import { emailTemplateSchema } from "./schema";

const schema = new Schema({
  key: { type: String, required: true, unique: true },
  subject: { type: String, required: true, trim: true }, body: { type: String, required: true, trim: true },
}, { timestamps: true, strict: "throw", collection: "email_templates" });
schema.pre("validate", function () { validateRecord(this, emailTemplateSchema); });
export const EmailTemplateModel: Model<InferSchemaType<typeof schema>> = (mongoose.models.EmailTemplate as Model<InferSchemaType<typeof schema>> | undefined)
  ?? mongoose.model("EmailTemplate", schema);
