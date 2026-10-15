import { loadEnvConfig } from "@next/env";
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import mongoose from "mongoose";
import { z } from "zod";
import { hashPassword, verifyPassword } from "../src/modules/auth/service";
import { findCredentials, initializeUser } from "../src/modules/users/service";
import { initializeSettings } from "../src/modules/settings/service";
import { authDemoUsers } from "./seed/users";
import { demoSettings } from "./seed/settings";

loadEnvConfig(process.cwd(), true);
const credentialsPath = process.argv[2] ?? ".auth-demo-credentials.json";
const credentialSchema = z.array(z.object({ email: z.string().email(), password: z.string() }));

async function main() {
  try {
    let saved: z.infer<typeof credentialSchema> = [];
    try { saved = credentialSchema.parse(JSON.parse(await readFile(credentialsPath, "utf8"))); }
    catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
    // Persist generated passwords before DB writes so an interrupted seed can be resumed.
    for (const user of authDemoUsers) {
      if (!saved.some((entry) => entry.email === user.email) && !await findCredentials(user.email)) {
        saved.push({ email: user.email, password: randomBytes(24).toString("base64url") });
      }
    }
    await writeFile(credentialsPath, JSON.stringify(saved, null, 2) + "\n", { mode: 0o600 });
    await initializeSettings(demoSettings);
    for (const user of authDemoUsers) {
      const credential = saved.find((entry) => entry.email === user.email);
      if (credential) await initializeUser({ ...user, passwordHash: await hashPassword(credential.password) });
      const existing = await findCredentials(user.email);
      if (!existing) throw new Error("Missing demo account.");
      const usable = credential && existing.user.active && existing.user.role === user.role
        && await verifyPassword(credential.password, existing.passwordHash);
      console.info(user.role + (usable ? ": ready (credentials in " + credentialsPath + ")." : ": existing account preserved; use its existing credentials."));
    }
    console.info("Auth seed complete. No existing accounts or settings were changed.");
  } catch {
    console.error("Auth seed failed. Check MongoDB access and the local credentials file.");
    process.exitCode = 1;
  } finally { await mongoose.disconnect(); }
}
void main();
