import "server-only";

/**
 * Current time for server components. Staff screens render once per request (after reading the session),
 * so "now" is stable for that render; client components must not call this.
 */
export function requestNow() {
  return Date.now();
}
