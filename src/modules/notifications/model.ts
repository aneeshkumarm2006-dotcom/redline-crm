import "server-only";

import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { validateRecord } from "@/lib/validate-record";
import { notificationKinds, notificationSchema } from "./schema";

const schema = new Schema({
  eventId: String,
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  event: { type: String, enum: notificationKinds, required: true }, message: { type: String, required: true },
  link: { type: String, required: true }, readAt: { type: Date, default: null },
}, { timestamps: true, strict: "throw", collection: "notifications" });
schema.index({ userId: 1, readAt: 1, createdAt: -1 });
schema.index({ eventId: 1, userId: 1 }, { unique: true, partialFilterExpression: { eventId: { $type: "string" } } });
schema.pre("validate", function () { validateRecord(this, notificationSchema); });
export const NotificationModel: Model<InferSchemaType<typeof schema>> = (mongoose.models.Notification as Model<InferSchemaType<typeof schema>> | undefined)
  ?? mongoose.model("Notification", schema);
