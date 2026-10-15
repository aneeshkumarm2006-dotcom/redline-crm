import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { userIdSchema } from "@/modules/users/schema";

export const SESSION_COOKIE = "redline_session";
export const SESSION_SECONDS = 60 * 60 * 8;
const ISSUER = "redline-crm";
const AUDIENCE = "redline-staff";

function signingKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || new TextEncoder().encode(secret).length < 32) {
    throw new Error("AUTH_SECRET must contain at least 32 bytes.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(userId: string) {
  return new SignJWT({}).setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userIdSchema.parse(userId)).setIssuer(ISSUER).setAudience(AUDIENCE)
    .setIssuedAt().setExpirationTime(SESSION_SECONDS + "s").sign(signingKey());
}

export async function verifySession(token: string | undefined): Promise<{ userId: string } | null> {
  if (!token) return null;
  const key = signingKey();
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"], issuer: ISSUER, audience: AUDIENCE,
      requiredClaims: ["sub", "iat", "exp"], maxTokenAge: SESSION_SECONDS,
    });
    const id = userIdSchema.safeParse(payload.sub);
    return id.success ? { userId: id.data } : null;
  } catch { return null; }
}

export function sessionCookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: SESSION_SECONDS };
}
