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
const output = path.join(root, ".auth-check", new Date().toISOString().replace(/[:.]/g, "-"));
await mkdir(path.join(output, "db"), { recursive: true });
const children = [];
let browser;
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
  const uri = "mongodb://127.0.0.1:" + mongoPort + "/auth_check";
  const origin = "http://localhost:" + port;
  // Overrides are explicit: this check never uses the database in .env.local.
  const env = { ...process.env, MONGODB_URI: uri, AUTH_SECRET: randomBytes(48).toString("base64url"), APP_URL: origin, RESEND_API_KEY: "" };
  const mongo = launch(values["mongo-binary"], ["--bind_ip", "127.0.0.1", "--port", String(mongoPort), "--dbpath", path.join(output, "db"), "--quiet"], env);
  await waitFor(async () => {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 500 });
    return true;
  }, mongo);
  const credentialsFile = path.join(output, "credentials.json");
  const seedArgs = ["--conditions=react-server", "--import", "tsx", "scripts/seed-auth.ts", credentialsFile];
  await run(process.execPath, seedArgs, env);
  const credentials = JSON.parse(await readFile(credentialsFile, "utf8"));
  const firstUsers = await mongoose.connection.db.collection("users").find().toArray();
  await run(process.execPath, seedArgs, env);
  const secondUsers = await mongoose.connection.db.collection("users").find().toArray();
  assert.deepEqual(secondUsers.map((user) => user.passwordHash), firstUsers.map((user) => user.passwordHash));
  assert.equal(secondUsers.length, 2);
  console.info("PASS: isolated auth seed is repeatable and preserves accounts.");
  const server = launch(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", String(port)], env);
  await waitFor(async () => (await fetch(origin + "/login")).ok, server);
  const publicResponse = await fetch(origin + "/");
  assert.equal(publicResponse.status, 200);
  for (const url of ["/inventory", "/book/example"]) {
    const response = await fetch(origin + url, { redirect: "manual" });
    assert.notEqual(response.status, 307);
    assert.equal(response.headers.get("location"), null);
  }
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(origin + "/crm/team");
  await page.waitForURL("**/login?returnTo=*");
  await page.getByRole("heading", { name: "Staff sign in" }).waitFor();
  assert.equal(await page.getByRole("link", { name: /sign up/i }).count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(output, "login-mobile.png"), fullPage: true });
  const owner = credentials.find((entry) => entry.email.startsWith("owner@"));
  const salesperson = credentials.find((entry) => entry.email.startsWith("salesperson@"));
  async function submit(credential) {
    await page.getByLabel("Email address").fill(credential.email);
    await page.getByLabel("Password", { exact: true }).fill(credential.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
  }
  async function checkLayout() {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "No horizontal overflow");
    const smallTargets = await page.locator("a, button, input:not([type=hidden])").evaluateAll((elements) => elements.flatMap((element) => {
      const box = element.getBoundingClientRect();
      // Hidden desktop/mobile duplicates and the offscreen skip link are not tap targets.
      if (box.width <= 1 || box.height <= 1) return [];
      return box.width < 44 || box.height < 44 ? [element.textContent || element.getAttribute("aria-label")] : [];
    }));
    assert.deepEqual(smallTargets, [], "Every visible control has a 44px target");
  }
  async function checkShell() {
    await page.evaluate(() => { window.__shellNavigationCheck = true; });
    const tabs = [["Dashboard", "/crm"], ["Leads", "/crm/leads"], ["Inventory", "/crm/inventory"], ["Alerts", "/crm/alerts"]];
    for (const [label, href] of tabs) {
      const nav = page.getByRole("navigation", { name: "Main navigation" });
      assert.equal(await nav.count(), 1);
      await nav.getByRole("link", { name: label, exact: true }).click();
      await page.waitForURL(origin + href);
      await page.getByRole("heading", { name: label, exact: true }).waitFor();
      await nav.locator('a[aria-current="page"]').filter({ hasText: label }).waitFor();
      assert.equal(await nav.locator('a[aria-current="page"]').count(), 1);
      assert.equal(await page.evaluate(() => window.__shellNavigationCheck), true, "Tab changes use client navigation");
      await checkLayout();
      await page.screenshot({ path: path.join(output, label.toLowerCase() + "-mobile.png"), fullPage: true });
    }
    await page.goBack();
    await page.getByRole("heading", { name: "Inventory", exact: true }).waitFor();
    await page.getByRole("navigation").getByRole("link", { name: "Inventory" }).and(page.locator('[aria-current="page"]')).waitFor();
    await page.goForward();
    await page.getByRole("heading", { name: "Alerts", exact: true }).waitFor();
    await page.reload();
    await page.getByRole("heading", { name: "Alerts", exact: true }).waitFor();
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await checkLayout();
      assert.equal(await page.getByRole("navigation").count(), 1);
      const position = await page.getByRole("navigation").evaluate((nav) => nav.parentElement.getBoundingClientRect().toJSON());
      if (width < 1024) assert.ok(position.top > 700, "Mobile navigation stays at the bottom");
      else assert.equal(position.left, 0, "Desktop navigation is a left sidebar");
    }
    await page.getByRole("navigation").getByRole("link", { name: "Dashboard" }).click();
    await page.getByRole("heading", { name: "Dashboard", exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, "dashboard-desktop.png"), fullPage: true, animations: "disabled" });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole("button", { name: "Account menu", exact: true }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("dialog", { name: "Account menu" }).waitFor();
    await checkLayout();
    await page.screenshot({ path: path.join(output, "account-mobile.png"), fullPage: true });
    await page.keyboard.press("Escape");
    await page.getByRole("dialog", { name: "Account menu" }).waitFor({ state: "hidden" });
    await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Account menu");
  }
  await submit({ ...owner, password: "incorrect-password" });
  await page.locator("#login-error").waitFor();
  assert.equal(await page.locator("#login-error").textContent(), "Email or password is incorrect.");
  await submit(owner);
  await page.waitForURL(origin + "/crm/team");
  await page.getByRole("heading", { name: "Team access", exact: true }).waitFor();
  await page.getByRole("heading", { name: "Demo Salesperson", exact: true }).waitFor();
  const cookie = (await context.cookies()).find((value) => value.name === "redline_session");
  assert.ok(cookie?.httpOnly && cookie.secure && cookie.sameSite === "Lax");
  assert.equal(await page.evaluate(() => document.cookie.includes("redline_session")), false);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(output, "owner-team-mobile.png"), fullPage: true });
  console.info("PASS: wrong credentials fail; seeded owner logs in, returns to team page, and gets a secure httpOnly cookie.");
  await checkShell();
  await page.getByRole("button", { name: "Account menu", exact: true }).click();
  await page.getByRole("link", { name: "Team access" }).click();
  await page.getByRole("heading", { name: "Team access", exact: true }).waitFor();
  await page.getByRole("dialog", { name: "Account menu" }).waitFor({ state: "hidden" });
  console.info("PASS: four tabs, active state, client navigation, browser history, deep links, 320/375/768/1440px layouts and keyboard account menu.");
  await page.getByRole("button", { name: "Account menu", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.waitForURL(origin + "/login");
  assert.equal((await context.cookies()).some((value) => value.name === "redline_session"), false);
  await page.goto(origin + "/crm/team");
  await page.waitForURL("**/login?returnTo=*");
  await submit(salesperson);
  await page.waitForURL(origin + "/crm/access-denied");
  await page.getByRole("heading", { name: "Owner access required" }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "Demo Owner", exact: true }).count(), 0);
  await page.screenshot({ path: path.join(output, "salesperson-denied-mobile.png"), fullPage: true });
  await page.getByRole("link", { name: "Back to workspace" }).click();
  await page.waitForURL(origin + "/crm");
  await page.getByRole("heading", { name: "Dashboard", exact: true }).waitFor();
  await checkShell();
  await page.getByRole("button", { name: "Account menu", exact: true }).click();
  await page.getByRole("dialog", { name: "Account menu" }).getByText("Demo Salesperson", { exact: true }).waitFor();
  assert.equal(await page.getByRole("link", { name: "Team access" }).count(), 0);
  await page.keyboard.press("Escape");
  console.info("PASS: logout clears the cookie; salesperson can use CRM but cannot open the owner-only page.");
  // A signed session must not override current database roles or active state.
  await mongoose.connection.db.collection("users").updateOne({ email: salesperson.email }, { $set: { active: false } });
  await page.goto(origin + "/crm");
  await page.waitForURL(origin + "/login");
  await page.getByRole("heading", { name: "Staff sign in" }).waitFor();
  await submit(salesperson);
  await page.locator("#login-error").waitFor();
  assert.equal(await page.locator("#login-error").textContent(), "Email or password is incorrect.");
  await context.clearCookies();
  await page.goto(origin + "/login?returnTo=https://example.com");
  await submit(owner);
  await page.waitForURL(origin + "/crm");
  await mongoose.connection.db.collection("users").updateOne({ email: owner.email }, { $set: { role: "salesperson" } });
  await page.goto(origin + "/crm/team");
  await page.waitForURL(origin + "/crm/access-denied");
  console.info("PASS: deactivation and role changes apply to existing sessions; external return URLs are rejected.");
  // Exercise settings-driven branding without mutating Atlas or waiting on cache TTL.
  await mongoose.connection.db.collection("settings").updateOne({ _id: "singleton" }, { $set: {
    "brand.companyName": "A".repeat(120), "brand.primaryColor": "#facc15", "brand.logoUrl": "https://assets.example.test/logo.svg",
  } });
  await mongoose.connection.db.collection("users").updateOne({ email: owner.email }, { $set: { role: "owner", name: "Owner".repeat(24) } });
  const stopped = once(server.child, "exit");
  server.child.kill();
  await stopped;
  const brandedServer = launch(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", String(port)], env);
  await waitFor(async () => (await fetch(origin + "/login")).ok, brandedServer);
  await context.clearCookies();
  await page.route("https://assets.example.test/logo.svg", (route) => route.fulfill({
    contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44"><rect width="44" height="44" fill="navy"/></svg>',
  }));
  await page.goto(origin + "/login");
  await page.getByRole("heading", { name: "Staff sign in" }).waitFor();
  await checkLayout();
  assert.equal(await page.getByRole("button", { name: "Sign in", exact: true }).evaluate((button) => getComputedStyle(button).backgroundColor), "rgb(250, 204, 21)");
  await submit(owner);
  await page.getByRole("heading", { name: "Dashboard", exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector("header img")?.naturalWidth > 0);
  await checkLayout();
  const activeLink = page.getByRole("navigation").locator('[aria-current="page"]');
  assert.deepEqual(await activeLink.evaluate((link) => ({ background: getComputedStyle(link).backgroundColor, color: getComputedStyle(link).color })), { background: "rgb(250, 204, 21)", color: "rgb(0, 0, 0)" });
  await page.getByRole("button", { name: "Account menu", exact: true }).click();
  await page.getByRole("dialog", { name: "Account menu" }).waitFor();
  await checkLayout();
  assert.equal(await page.getByRole("dialog").evaluate((dialog) => getComputedStyle(dialog).getPropertyValue("--primary").trim()), "#facc15", "Theme reaches portalled menu");
  await page.screenshot({ path: path.join(output, "custom-brand-mobile.png"), fullPage: true });
  await page.unroute("https://assets.example.test/logo.svg");
  await page.route("https://assets.example.test/logo.svg", (route) => route.abort());
  await page.reload();
  await page.locator(`header a[href="/crm"] svg`).waitFor();
  assert.equal(await page.locator("header img").count(), 0, "Broken logo falls back to the car icon");
  await checkLayout();
  console.info("PASS: custom logo, broken-logo fallback, long company/user names, settings-driven theme and readable foreground.");
  assert.deepEqual(pageErrors, []);
  const result = { passed: true, checks: ["idempotent seed", "public routes", "invalid login", "owner login", "cookie flags", "logout", "salesperson denial", "inactive user", "changed role", "safe redirect", "responsive shell", "client navigation", "active tabs and history", "44px targets", "keyboard account menu", "custom branding", "broken logo", "long names"], screenshots: ["login-mobile.png", "owner-team-mobile.png", "salesperson-denied-mobile.png", "dashboard-mobile.png", "leads-mobile.png", "inventory-mobile.png", "alerts-mobile.png", "dashboard-desktop.png", "account-mobile.png", "custom-brand-mobile.png"] };
  await writeFile(path.join(output, "result.json"), JSON.stringify(result, null, 2) + "\n");
  console.info("Auth browser check passed. Evidence: " + path.relative(root, output));
} finally {
  await browser?.close();
  await mongoose.disconnect();
  for (const child of children.reverse()) {
    if (child.exitCode === null && child.signalCode === null) {
      const stopped = once(child, "exit");
      child.kill();
      await stopped;
    }
  }
}
