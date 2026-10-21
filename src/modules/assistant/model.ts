import "server-only";

import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { validateRecord } from "@/lib/validate-record";
import { assistantMessageSchema, inboundStatuses, messageAuthors, messageSources, outboundStatuses } from "./schema";

const messageSchema = new Schema({
  leadId: { type: Schema.Types.ObjectId, ref: "Lead", default: null },
  direction: { type: String, enum: ["inbound", "outbound"], required: true },
  source: { type: String, enum: messageSources, required: true },
  author: { type: String, enum: messageAuthors, required: true },
  authorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  fromEmail: { type: String, required: true }, fromName: { type: String, default: "" },
  to: { type: [String], default: [] }, subject: { type: String, default: "" }, text: { type: String, default: "" },
  messageId: { type: String, default: null }, inReplyTo: { type: String, default: null }, references: { type: [String], default: [] },
  status: { type: String, enum: [...inboundStatuses, ...outboundStatuses], required: true },
  note: { type: String, default: "" },
  answers: { type: [Schema.Types.ObjectId], default: [] },
  attempts: { type: Number, default: 0 }, nextAttemptAt: { type: Date, default: null },
  occurredAt: { type: Date, required: true },
}, { timestamps: true, strict: "throw", collection: "assistant_messages" });
// Re-polling the inbox or replaying a webhook never stores the same email twice.
messageSchema.index({ messageId: 1 }, { unique: true, partialFilterExpression: { messageId: { $type: "string" } } });
messageSchema.index({ leadId: 1, occurredAt: 1 });
// The work queue: pending customer messages due for processing.
messageSchema.index({ direction: 1, status: 1, nextAttemptAt: 1 });
messageSchema.index({ occurredAt: -1 });
messageSchema.pre("validate", function () { validateRecord(this, assistantMessageSchema); });
export const AssistantMessageModel: Model<InferSchemaType<typeof messageSchema>> = (mongoose.models.AssistantMessage as Model<InferSchemaType<typeof messageSchema>> | undefined)
  ?? mongoose.model("AssistantMessage", messageSchema);

/** One per lead (`_id` = lead ID). `lockedUntil` makes processing one lead's conversation exclusive across instances. */
const threadSchema = new Schema({
  _id: { type: Schema.Types.ObjectId, required: true },
  paused: { type: Boolean, default: false }, pausedReason: { type: String, default: "" }, pausedAt: { type: Date, default: null },
  pausedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  optedOut: { type: Boolean, default: false }, optedOutAt: { type: Date, default: null },
  lockedUntil: { type: Date, default: null },
}, { timestamps: true, strict: "throw", collection: "assistant_threads" });
threadSchema.index({ paused: 1, updatedAt: -1 });
export const AssistantThreadModel: Model<InferSchemaType<typeof threadSchema>> = (mongoose.models.AssistantThread as Model<InferSchemaType<typeof threadSchema>> | undefined)
  ?? mongoose.model("AssistantThread", threadSchema);

/** Inbox poll cursor (`_id: "inbox"`): IMAP UIDVALIDITY and the last UID read, plus the last outcome for the status card. */
const stateSchema = new Schema({
  _id: { type: String, required: true },
  uidValidity: { type: String, default: null }, lastUid: { type: Number, default: 0 },
  lastPollAt: { type: Date, default: null }, lastError: { type: String, default: null }, lastFetched: { type: Number, default: 0 },
  lockedUntil: { type: Date, default: null },
}, { timestamps: true, strict: "throw", collection: "assistant_state" });
export const AssistantStateModel: Model<InferSchemaType<typeof stateSchema>> = (mongoose.models.AssistantState as Model<InferSchemaType<typeof stateSchema>> | undefined)
  ?? mongoose.model("AssistantState", stateSchema);
