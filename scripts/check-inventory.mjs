import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { parseArgs } from "node:util";
import mongoose from "mongoose";

const { values } = parseArgs({ options: {
  "mongo-binary": { type: "string" }, "playwright-module": { type: "string" },
} });
if (!values["mongo-binary"]) throw new Error("Pass --mongo-binary with the path to a local mongod executable.");
const require = createRequire(import.meta.url);
const { chromium } = require(values["playwright-module"] ?? "playwright");
const root = process.cwd();
const output = path.join(root, ".inventory-check", new Date().toISOString().replace(/[:.]/g, "-"));
await mkdir(path.join(output, "db"), { recursive: true });
const children = [];
let browser;
let page;
async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}
function launch(command, args, env) {
  const child = spawn(command, args, { cwd: root, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let logs = "";
  child.stdout.on("data", (data) => { logs += data.toString(); });
  child.stderr.on("data", (data) => { logs += data.toString(); });
  children.push(child);
  return { child, logs: () => logs };
}
async function run(command, args, env) {
  const task = launch(command, args, env);
  const [code] = await once(task.child, "exit");
  assert.equal(code, 0, task.logs());
}
async function waitFor(check, processInfo) {
  for (let i = 0; i < 120; i++) {
    if (processInfo.child.exitCode !== null) throw new Error(processInfo.logs());
    try { if (await check()) return; } catch {}
    await delay(500);
  }
  throw new Error("Timed out waiting for local check server. " + processInfo.logs());
}
try {
  const mongoPort = await freePort();
  const port = await freePort();
  const uri = "mongodb://127.0.0.1:" + mongoPort + "/inventory_check";
  const origin = "http://localhost:" + port;
  // Overrides are explicit: this check never uses the database in .env.local.
  const env = { ...process.env, MONGODB_URI: uri, AUTH_SECRET: randomBytes(48).toString("base64url"), APP_URL: origin, RESEND_API_KEY: "", EMAIL_PROVIDER: "console" };
  const mongo = launch(values["mongo-binary"], ["--bind_ip", "127.0.0.1", "--port", String(mongoPort), "--dbpath", path.join(output, "db"), "--quiet"], env);
  await waitFor(async () => {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 500 });
    return true;
  }, mongo);
  const credentialsFile = path.join(output, "credentials.json");
  await run(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/seed.ts", "--credentials-file", credentialsFile], env);
  const credentials = JSON.parse(await readFile(credentialsFile, "utf8"));
  const owner = credentials.find((entry) => entry.email.startsWith("owner@"));
  const salesperson = credentials.find((entry) => !entry.email.startsWith("owner@"));
  const db = mongoose.connection.db;
  const jeep = await db.collection("vehicles").findOne({ stockNo: "CLA-001" });
  const server = launch(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", String(port)], env);
  await waitFor(async () => (await fetch(origin + "/login")).ok, server);
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  page = await context.newPage();
  const errors = [];
  // Cache Components retain inactive routes in hidden Activity trees.
  const label = (name) => page.getByLabel(name, { exact: true }).filter({ visible: true });
  page.on("pageerror", (error) => errors.push(error.message));
  async function login(account) {
    await page.goto(origin + "/crm/inventory");
    await label("Email address").fill(account.email);
    await label("Password").fill(account.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("heading", { name: "Inventory", exact: true }).waitFor();
  }
  async function layout() {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "No horizontal overflow");
    const small = await page.locator("a,button,input:not([type=hidden]),select").evaluateAll((elements) => elements.flatMap((element) => {
      const box = element.getBoundingClientRect();
      return box.width > 1 && box.height > 1 && (box.width < 44 || box.height < 44) ? [element.textContent || element.getAttribute("aria-label")] : [];
    }));
    assert.deepEqual(small, [], "44px tap targets");
  }
  async function inventory(query = "") {
    await page.goto(origin + "/crm/inventory" + query);
    await page.getByRole("heading", { name: "Inventory", exact: true }).waitFor();
  }
  await login(owner);
  await page.getByRole("link", { name: "Next", exact: true }).waitFor();
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await page.getByText("Page 2 of 2", { exact: true }).waitFor();
  assert.equal(await page.locator("article[data-stock]").count(), 3);
  await inventory("?q=CLA-001");
  await layout();
  const status = page.getByRole("button", { name: "Change status: CLA-001", exact: true }).filter({ visible: true });
  // The demo acceptance criterion: exactly two clicks from the card.
  await status.click();
  await layout();
  await page.screenshot({ path: path.join(output, "status-sheet-mobile.png"), animations: "disabled" });
  await page.getByRole("dialog").getByRole("button", { name: "HOLD", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await status.getByText("HOLD", { exact: true }).waitFor();
  const held = await db.collection("vehicles").findOne({ _id: jeep._id });
  assert.equal(held.status, "hold");
  assert.equal(held.statusHistory.length, jeep.statusHistory.length + 1);
  assert.equal(String(held.statusHistory.at(-1).changedBy), String((await db.collection("users").findOne({ email: owner.email }))._id));
  assert.equal(held.activity.at(-1).type, "vehicle.status_changed");
  const holdAlerts = await db.collection("notifications").find({ eventId: held.activity.at(-1).eventId }).toArray();
  const locationStaff = await db.collection("users").find({ active: true, role: "salesperson", dealershipId: held.dealershipId }).toArray();
  assert.deepEqual(holdAlerts.map((alert) => String(alert.userId)).sort(), locationStaff.map((user) => String(user._id)).sort());
  for (const user of locationStaff) assert.ok(server.logs().includes('"to":["' + user.email + '"]'));
  await page.screenshot({ path: path.join(output, "jeep-held-mobile.png"), fullPage: true });
  console.info("PASS: owner puts the Jeep on HOLD in two taps; database history has the correct actor.");
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await layout();
    await page.screenshot({ path: path.join(output, `inventory-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 375, height: 812 });
  // Filters start collapsed (Stage 11) so the list leads on a phone.
  const filterPanel = page.locator("details").filter({ hasText: "Search and filters" });
  if (!(await filterPanel.evaluate((details) => details.open))) await filterPanel.locator("summary").click();
  await label("Search inventory").fill("Jeep");
  await label("Dealership").selectOption(String(jeep.dealershipId));
  await label("Status").selectOption("hold");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await page.waitForURL(/q=Jeep/);
  assert.equal(await page.locator("article[data-stock]").count(), 1);
  await inventory("?q=nonexistent-vehicle");
  await page.getByRole("heading", { name: "No vehicles found" }).waitFor();
  await page.goto(origin + `/crm/inventory/${jeep._id}`);
  await page.getByRole("heading", { name: "2022 Jeep Grand Cherokee", exact: true }).waitFor();
  await page.getByRole("heading", { name: "Linked leads" }).waitFor();
  await layout();
  await page.getByRole("button", { name: "Edit price: CLA-001" }).click();
  await label("Price (CAD)").fill("38999.95");
  await page.getByRole("button", { name: "Save price", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  const repriced = await db.collection("vehicles").findOne({ _id: jeep._id });
  assert.equal(repriced.price, 38999.95);
  assert.equal(repriced.priceHistory.length, jeep.priceHistory.length + 1);
  await page.reload();
  await page.getByText("$38,999.95", { exact: true }).waitFor();
  await page.screenshot({ path: path.join(output, "detail-mobile.png"), fullPage: true });
  // A second tab with an old revision cannot overwrite the first tab's change.
  const stale = await context.newPage();
  await stale.goto(origin + `/crm/inventory/${jeep._id}/edit`);
  await stale.getByLabel("Trim", { exact: true }).fill("Stale edit");
  await page.getByRole("button", { name: "Change status: CLA-001" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sold", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await stale.getByRole("button", { name: "Save vehicle", exact: true }).click();
  await stale.getByRole("alert").filter({ hasText: "This vehicle changed" }).waitFor();
  assert.notEqual((await db.collection("vehicles").findOne({ _id: jeep._id })).trim, "Stale edit");
  await stale.close();
  console.info("PASS: combined filters, pagination, empty state, detail, price history and stale-edit protection.");
  await page.goto(origin + "/crm/inventory/new");
  await label("Stock number").fill("TEST-NEW");
  // Correct 17-character VIN, independent of synthetic seed VINs.
  await label("VIN").fill("1C4RJFBG8NC9999999");
  await label("Year").fill("2024");
  await label("Make").fill("Test Make");
  await label("Model").fill("Test Model");
  await label("Mileage (km)").fill("12000");
  await label("Price (CAD)").fill("42000");
  await label("Dealership").selectOption(String(jeep.dealershipId));
  await label("Photo URLs (one per line)").fill("/file.svg\n/missing-photo.jpg");
  await layout();
  await page.getByRole("button", { name: "Save vehicle", exact: true }).click();
  await page.getByRole("heading", { name: "2024 Test Make Test Model", exact: true }).waitFor();
  const created = await db.collection("vehicles").findOne({ stockNo: "TEST-NEW" });
  assert.equal(created.photos.length, 2);
  await page.getByText("No photo available", { exact: true }).waitFor();
  await page.getByRole("link", { name: "Edit vehicle", exact: true }).click();
  await page.waitForURL(origin + `/crm/inventory/${created._id}/edit`);
  await page.getByRole("heading", { name: "Edit vehicle", exact: true }).waitFor();
  await label("Trim").fill("Touring");
  await label("Price (CAD)").fill("41000");
  await label("Status").selectOption("hold");
  await page.getByRole("button", { name: "Save vehicle", exact: true }).click();
  await page.getByRole("heading", { name: "2024 Test Make Test Model", exact: true }).waitFor();
  const edited = await db.collection("vehicles").findOne({ stockNo: "TEST-NEW" });
  assert.equal(edited.trim, "Touring");
  assert.equal(edited.statusHistory.length, 1); assert.equal(edited.priceHistory.length, 1);
  await page.goto(origin + `/crm/inventory/${created._id}/edit`);
  await label("Stock number").fill("CLA-001");
  await page.getByRole("button", { name: "Save vehicle", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "already in use" }).waitFor();
  await page.goto(origin + "/crm/inventory/not-an-id");
  await page.getByText("This page could not be found.", { exact: true }).waitFor();
  console.info("PASS: add/edit, photo rendering and fallback, duplicate protection, missing vehicle.");
  await context.clearCookies();
  await login(salesperson);
  assert.equal(await page.getByRole("link", { name: "Add vehicle" }).count(), 0);
  assert.equal(await page.getByRole("button", { name: /Change status:/ }).count(), 0);
  await page.goto(origin + `/crm/inventory/${jeep._id}`);
  await page.getByRole("heading", { name: "2022 Jeep Grand Cherokee", exact: true }).waitFor();
  assert.equal(await page.getByRole("link", { name: "Edit vehicle" }).count(), 0);
  await page.goto(origin + `/crm/inventory/${jeep._id}/edit`);
  await page.waitForURL(origin + "/crm/access-denied");
  await page.goto(origin + "/crm/inventory/new");
  await page.waitForURL(origin + "/crm/access-denied");
  assert.deepEqual(errors, []);
  console.info("PASS: salesperson read-only inventory and owner-only form routes; no browser errors.");
  await writeFile(path.join(output, "result.json"), JSON.stringify({ passed: true, checks: ["two-tap hold", "responsive layouts", "filters", "pagination", "detail", "price history", "stale edit", "create/edit", "photos", "duplicate", "authorization"] }, null, 2));
  console.info("Inventory check passed. Artifacts: " + output);
} catch (error) {
  if (page) {
    await page.screenshot({ path: path.join(output, "failure.png"), fullPage: true }).catch(() => {});
    await writeFile(path.join(output, "failure.txt"), page.url() + "\n" + await page.locator("body").innerText());
  }
  console.error("Inventory check artifacts: " + output);
  throw error;
} finally {
  await browser?.close();
  await mongoose.disconnect();
  for (const child of children.reverse()) if (child.exitCode === null) child.kill();
}
