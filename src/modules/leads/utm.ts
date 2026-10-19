/**
 * Browser-only campaign tracking for public inquiries. The `utm_source` a visitor lands with is kept for the tab
 * (sessionStorage), so it survives browsing from the inventory grid to a vehicle page. Storage can be blocked
 * (private mode, embeds), so every access is guarded and tracking simply turns off.
 */
const KEY = "redline.utm_source";
const clean = (value: string | null) => value?.trim().slice(0, 120) || null;

/** Remembers the `utm_source` in the current URL, if any, and returns the one in effect for this tab. */
export function rememberUtmSource(): string | null {
  if (typeof window === "undefined") return null;
  const fromUrl = clean(new URLSearchParams(window.location.search).get("utm_source"));
  try {
    if (fromUrl) window.sessionStorage.setItem(KEY, fromUrl);
    return fromUrl ?? clean(window.sessionStorage.getItem(KEY));
  } catch { return fromUrl; }
}
