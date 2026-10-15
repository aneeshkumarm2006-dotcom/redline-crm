import "server-only";

/** Only deployment configuration can supply the origin of email links. */
export function emailUrl(path: string) {
  const base = new URL(process.env.APP_URL ?? "");
  if (!/^https?:$/.test(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== "/") {
    throw new Error("APP_URL must be an HTTP(S) origin without credentials, path, query or fragment.");
  }
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Invalid email link.");
  return new URL(path, base).href;
}
