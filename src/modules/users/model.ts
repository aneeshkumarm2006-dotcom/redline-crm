import "server-only";
import mongoose, { Schema, type Model, type Types } from "mongoose";
import type { Role } from "./schema";

type UserDocument = {
  name: string; email: string; passwordHash: string; role: Role;
  dealershipId: Types.ObjectId | null; active: boolean;
  phone: string | null; monthlyTarget: number | null; hiredAt: Date | null;
};
const schema = new Schema<UserDocument>({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, unique: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["owner", "salesperson"], required: true },
  dealershipId: { type: Schema.Types.ObjectId, ref: "Dealership", default: null },
  active: { type: Boolean, default: true, required: true },
  phone: { type: String, trim: true, maxlength: 40, default: null },
  monthlyTarget: { type: Number, min: 0, default: null },
  hiredAt: { type: Date, default: null },
}, { timestamps: true, strict: "throw", collection: "users" });

export const UserModel = (mongoose.models.User as Model<UserDocument> | undefined)
  ?? mongoose.model<UserDocument>("User", schema);
