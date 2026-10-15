import nextEnv from "@next/env";
import mongoose from "mongoose";

nextEnv.loadEnvConfig(process.cwd(), true);

const uri = process.env.MONGODB_URI?.trim();

if (!uri) {
  console.error("Set MONGODB_URI in site/.env.local before running db:check.");
  process.exitCode = 1;
} else if (!uri.startsWith("mongodb+srv://") && !uri.startsWith("mongodb://")) {
  console.error("MONGODB_URI must be a MongoDB connection string.");
  process.exitCode = 1;
} else {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    await mongoose.connection.db.command({ ping: 1 });
    console.log("MongoDB connection and ping succeeded.");
  } catch {
    // Driver errors can include credentials or infrastructure details.
    console.error(
      "MongoDB connection failed. Check the URI, database credentials, Atlas IP access list, and network access.",
    );
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
