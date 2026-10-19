import "server-only";

import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { validateRecord } from "@/lib/validate-record";
import { vehicleSchema } from "./schema";

const embedded = { _id: false, strict: "throw" as const };
const activity = new Schema({
  eventId: String, type: { type: String, required: true }, message: { type: String, required: true },
  occurredAt: { type: Date, required: true }, actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
}, embedded);
const priceHistory = new Schema({
  previousPrice: { type: Number, required: true }, price: { type: Number, required: true },
  changedAt: { type: Date, required: true }, changedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, embedded);
const statusHistory = new Schema({
  previousStatus: { type: String, required: true }, status: { type: String, required: true },
  changedAt: { type: Date, required: true }, changedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, embedded);
const repair = new Schema({
  typeKey: { type: String, required: true }, garageId: { type: Schema.Types.ObjectId, ref: "Garage", required: true },
  startedAt: { type: Date, required: true }, estimatedCost: { type: Number, default: null }, notes: { type: String, default: "", trim: true },
}, embedded);
const repairHistory = new Schema({
  typeKey: { type: String, required: true }, garageId: { type: Schema.Types.ObjectId, ref: "Garage", required: true },
  startedAt: { type: Date, required: true }, completedAt: { type: Date, required: true },
  cost: { type: Number, required: true }, completedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, embedded);
const sale = new Schema({
  salespersonId: { type: Schema.Types.ObjectId, ref: "User", required: true }, leadId: { type: Schema.Types.ObjectId, ref: "Lead", default: null },
  price: { type: Number, required: true }, commission: { type: Number, required: true },
  soldAt: { type: Date, required: true }, recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, embedded);
const schema = new Schema({
  stockNo: { type: String, required: true, trim: true, uppercase: true, unique: true },
  vin: { type: String, required: true, trim: true, uppercase: true, unique: true },
  year: { type: Number, required: true }, make: { type: String, required: true, trim: true },
  model: { type: String, required: true, trim: true }, trim: { type: String, default: "", trim: true },
  mileage: { type: Number, required: true }, price: { type: Number, required: true },
  priceHistory: { type: [priceHistory], default: [] }, status: { type: String, required: true },
  statusHistory: { type: [statusHistory], default: [] },
  activity: { type: [activity], default: [] },
  dealershipId: { type: Schema.Types.ObjectId, ref: "Dealership", required: true },
  photos: { type: [String], default: [] }, dateInStock: { type: Date, required: true },
  acquisitionCost: { type: Number, default: 0 }, commission: { type: Number, default: 0 },
  repair: { type: repair, default: null }, repairHistory: { type: [repairHistory], default: [] },
  sale: { type: sale, default: null },
}, { timestamps: true, strict: "throw", collection: "vehicles" });
schema.index({ dealershipId: 1, status: 1, dateInStock: -1 });
schema.index({ make: 1, model: 1 });
// Sales leaderboard / commission reports, and garage boards.
schema.index({ "sale.salespersonId": 1, "sale.soldAt": -1 });
schema.index({ "sale.soldAt": -1 });
schema.index({ "repair.garageId": 1 });
schema.pre("validate", function () { validateRecord(this, vehicleSchema); });
export const VehicleModel: Model<InferSchemaType<typeof schema>> = (mongoose.models.Vehicle as Model<InferSchemaType<typeof schema>> | undefined)
  ?? mongoose.model("Vehicle", schema);
