import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";
import { connectDb } from "../src/lib/db";
import { emit, on } from "../src/lib/events";
import { ConsoleProvider } from "../src/lib/email/provider";
import { renderEmailTemplate } from "../src/lib/email/template";
import { getSettings } from "../src/modules/settings/service";

loadEnvConfig(process.cwd(), true);

async function main() {
  let unsubscribe: (() => void) | undefined;
  try {
    const connections = await Promise.all([connectDb(), connectDb()]);
    assert.equal(connections[0], connections[1]);
    const [settings, cached] = await Promise.all([getSettings(), getSettings()]);
    assert.deepEqual(settings, cached);
    const provider = new ConsoleProvider();
    let delivered = false;
    unsubscribe = on("lead.created", "foundation-check", async (event) => {
      const content = renderEmailTemplate({
        subject: "{{company}} foundation check",
        body: "<p>Test event {{event}} for lead {{leadId}} reached the console email provider.</p>",
      }, { company: settings.brand.companyName, event: event.name, leadId: event.payload.leadId });
      const receipt = await provider.send({ from: "demo@example.com", to: ["smoke@example.com"], ...content });
      assert.equal(receipt.provider, "console");
      delivered = true;
    });
    await emit("lead.created", { leadId: "foundation-check", vehicleId: "demo-vehicle", dealershipId: "demo-dealership" });
    assert.ok(delivered);
    console.info("Foundation check passed: shared connection, settings loaded, event awaited, console email delivered.");
  } catch {
    console.error("Foundation check failed. Check MongoDB connectivity and run npm run seed:settings first.");
    process.exitCode = 1;
  } finally {
    unsubscribe?.();
    await mongoose.disconnect();
  }
}
void main();
