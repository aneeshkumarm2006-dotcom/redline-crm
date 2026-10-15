import "server-only";

import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { validateRecord } from "@/lib/validate-record";
import { dealershipSchema } from "./schema";

const schema = new Schema({
  name: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  active: { type: Boolean, default: true, required: true },
}, { timestamps: true, strict: "throw", collection: "dealerships" });
schema.index({ active: 1, name: 1 });
schema.pre("validate", function () { validateRecord(this, dealershipSchema); });
export const DealershipModel: Model<InferSchemaType<typeof schema>> = (mongoose.models.Dealership as Model<InferSchemaType<typeof schema>> | undefined)
  ?? mongoose.model("Dealership", schema);
