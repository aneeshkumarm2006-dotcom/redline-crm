import "server-only";

import mongoose, { Schema, type Model } from "mongoose";
import type { Settings } from "./schema";

export const SETTINGS_ID = "singleton";
type SettingsDocument = Settings & { _id: string };
const embedded = { _id: false, strict: "throw" as const };
const status = new Schema({ key: { type: String, required: true }, label: { type: String, required: true }, color: { type: String, required: true } }, embedded);
const stage = status.clone().add({ order: { type: Number, required: true } });
const hours = new Schema({ opensAt: { type: String, required: true }, closesAt: { type: String, required: true } }, embedded);
const settingsModelSchema = new Schema<SettingsDocument>({
  _id: { type: String, enum: [SETTINGS_ID], default: SETTINGS_ID },
  emailFrom: { type: String, default: null },
  brand: { type: new Schema({ companyName: String, logoUrl: { type: String, default: null }, primaryColor: String }, embedded), required: true },
  vehicleStatuses: { type: [status], required: true },
  publicInventoryStatusKeys: { type: [String], default: ["available"] },
  leadStages: { type: [stage], required: true },
  booking: { type: new Schema({
    timeZone: String,
    businessHours: { type: new Schema({
      monday: hours, tuesday: hours, wednesday: hours, thursday: hours,
      friday: hours, saturday: hours, sunday: hours,
    }, embedded), required: true },
    slotLengthMinutes: Number, daysAhead: Number,
    appointmentStageKey: { type: String, default: "appointment" },
  }, embedded), required: true },
  leadAssignmentStrategy: { type: String, enum: ["round_robin", "manual"], required: true },
  notificationRules: [new Schema({ event: String, recipients: [String], channels: [String] }, embedded)],
}, { timestamps: true, strict: "throw", collection: "settings" });

export const SettingsModel = (mongoose.models.Settings as Model<SettingsDocument> | undefined)
  ?? mongoose.model<SettingsDocument>("Settings", settingsModelSchema);
