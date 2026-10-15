import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { parseArgs } from "node:util";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const { values } = parseArgs({ options: { "mongo-binary": { type: "string" } } });
if (!values["mongo-binary"]) throw new Error("Pass --mongo-binary with a local mongod executable.");
const root = process.cwd();
const output = path.join(root, ".seed-check", new Date().toISOString().replace(/[:.]/g, "-"));
await mkdir(path.join(output, "db"), { recursive: true });
const listener = createServer();
listener.listen(0, "127.0.0.1");
await once(listener, "listening");
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
const uri = `mongodb://127.0.0.1:${port}/seed_check`;
// Explicit override means this integration check never connects to Atlas.
const env = { ...process.env, MONGODB_URI: uri, RESEND_API_KEY: "" };
const credentialsFile = path.join(output, "credentials.json");
const mongo = spawn(values["mongo-binary"], ["--bind_ip", "127.0.0.1", "--port", String(port), "--dbpath", path.join(output, "db"), "--quiet"], { windowsHide: true, stdio: "ignore" });
const mongoExit = once(mongo, "exit");
async function runSeed(file = credentialsFile, expectedCode = 0) {
  const child = spawn(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/seed.ts", "--credentials-file", file], { cwd: root, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let logs = "";
  child.stdout.on("data", (chunk) => { logs += chunk; });
  child.stderr.on("data", (chunk) => { logs += chunk; });
  const [code] = await once(child, "exit");
  assert.equal(code, expectedCode, logs);
}
const counts = { settings: 1, dealerships: 3, users: 7, vehicles: 27, leads: 10, appointments: 2, notifications: 9, email_templates: 7, login_attempts: 0, lead_assignment_cursors: 0 };
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (mongo.exitCode !== null) throw new Error("Local MongoDB exited before becoming ready.");
    try { await mongoose.connect(uri, { serverSelectionTimeoutMS: 500 }); break; }
    catch { if (attempt === 59) throw new Error("Local MongoDB did not start."); await delay(250); }
  }
  const db = mongoose.connection.db;
  await db.collection("unrelated_collection").insertOne({ keep: true });
  await runSeed();
  const credentials = JSON.parse(await readFile(credentialsFile, "utf8"));
  const previousUsers = await db.collection("users").find().toArray();
  // A reseed must clear stale CRM rows and reset changed configuration, while
  // preserving collections owned by other applications and the local passwords.
  await db.collection("vehicles").updateOne({ stockNo: "CLA-001" }, { $set: { status: "hold" } });
  await db.collection("settings").updateOne({ _id: "singleton" }, { $set: { "brand.companyName": "Changed" } });
  await db.collection("notifications").insertOne({ stale: true });
  await db.collection("login_attempts").insertOne({ _id: "stale", count: 99 });
  await runSeed();
  for (const [collection, count] of Object.entries(counts)) assert.equal(await db.collection(collection).countDocuments(), count, collection);
  assert.equal(await db.collection("unrelated_collection").countDocuments(), 1);
  assert.deepEqual(JSON.parse(await readFile(credentialsFile, "utf8")), credentials);
  const users = await db.collection("users").find().toArray();
  assert.ok(users.every((user) => !previousUsers.some((previous) => previous._id.equals(user._id))));
  for (const user of users) {
    assert.equal(await bcrypt.compare(credentials.find((entry) => entry.email === user.email).password, user.passwordHash), true);
    assert.match(user.passwordHash, /^\$2[aby]\$12\$/);
  }
  const settings = await db.collection("settings").findOne();
  assert.equal(settings.brand.companyName, "Clairmount Auto");
  const dealerships = await db.collection("dealerships").find().toArray();
  const vehicles = await db.collection("vehicles").find().toArray();
  const leads = await db.collection("leads").find().toArray();
  const appointments = await db.collection("appointments").find().toArray();
  const notifications = await db.collection("notifications").find().toArray();
  const matches = (rows, id) => rows.find((row) => row._id.equals(id));
  for (const location of dealerships) assert.equal(users.filter((user) => user.dealershipId?.equals(location._id)).length, 2);
  for (const vehicle of vehicles) {
    assert.ok(matches(dealerships, vehicle.dealershipId));
    assert.ok(vehicle.dateInStock instanceof Date);
    assert.ok(settings.vehicleStatuses.some((status) => status.key === vehicle.status));
  }
  for (const lead of leads) {
    assert.ok(matches(vehicles, lead.vehicleId).dealershipId.equals(lead.dealershipId));
    if (lead.assignedTo) assert.ok(matches(users, lead.assignedTo).dealershipId.equals(lead.dealershipId));
    assert.ok(lead.activity[0].occurredAt instanceof Date);
    assert.match(lead.bookingToken, /^[A-Za-z0-9_-]{43}$/);
  }
  for (const appointment of appointments) {
    const lead = matches(leads, appointment.leadId);
    assert.ok(lead.vehicleId.equals(appointment.vehicleId));
    assert.ok(lead.assignedTo.equals(appointment.salespersonId));
    assert.ok(lead.dealershipId.equals(appointment.dealershipId));
    assert.equal(appointment.endsAt - appointment.startsAt, settings.booking.slotLengthMinutes * 60_000);
  }
  for (const notification of notifications) assert.ok(matches(users, notification.userId));
  assert.equal(vehicles.find((vehicle) => vehicle.stockNo === "CLA-001").status, "available");
  // Exercise the actual MongoDB unique indexes, not just schema declarations.
  for (const [collection, record] of [["vehicles", vehicles[0]], ["leads", leads[0]], ["users", users[0]], ["email_templates", await db.collection("email_templates").findOne()], ["appointments", appointments[0]]]) {
    const { _id, ...copy } = record;
    void _id;
    await assert.rejects(db.collection(collection).insertOne(copy), (error) => error.code === 11000);
  }
  const malformed = path.join(output, "invalid-credentials.json");
  await writeFile(malformed, "{}");
  await runSeed(malformed, 1);
  for (const [collection, count] of Object.entries(counts)) assert.equal(await db.collection(collection).countDocuments(), count);
  await writeFile(path.join(output, "result.json"), JSON.stringify({ passed: true, counts, checks: ["double seed", "stable passwords", "fresh session IDs", "foreign keys", "unique indexes", "settings reset", "unrelated collection preserved", "preflight failure preserves data"] }, null, 2) + "\n");
  console.info("PASS: isolated seed ran twice; counts, passwords, references, indexes, reset scope and failure preflight verified.");
  console.info("Evidence: " + path.relative(root, output));
} finally {
  await mongoose.disconnect();
  if (mongo.exitCode === null) mongo.kill();
  await mongoExit;
}
