import "server-only";

import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { validateRecord } from "@/lib/validate-record";
import { savedViewSchema } from "./schema";

const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  board: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  query: { type: String, default: "" },
}, { timestamps: true, strict: "throw", collection: "board_views" });
// Saving a view under an existing name replaces it.
schema.index({ userId: 1, board: 1, name: 1 }, { unique: true });
schema.pre("validate", function () { validateRecord(this, savedViewSchema); });
export const SavedViewModel: Model<InferSchemaType<typeof schema>> = (mongoose.models.SavedView as Model<InferSchemaType<typeof schema>> | undefined)
  ?? mongoose.model("SavedView", schema);
