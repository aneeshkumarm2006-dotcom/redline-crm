import "server-only";
import mongoose, { Schema, type Model } from "mongoose";

type LoginAttempt = { _id: string; count: number; expiresAt: Date };
const schema = new Schema<LoginAttempt>({
  _id: { type: String, required: true },
  count: { type: Number, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
}, { collection: "login_attempts", strict: "throw" });
export const LoginAttemptModel = (mongoose.models.LoginAttempt as Model<LoginAttempt> | undefined)
  ?? mongoose.model<LoginAttempt>("LoginAttempt", schema);
