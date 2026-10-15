import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";
import { initializeSettings } from "../src/modules/settings/service";
import { demoSettings } from "./seed/settings";

loadEnvConfig(process.cwd(), true);

async function main() {
  try {
    await initializeSettings(demoSettings);
    console.info("Settings singleton is ready. Existing settings were preserved.");
  } catch {
    console.error("Settings initialization failed. Check MongoDB connectivity and the settings schema.");
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
void main();
