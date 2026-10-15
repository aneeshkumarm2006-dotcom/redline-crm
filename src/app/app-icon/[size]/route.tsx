import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { brandTheme } from "@/components/shared/app-shell/theme";
import { getSettings } from "@/modules/settings/service";
import { appIconSizes } from "./sizes";

/**
 * Brand-coloured CarFront badge, matching the in-app logo fallback. Full-bleed background with the glyph
 * inside the maskable safe zone, so one image serves both "any" and "maskable" purposes.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size);
  if (!appIconSizes.includes(size as (typeof appIconSizes)[number])) return new Response(null, { status: 404 });
  await connection();
  const color = await getSettings().then((settings) => settings.brand.primaryColor).catch(() => "#111111");
  const foreground = String((brandTheme(color) as Record<string, string>)["--primary-foreground"]);
  const glyph = Math.round(size * 0.56);
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: color }}>
      <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none" stroke={foreground} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8" />
        <path d="M7 14h.01" /><path d="M17 14h.01" />
        <rect width="18" height="8" x="3" y="10" rx="2" />
        <path d="M5 18v2" /><path d="M19 18v2" />
      </svg>
    </div>,
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
