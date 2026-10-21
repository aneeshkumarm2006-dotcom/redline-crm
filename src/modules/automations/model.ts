import "server-only";

import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { validateRecord } from "@/lib/validate-record";
import { automationOutcomes, automationRunSchema, automationSubjectTypes, emailLogSchema, emailProviders } from "./schema";

const embedded = { _id: false, strict: "throw" as const };
const subject = new Schema({
  type: { type: String, enum: automationSubjectTypes, required: true }, id: { type: Schema.Types.ObjectId, required: true },
}, embedded);
const runSchema = new Schema({
  eventId: { type: String, required: true }, recipeKey: { type: String, required: true },
  name: { type: String, required: true }, subject: { type: subject, required: true },
  outcome: { type: String, enum: automationOutcomes, required: true },
  detail: { type: String, default: "" }, ranAt: { type: Date, required: true },
}, { timestamps: true, strict: "throw", collection: "automation_runs" });
// One run per recipe per event: reprocessing an event or re-running a reminder cannot duplicate it.
runSchema.index({ eventId: 1, recipeKey: 1 }, { unique: true });
runSchema.index({ recipeKey: 1, ranAt: -1 });
runSchema.index({ "subject.id": 1, ranAt: -1 });
runSchema.index({ ranAt: -1 });
runSchema.pre("validate", function () { validateRecord(this, automationRunSchema); });
export const AutomationRunModel: Model<InferSchemaType<typeof runSchema>> = (mongoose.models.AutomationRun as Model<InferSchemaType<typeof runSchema>> | undefined)
  ?? mongoose.model("AutomationRun", runSchema);

const emailLog = new Schema({
  to: { type: [String], required: true }, subject: { type: String, required: true }, html: { type: String, required: true },
  templateKey: { type: String, default: null },
  leadId: { type: Schema.Types.ObjectId, ref: "Lead", default: null },
  vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", default: null },
  provider: { type: String, enum: emailProviders, required: true },
  status: { type: String, enum: ["sent", "failed"], default: "sent" },
  error: { type: String, default: null }, messageId: { type: String, default: null }, sentAt: { type: Date, required: true },
}, { timestamps: true, strict: "throw", collection: "email_log" });
emailLog.index({ sentAt: -1 });
emailLog.index({ leadId: 1, sentAt: -1 });
// Customer replies name our Message-ID in In-Reply-To / References; this finds the lead they belong to.
emailLog.index({ messageId: 1 }, { partialFilterExpression: { messageId: { $type: "string" } } });
emailLog.pre("validate", function () { validateRecord(this, emailLogSchema); });
export const EmailLogModel: Model<InferSchemaType<typeof emailLog>> = (mongoose.models.EmailLog as Model<InferSchemaType<typeof emailLog>> | undefined)
  ?? mongoose.model("EmailLog", emailLog);
