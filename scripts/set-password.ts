import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";
import { connectDb } from "../src/lib/db";
import { hashPassword } from "../src/modules/auth/service";
import { passwordSchema } from "../src/modules/auth/schema";
import { UserModel } from "../src/modules/users/model";
import { emailSchema } from "../src/modules/users/schema";

const credentialsPath = ".auth-demo-credentials.json";

/** Prompts without echoing what is typed. */
function askHidden(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const output = rl as unknown as { _writeToOutput: (text: string) => void };
  let prompted = false;
  output._writeToOutput = (text) => { if (!prompted) { process.stdout.write(text); prompted = true; } };
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); process.stdout.write("\n"); resolve(answer); }));
}

/** Usage: npm run user:password -- owner@clairmount.example */
async function main() {
  loadEnvConfig(process.cwd());
  const email = emailSchema.parse(process.argv[2]);
  const password = await askHidden(`New password for ${email} (12-72 characters): `);
  if (!passwordSchema.safeParse(password).success) throw new Error("Password must be 12-72 characters.");
  if (password !== await askHidden("Repeat new password: ")) throw new Error("Passwords do not match.");
  try {
    await connectDb();
    const result = await UserModel.updateOne({ email }, { $set: { passwordHash: await hashPassword(password) } }).exec();
    if (!result.matchedCount) throw new Error(`No staff account for ${email}.`);
    // Keep the local demo credentials file in sync so a later `npm run seed` reuses the new password.
    try {
      const saved = JSON.parse(await readFile(credentialsPath, "utf8")) as { email: string; password: string }[];
      const entry = saved.find((credential) => credential.email === email);
      if (entry) { entry.password = password; await writeFile(credentialsPath, JSON.stringify(saved, null, 2) + "\n", { mode: 0o600 }); }
    } catch { /* No local credentials file; the database is the source of truth. */ }
    console.info(`Password changed for ${email}.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
