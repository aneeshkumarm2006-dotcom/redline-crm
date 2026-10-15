import "server-only";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { connectDb } from "@/lib/db";
import { findActiveUser, findCredentials } from "@/modules/users/service";
import type { Role } from "@/modules/users/schema";
import { LoginAttemptModel } from "./model";
import { loginSchema, passwordSchema } from "./schema";
import { SESSION_COOKIE, sessionCookieOptions, signSession, verifySession } from "./session";

export class LoginRateLimitError extends Error {}

/** Internal CLI reset so previous demo login attempts do not lock out seeded staff. */
export async function clearLoginAttemptsForSeed() {
  await connectDb();
  await LoginAttemptModel.deleteMany({}).exec();
}
export class AuthorizationError extends Error {
  constructor(public readonly status: 401 | 403) { super(status === 401 ? "Authentication required." : "Access denied."); }
}
export async function hashPassword(password: string) {
  return bcrypt.hash(passwordSchema.parse(password), 12);
}
export async function verifyPassword(password: string, hash: string) {
  if (!loginSchema.shape.password.safeParse(password).success) return false;
  return bcrypt.compare(password, hash);
}

const WINDOW_MS = 15 * 60 * 1000;
/** Atomic and shared across server instances; email is hashed and old buckets expire. */
async function consumeLoginAttempt(email: string) {
  await connectDb();
  const bucket = Math.floor(Date.now() / WINDOW_MS);
  const id = createHash("sha256").update(email + ":" + bucket).digest("hex");
  let attempt;
  try {
    attempt = await LoginAttemptModel.findOneAndUpdate({ _id: id }, {
      $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 1) * WINDOW_MS) },
    }, { upsert: true, returnDocument: "after" }).lean().exec();
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === 11000)) throw error;
    attempt = await LoginAttemptModel.findOneAndUpdate({ _id: id }, { $inc: { count: 1 } }, { returnDocument: "after" }).lean().exec();
  }
  if (!attempt || attempt.count > 10) throw new LoginRateLimitError();
}
let dummyHash: Promise<string> | undefined;
export async function authenticate(input: unknown) {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return null;
  await consumeLoginAttempt(parsed.data.email);
  const account = await findCredentials(parsed.data.email);
  // Missing and inactive users take the bcrypt path too.
  dummyHash ??= bcrypt.hash(randomBytes(32).toString("hex"), 12);
  const valid = await verifyPassword(parsed.data.password, account?.passwordHash ?? await dummyHash);
  return valid && account?.user.active ? account.user : null;
}
export async function login(input: unknown): Promise<boolean> {
  const user = await authenticate(input);
  if (!user) return false;
  const token = await signSession(user.id);
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());
  return true;
}
export async function logout() {
  (await cookies()).set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0, expires: new Date(0) });
}
export async function getCurrentUser() {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  return session ? findActiveUser(session.userId) : null;
}
/** Service guard: never accept a role/user supplied by the client. */
export async function requireRole(...roles: Role[]) {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError(401);
  if (roles.length && !roles.includes(user.role)) throw new AuthorizationError(403);
  return user;
}
