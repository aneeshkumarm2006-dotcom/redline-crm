import "server-only";

import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { validateRecord } from "@/lib/validate-record";
import { garageSchema } from "./schema";

const schema = new Schema({
  name: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  specialties: { type: [String], default: [] },
  active: { type: Boolean, default: true, required: true },
}, { timestamps: true, strict: "throw", collection: "garages" });
schema.index({ active: 1, name: 1 });
schema.pre("validate", function () { validateRecord(this, garageSchema); });
export const GarageModel: Model<InferSchemaType<typeof schema>> = (mongoose.models.Garage as Model<InferSchemaType<typeof schema>> | undefined)
  ?? mongoose.model("Garage", schema);
