import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";
import { initializeEmailTemplates } from "../src/modules/email-templates/service";
import { demoEmailTemplates } from "./seed/templates";

async function main() {
  loadEnvConfig(process.cwd());
  try {
    await initializeEmailTemplates(demoEmailTemplates);
    console.info("Missing automation templates initialized; existing templates preserved. No emails sent.");
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
