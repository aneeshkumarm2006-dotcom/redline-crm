import { loadEnvConfig } from "@next/env";
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDb } from "../src/lib/db";
import { hashPassword, clearLoginAttemptsForSeed } from "../src/modules/auth/service";
import { passwordSchema } from "../src/modules/auth/schema";
import { replaceSettingsForSeed } from "../src/modules/settings/service";
import { replaceUsersForSeed } from "../src/modules/users/service";
import { replaceDealershipsForSeed } from "../src/modules/dealerships/service";
import { replaceVehiclesForSeed } from "../src/modules/inventory/service";
import { replaceLeadsForSeed } from "../src/modules/leads/service";
import { replaceAppointmentsForSeed } from "../src/modules/appointments/service";
import { replaceNotificationsForSeed } from "../src/modules/notifications/service";
import { replaceEmailTemplatesForSeed } from "../src/modules/email-templates/service";
import { replaceGaragesForSeed } from "../src/modules/garages/service";
import { replaceAutomationRunsForSeed, replaceEmailLogForSeed } from "../src/modules/automations/service";
import { clearViewsForSeed } from "../src/modules/views/service";
import { buildDemoData, demoStaff } from "./seed/data";

loadEnvConfig(process.cwd(), true);
const { values } = parseArgs({ options: { "credentials-file": { type: "string", default: ".auth-demo-credentials.json" } } });
const credentialsPath = values["credentials-file"]!;
const credentialSchema = z.array(z.object({ email: z.string().email(), password: passwordSchema }).strict());

async function main() {
  let resetting = false;
  try {
    // Require an explicit DB; never silently seed MongoDB's default "test" DB.
    const uri = process.env.MONGODB_URI?.trim();
    const database = uri?.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/)?.[1];
    if (!database || ["admin", "config", "local"].includes(decodeURIComponent(database))) {
      throw new Error("An explicit application database is required.");
    }
    let saved: z.infer<typeof credentialSchema> = [];
    try { saved = credentialSchema.parse(JSON.parse(await readFile(credentialsPath, "utf8"))); }
    catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
    const credentials = demoStaff.map((user) => ({
      email: user.email, password: saved.find((entry) => entry.email === user.email)?.password ?? randomBytes(24).toString("base64url"),
    }));
    const hashes: Record<string, string> = {};
    for (const credential of credentials) hashes[credential.email] = await hashPassword(credential.password);
    const data = buildDemoData(hashes, new Date(), process.env.APP_URL ?? "http://localhost:3000");
    await connectDb();
    // Save credentials before destructive writes; rerunning reuses the same passwords.
    await writeFile(credentialsPath, JSON.stringify(credentials, null, 2) + "\n", { mode: 0o600 });
    console.info("Resetting CRM demo collections in database: " + mongoose.connection.name);
    resetting = true;
    await replaceSettingsForSeed(data.settings);
    await replaceDealershipsForSeed(data.dealerships);
    await replaceGaragesForSeed(data.garages);
    await replaceUsersForSeed(data.users);
    await replaceVehiclesForSeed(data.vehicles);
    await replaceLeadsForSeed(data.leads);
    await replaceAppointmentsForSeed(data.appointments);
    await replaceNotificationsForSeed(data.notifications);
    await replaceEmailTemplatesForSeed(data.emailTemplates);
    await replaceAutomationRunsForSeed(data.automationRuns);
    await replaceEmailLogForSeed(data.emailLog);
    await clearViewsForSeed();
    await clearLoginAttemptsForSeed();
    const owners = data.users.filter((user) => user.role === "owner").length;
    const sold = data.vehicles.filter((vehicle) => vehicle.sale).length;
    const inRepair = data.vehicles.filter((vehicle) => vehicle.repair).length;
    const unread = data.notifications.filter((notification) => !notification.readAt).length;
    console.info(`Seed complete: ${data.dealerships.length} dealerships, ${data.garages.length} garages, ${owners} owner, ${data.users.length - owners} salespeople, `
      + `${data.vehicles.length} vehicles (${data.vehicles.length - sold} in stock, ${inRepair} in repair, ${sold} sold over 6 months), ${data.leads.length} leads, `
      + `${data.appointments.length} appointments, ${data.notifications.length} notifications (${unread} unread), ${data.emailTemplates.length} email templates, `
      + `${data.automationRuns.length} automation runs, ${data.emailLog.length} logged emails, and default settings.`);
    console.info("Demo Jeep: CLA-001 — 2022 Jeep Grand Cherokee Limited 4x4 (Available).");
    console.info("Local login credentials: " + credentialsPath + ". No emails were sent.");
  } catch {
    console.error(resetting
      ? "Seed failed during reset; data may be partial. Fix database access and rerun npm run seed with the same credentials file."
      : "Seed preflight failed; no collections were reset. Check MONGODB_URI (including database name), database access, fixtures and credentials file.");
    process.exitCode = 1;
  } finally { await mongoose.disconnect(); }
}
void main();
