import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test, type TestContext } from "node:test";
import mongoose from "mongoose";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { UserModel } from "../src/modules/users/model";
import { LoginAttemptModel } from "../src/modules/auth/model";
import { authenticate, AuthorizationError, getCurrentUser, hashPassword, login, LoginRateLimitError, logout, requireRole, verifyPassword } from "../src/modules/auth/service";
import { findActiveUser, initializeUser, listTeam } from "../src/modules/users/service";
import { loginSchema } from "../src/modules/auth/schema";
import { safeReturnTo } from "../src/modules/auth/routes";
import { SESSION_COOKIE, SESSION_SECONDS, sessionCookieOptions, signSession, verifySession } from "../src/modules/auth/session";
import { proxy } from "../src/proxy";

const require = createRequire(import.meta.url);
const nextHeaders = require("next/headers") as typeof import("next/headers");
const id = "507f1f77bcf86cd799439011";
const secret = "test-only-secret-with-at-least-32-bytes";
const account = { _id: new mongoose.Types.ObjectId(id), name: "Test User", email: "test@example.com", role: "owner", dealershipId: null, active: true };
function setup(t: TestContext) {
  const previous = { AUTH_SECRET: process.env.AUTH_SECRET, MONGODB_URI: process.env.MONGODB_URI };
  Object.assign(process.env, { AUTH_SECRET: secret, MONGODB_URI: "mongodb://example.invalid/test" });
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  t.mock.method(mongoose, "connect", async () => mongoose);
}
function cookieJar(t: TestContext, initial?: string) {
  const values = new Map(initial ? [[SESSION_COOKIE, initial]] : []);
  const writes: { name: string; value: string; options: Record<string, unknown> }[] = [];
  t.mock.method(nextHeaders, "cookies", async () => ({
    get: (name: string) => values.has(name) ? { name, value: values.get(name) } : undefined,
    set: (name: string, value: string, options: Record<string, unknown>) => {
      values.set(name, value); writes.push({ name, value, options });
    },
  }));
  return { values, writes };
}
function mockAccount(t: TestContext, get: () => object | null) {
  return t.mock.method(UserModel, "findOne", () => {
    const query = { select: () => query, lean: () => query, exec: async () => get() };
    return query;
  });
}
function allowAttempts(t: TestContext, count = 1) {
  return t.mock.method(LoginAttemptModel, "findOneAndUpdate", () => ({ lean: () => ({ exec: async () => ({ count }) }) }));
}

test("bcrypt hashes with cost 12, verifies without trimming and rejects truncation", async () => {
  const password = " a long password ";
  const hash = await hashPassword(password);
  assert.match(hash, /^\$2[aby]\$12\$/);
  assert.notEqual(hash, await hashPassword(password));
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword(password.trim(), hash), false);
  await assert.rejects(hashPassword("short"));
  await assert.rejects(hashPassword("é".repeat(37)));
  assert.equal(await verifyPassword("a".repeat(73), hash), false);
});

test("login schema normalizes email, rejects query objects and preserves password", () => {
  assert.deepEqual(loginSchema.parse({ email: " TEST@Example.com ", password: " unchanged " }), { email: "test@example.com", password: " unchanged " });
  assert.equal(loginSchema.safeParse({ email: { $ne: null }, password: "pw" }).success, false);
  assert.equal(loginSchema.safeParse({ email: "test@example.com", password: "pw", role: "owner" }).success, false);
});

test("sessions reject expired, tampered, wrong audience/algorithm and missing claims", async (t) => {
  setup(t);
  const token = await signSession(id);
  assert.deepEqual(await verifySession(token), { userId: id });
  assert.equal(await verifySession(undefined), null);
  assert.equal(await verifySession("malformed"), null);
  const parts = token.split(".");
  parts[1] = Buffer.from(JSON.stringify({ sub: "507f1f77bcf86cd799439012" })).toString("base64url");
  assert.equal(await verifySession(parts.join(".")), null);
  const key = new TextEncoder().encode(secret);
  const custom = (alg = "HS256", audience = "redline-staff", expiry = "8h", subject = id) =>
    new SignJWT({}).setProtectedHeader({ alg }).setSubject(subject).setIssuer("redline-crm")
      .setAudience(audience).setIssuedAt().setExpirationTime(expiry).sign(key);
  for (const bad of [await custom("HS256", "wrong"), await custom("HS384"), await custom("HS256", "redline-staff", "-1s"), await custom("HS256", "redline-staff", "8h", "bad-id"),
    await new SignJWT({ sub: id }).setProtectedHeader({ alg: "HS256" }).sign(key)]) {
    assert.equal(await verifySession(bad), null);
  }
  process.env.AUTH_SECRET = "short";
  await assert.rejects(signSession(id), /AUTH_SECRET/);
});

test("return URLs stay inside canonical CRM paths", () => {
  assert.equal(safeReturnTo("/crm/team?view=active"), "/crm/team?view=active");
  for (const value of ["https://evil.example", "//evil.example", "/crm/../../evil", "/crm/%2f%2fevil", "/crm\\evil", "/crmevil", "/login", [" /crm"], null]) {
    assert.equal(safeReturnTo(value), "/crm");
  }
});

test("authenticate rejects unknown/inactive/wrong credentials; DTO never includes a hash", async (t) => {
  setup(t); allowAttempts(t);
  const passwordHash = await hashPassword("correct-test-password");
  let document: object | null = { ...account, passwordHash };
  mockAccount(t, () => document);
  const input = { email: " TEST@example.com ", password: "correct-test-password" };
  const user = await authenticate(input);
  assert.equal(user?.id, id);
  assert.equal("passwordHash" in user!, false);
  assert.equal(await authenticate({ ...input, password: "wrong" }), null);
  document = { ...account, passwordHash, active: false };
  assert.equal(await authenticate(input), null);
  document = null;
  assert.equal(await authenticate(input), null);
});

test("login attempts are throttled before password lookup", async (t) => {
  setup(t); allowAttempts(t, 11);
  const find = mockAccount(t, () => account);
  await assert.rejects(authenticate({ email: "test@example.com", password: "anything" }), LoginRateLimitError);
  assert.equal(find.mock.callCount(), 0);
});

test("login writes an httpOnly session and logout expires it", async (t) => {
  setup(t); allowAttempts(t);
  const jar = cookieJar(t);
  mockAccount(t, () => ({ ...account, passwordHash }));
  const passwordHash = await hashPassword("correct-test-password");
  assert.equal(await login({ email: account.email, password: "wrong" }), false);
  assert.equal(jar.writes.length, 0);
  assert.equal(await login({ email: account.email, password: "correct-test-password" }), true);
  assert.deepEqual(await verifySession(jar.values.get(SESSION_COOKIE)), { userId: id });
  assert.equal(jar.writes[0].options.httpOnly, true);
  assert.equal(jar.writes[0].options.sameSite, "lax");
  assert.equal(jar.writes[0].options.maxAge, SESSION_SECONDS);
  await logout();
  assert.equal(jar.writes[1].options.maxAge, 0);
  assert.equal(await getCurrentUser(), null);
  const previous = process.env.NODE_ENV;
  Object.assign(process.env, { NODE_ENV: "production" });
  try { assert.equal(sessionCookieOptions().secure, true); }
  finally { if (previous === undefined) Reflect.deleteProperty(process.env, "NODE_ENV"); else Object.assign(process.env, { NODE_ENV: previous }); }
});

test("guards reread roles and active state, and protect service calls independently", async (t) => {
  setup(t);
  const jar = cookieJar(t, await signSession(id));
  let document: typeof account | null = { ...account };
  mockAccount(t, () => document?.active ? document : null);
  const list = t.mock.method(UserModel, "find", () => ({ sort: () => ({ lean: () => ({ exec: async () => [account] }) }) }));
  assert.equal((await listTeam())[0].id, id);
  assert.equal((await requireRole("owner")).role, "owner");
  document = { ...account, role: "salesperson" };
  await assert.rejects(listTeam(), (error) => error instanceof AuthorizationError && error.status === 403);
  assert.equal(list.mock.callCount(), 1);
  assert.equal((await requireRole("salesperson")).role, "salesperson");
  document.active = false;
  assert.equal(await getCurrentUser(), null);
  await assert.rejects(requireRole("owner"), (error) => error instanceof AuthorizationError && error.status === 401);
  document = null;
  assert.equal(await getCurrentUser(), null);
  jar.values.delete(SESSION_COOKIE);
  await assert.rejects(listTeam(), (error) => error instanceof AuthorizationError && error.status === 401);
});

test("user model validates roles, normalizes email, hides hashes and bootstrap preserves accounts", async (t) => {
  setup(t);
  assert.equal(UserModel.schema.path("passwordHash").options.select, false);
  assert.ok(UserModel.schema.indexes().some(([fields, options]) => fields.email === 1 && options.unique));
  const model = new UserModel({ ...account, email: " TEST@EXAMPLE.COM ", passwordHash: "hash", role: "admin" });
  assert.equal(model.email, "test@example.com");
  await assert.rejects(model.validate());
  t.mock.method(UserModel, "init", async () => UserModel);
  const write = t.mock.method(UserModel, "updateOne", () => ({ exec: async () => ({}) }));
  mockAccount(t, () => account);
  const passwordHash = await hashPassword("correct-test-password");
  await initializeUser({ name: "Replacement", email: account.email, passwordHash, role: "salesperson", dealershipId: null, active: true });
  const update = write.mock.calls[0].arguments[1] as Record<string, unknown>;
  assert.deepEqual(Object.keys(update), ["$setOnInsert"]);
  assert.equal(await findActiveUser("invalid-id"), null);
});

test("proxy redirects missing/invalid sessions and lets signed sessions reach service guards", async (t) => {
  setup(t);
  const denied = await proxy(new NextRequest("http://localhost:3000/crm/team?view=active"));
  assert.equal(denied.status, 307);
  assert.equal(new URL(denied.headers.get("location")!).searchParams.get("returnTo"), "/crm/team?view=active");
  const valid = await proxy(new NextRequest("http://localhost:3000/crm", { headers: { cookie: SESSION_COOKIE + "=" + await signSession(id) } }));
  assert.equal(valid.headers.get("x-middleware-next"), "1");
});
