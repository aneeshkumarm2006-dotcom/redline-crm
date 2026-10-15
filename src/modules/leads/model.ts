import "server-only";

import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { validateRecord } from "@/lib/validate-record";
import { leadSchema } from "./schema";

const activity = new Schema({
  eventId: String,
  type: { type: String, required: true }, message: { type: String, required: true },
  occurredAt: { type: Date, required: true }, actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
}, { _id: false, strict: "throw" });
const schema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  phone: { type: String, required: true, trim: true }, message: { type: String, default: "", trim: true },
  vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
  dealershipId: { type: Schema.Types.ObjectId, ref: "Dealership", required: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
  stage: { type: String, required: true }, source: { type: String, required: true },
  bookingToken: { type: String, required: true, unique: true, select: false },
  inquiryId: { type: String, select: false },
  activity: { type: [activity], default: [] },
}, { timestamps: true, strict: "throw", collection: "leads" });
schema.index({ assignedTo: 1, stage: 1, createdAt: -1 });
schema.index({ dealershipId: 1, stage: 1, createdAt: -1 });
schema.index({ vehicleId: 1 });
schema.index({ inquiryId: 1 }, { unique: true, sparse: true });
schema.pre("validate", function () {
  // A normal query excludes the bearer token; validating a fetched document must
  // not require reselecting that secret just to save a note or stage change.
  validateRecord(this, this.isSelected("bookingToken") ? leadSchema : leadSchema.omit({ bookingToken: true }));
});
export const LeadModel: Model<InferSchemaType<typeof schema>> = (mongoose.models.Lead as Model<InferSchemaType<typeof schema>> | undefined)
  ?? mongoose.model("Lead", schema);

const cursorSchema = new Schema({
  _id: { type: String, required: true }, next: { type: Number, required: true },
}, { collection: "lead_assignment_cursors", strict: "throw" });
export const AssignmentCursorModel: Model<InferSchemaType<typeof cursorSchema>> = (mongoose.models.AssignmentCursor as Model<InferSchemaType<typeof cursorSchema>> | undefined)
  ?? mongoose.model("AssignmentCursor", cursorSchema);
