import "server-only";

import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { validateRecord } from "@/lib/validate-record";
import { appointmentSchema, appointmentStatuses } from "./schema";

const schema = new Schema({
  leadId: { type: Schema.Types.ObjectId, ref: "Lead", required: true },
  vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
  salespersonId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  dealershipId: { type: Schema.Types.ObjectId, ref: "Dealership", required: true },
  startsAt: { type: Date, required: true }, endsAt: { type: Date, required: true },
  status: { type: String, enum: appointmentStatuses, default: "booked", required: true },
}, { timestamps: true, strict: "throw", collection: "appointments" });
schema.index({ salespersonId: 1, startsAt: 1, endsAt: 1 });
schema.index({ dealershipId: 1, startsAt: 1 });
schema.index({ leadId: 1 }, { unique: true, partialFilterExpression: { status: "booked" } });
// Concurrent bookings of the same slot for one salesperson: exactly one insert wins.
schema.index({ salespersonId: 1, startsAt: 1 }, { unique: true, partialFilterExpression: { status: "booked" } });
schema.pre("validate", function () { validateRecord(this, appointmentSchema); });
export const AppointmentModel: Model<InferSchemaType<typeof schema>> = (mongoose.models.Appointment as Model<InferSchemaType<typeof schema>> | undefined)
  ?? mongoose.model("Appointment", schema);
