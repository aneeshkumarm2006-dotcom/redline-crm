import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";
import { connectDb } from "../src/lib/db";
import { VehicleModel } from "../src/modules/inventory/model";
import { isPlaceholderPhoto, vehiclePhotos } from "./seed/photos";

/** Gives demo vehicles with no photos (or only placeholders) real model photos; other photos are untouched. */
async function main() {
  loadEnvConfig(process.cwd());
  try {
    await connectDb();
    const vehicles = await VehicleModel.find({}, "year make model photos").lean();
    let updated = 0;
    for (const vehicle of vehicles) {
      const photos = vehiclePhotos(vehicle);
      if (!photos.length || !(vehicle.photos ?? []).every(isPlaceholderPhoto)) continue;
      await VehicleModel.updateOne({ _id: vehicle._id }, { $set: { photos } });
      updated++;
    }
    console.info(`Model photos added to ${updated} vehicle(s); vehicles with their own photos preserved.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
