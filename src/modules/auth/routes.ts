export const CRM_HOME = "/crm";

/** Only return to a canonical staff URL; reject external URLs and encoded path tricks. */
export function safeReturnTo(value: unknown): string {
  if (typeof value !== "string" || /[\\\s\u0000-\u001f]/.test(value)) return CRM_HOME;
  try {
    const url = new URL(value, "https://redline.invalid");
    if (!value.startsWith("/") || url.origin !== "https://redline.invalid") return CRM_HOME;
    if (url.pathname !== "/crm" && !url.pathname.startsWith("/crm/")) return CRM_HOME;
    if (url.pathname.includes("%")) return CRM_HOME;
    return url.pathname + url.search;
  } catch { return CRM_HOME; }
}
