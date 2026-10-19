import type { CSSProperties } from "react";
import { readableForeground, withAlpha } from "@/lib/color";

/** Settings validate six-digit hex. Pick readable text for any configured colour. */
export function brandTheme(primaryColor: string): CSSProperties {
  const foreground = readableForeground(primaryColor);
  return {
    "--primary": primaryColor,
    "--primary-foreground": foreground,
    "--ring": primaryColor,
    "--brand-soft": withAlpha(primaryColor, 0.1),
    "--sidebar-primary": primaryColor,
    "--sidebar-primary-foreground": foreground,
    "--sidebar-ring": primaryColor,
  } as CSSProperties;
}
