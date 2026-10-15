import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";
import { connectDb } from "../src/lib/db";
import { VehicleModel } from "../src/modules/inventory/model";
import { placeholderPhotos } from "./seed/photos";

/** Gives vehicles without photos placeholder images; vehicles with photos are untouched. */
async function main() {
  loadEnvConfig(process.cwd());
  try {
    await connectDb();
    const vehicles = await VehicleModel.find({ $or: [{ photos: { $size: 0 } }, { photos: { $exists: false } }] }, "year make model").lean();
    for (const vehicle of vehicles) await VehicleModel.updateOne({ _id: vehicle._id }, { $set: { photos: placeholderPhotos(vehicle) } });
    console.info(`Placeholder photos added to ${vehicles.length} vehicle(s); vehicles with photos preserved.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
