import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
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
const output = path.join(root, ".public-check", new Date().toISOString().replace(/[:.]/g, "-"));
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
  const uri = "mongodb://127.0.0.1:" + mongoPort + "/public_check";
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
  const db = mongoose.connection.db;
  const jeep = await db.collection("vehicles").findOne({ stockNo: "CLA-001" });
  await db.collection("vehicles").updateOne({ _id: jeep._id }, { $set: { photos: ["/file.svg", "/missing-photo.jpg"] } });
  const server = launch(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", String(port)], env);
  await waitFor(async () => (await fetch(origin + "/login")).ok, server);
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const label = (name) => page.getByLabel(name, { exact: true }).filter({ visible: true });
  async function layout() {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "No horizontal overflow");
    const small = await page.locator("a,button,input:not([type=hidden]),select,textarea").evaluateAll((elements) => elements.flatMap((element) => {
      const box = element.getBoundingClientRect();
      return box.width > 1 && box.height > 1 && (box.width < 44 || box.height < 44) ? [element.textContent || element.getAttribute("aria-label")] : [];
    }));
    assert.deepEqual(small, [], "44px tap targets");
  }
  async function inventory(query = "") {
    await page.goto(origin + "/inventory" + query);
    await page.getByRole("heading", { name: "Find your next vehicle" }).waitFor();
  }
  async function detail(id = jeep._id) {
    await page.goto(origin + `/inventory/${id}`);
    await page.getByRole("heading", { name: "Interested in this vehicle?" }).waitFor();
  }
  async function fill(email) {
    await label("Full name").fill("Public Demo Customer");
    await label("Email address").fill(email);
    await label("Phone number").fill("416-555-0101");
    await label("Message (optional)").fill("I would like to see this Jeep.");
  }
  await page.goto(origin);
  await page.waitForURL(origin + "/inventory");
  await page.getByRole("heading", { name: "Find your next vehicle" }).waitFor();
  const available = await db.collection("vehicles").countDocuments({ status: "available" });
  assert.equal(await page.locator("article[data-stock]").count(), available);
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 }); await layout();
    await page.screenshot({ path: path.join(output, `inventory-${width}.png`), fullPage: true });
  }
  await label("Dealership").selectOption(String(jeep.dealershipId));
  await page.getByRole("button", { name: "Apply filter" }).click();
  await page.waitForURL(/dealershipId=/);
  assert.equal(await page.locator("article[data-stock]").count(), await db.collection("vehicles").countDocuments({ status: "available", dealershipId: jeep.dealershipId }));
  await inventory("?dealershipId=" + new mongoose.Types.ObjectId());
  await page.getByRole("heading", { name: "No available vehicles" }).waitFor();
  await inventory("?dealershipId=invalid&page=-1");
  await page.getByRole("alert").filter({ hasText: "That filter is invalid" }).waitFor();
  // Temporarily expose every fixture to verify pagination with more than 24 rows.
  const originalStatuses = await db.collection("vehicles").find({}, { projection: { status: 1 } }).toArray();
  await db.collection("vehicles").updateMany({}, { $set: { status: "available" } });
  await inventory("?dealershipId=&page=2");
  await page.getByText("Page 2 of 2", { exact: true }).waitFor();
  assert.equal(await page.locator("article[data-stock]").count(), 3);
  await db.collection("vehicles").bulkWrite(originalStatuses.map((entry) => ({ updateOne: { filter: { _id: entry._id }, update: { $set: { status: entry.status } } } })));
  const hidden = await db.collection("vehicles").findOne({ status: { $ne: "available" } });
  for (const id of [hidden._id, "invalid", new mongoose.Types.ObjectId()]) {
    await page.goto(origin + `/inventory/${id}`);
    await page.getByRole("heading", { name: "Vehicle unavailable" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Send inquiry" }).count(), 0);
  }
  await db.collection("dealerships").updateOne({ _id: jeep.dealershipId }, { $set: { active: false } });
  await page.goto(origin + `/inventory/${jeep._id}`);
  await page.getByRole("heading", { name: "Vehicle unavailable" }).waitFor();
  await inventory("?dealershipId=" + jeep.dealershipId);
  await page.getByRole("heading", { name: "No available vehicles" }).waitFor();
  await db.collection("dealerships").updateOne({ _id: jeep.dealershipId }, { $set: { active: true } });
  await detail();
  await page.getByRole("img", { name: /photo 1/ }).waitFor();
  await page.getByText("No photo available", { exact: true }).waitFor();
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 }); await layout();
    await page.screenshot({ path: path.join(output, `vehicle-${width}.png`), fullPage: true });
  }
  assert.equal(await page.getByRole("heading", { name: "Linked leads" }).count(), 0);
  const before = await db.collection("leads").countDocuments();
  await page.getByRole("button", { name: "Send inquiry" }).click();
  assert.equal(await db.collection("leads").countDocuments(), before);
  await fill("public-check@example.com");
  // Losing a network request preserves the fields and permits a retry.
  await page.route("**/inventory/**", async (route) => route.request().method() === "POST" ? route.abort() : route.continue());
  await page.getByRole("button", { name: "Send inquiry" }).click();
  await page.getByRole("alert").filter({ hasText: "Unable to send your inquiry" }).waitFor();
  assert.equal(await label("Full name").inputValue(), "Public Demo Customer");
  await page.unroute("**/inventory/**");
  const requestPromise = page.waitForRequest((request) => request.method() === "POST" && !!request.headers()["next-action"]);
  await page.getByRole("button", { name: "Send inquiry" }).click();
  const request = await requestPromise;
  await page.getByRole("heading", { name: "Thank you for your inquiry" }).waitFor();
  await page.screenshot({ path: path.join(output, "thank-you.png"), fullPage: true });
  assert.equal(await db.collection("leads").countDocuments(), before + 1);
  const lead = await db.collection("leads").findOne({ email: "public-check@example.com" });
  assert.equal(String(lead.vehicleId), String(jeep._id));
  assert.equal(String(lead.dealershipId), String(jeep.dealershipId));
  const salesperson = await db.collection("users").findOne({ _id: lead.assignedTo });
  assert.equal(salesperson.role, "salesperson"); assert.equal(salesperson.active, true);
  assert.equal(String(salesperson.dealershipId), String(jeep.dealershipId));
  assert.equal(lead.stage, "new");
  assert.equal(lead.activity.filter((entry) => entry.type === "lead.assigned").length, 1);
  assert.ok(await db.collection("notifications").findOne({ userId: lead.assignedTo, event: "lead.assigned", eventId: { $exists: true } }));
  assert.ok(server.logs().includes('"to":["public-check@example.com"]'));
  assert.ok(server.logs().includes('"to":["' + salesperson.email + '"]'));
  assert.ok(server.logs().includes('/book/' + lead.bookingToken));
  assert.equal(lead.source, "public_inventory"); assert.equal(lead.activity[0].type, "lead.created");
  assert.match(lead.bookingToken, /^[A-Za-z0-9_-]{43}$/);
  const headers = request.headers();
  const replay = await context.request.post(request.url(), { headers: { "next-action": headers["next-action"], "content-type": headers["content-type"], origin }, data: request.postDataBuffer() });
  assert.equal(replay.ok(), true);
  assert.equal((await replay.text()).includes(lead.bookingToken), false);
  assert.equal(await db.collection("leads").countDocuments(), before + 1);
  // A form left open while staff put the Jeep on HOLD cannot create a fresh lead.
  await detail(); await fill("stale-check@example.com");
  await db.collection("vehicles").updateOne({ _id: jeep._id }, { $set: { status: "hold" } });
  await page.getByRole("button", { name: "Send inquiry" }).click();
  await page.getByRole("alert").filter({ hasText: "no longer available" }).waitFor();
  assert.equal(await db.collection("leads").countDocuments(), before + 1);
  await inventory();
  assert.equal(await page.locator('article[data-stock="CLA-001"]').count(), 0);
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, "result.json"), JSON.stringify({ passed: true, checks: ["public routes", "available only", "active dealerships", "filters", "pagination", "missing vehicles", "photos", "responsive layouts", "validation", "network retry", "inquiry persistence", "duplicate replay", "stale availability"] }, null, 2));
  console.info("Public site check passed. Artifacts: " + output);
} catch (error) {
  if (page) {
    await page.screenshot({ path: path.join(output, "failure.png"), fullPage: true }).catch(() => {});
    await writeFile(path.join(output, "failure.txt"), page.url() + "\n" + await page.locator("body").innerText());
  }
  console.error("Public site check artifacts: " + output);
  throw error;
} finally {
  await browser?.close();
  await mongoose.disconnect();
  for (const child of children.reverse()) if (child.exitCode === null) child.kill();
}


