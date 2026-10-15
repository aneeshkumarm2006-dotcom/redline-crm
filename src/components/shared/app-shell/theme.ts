import type { CSSProperties } from "react";

/** Settings validate six-digit hex. Pick readable text for any configured colour. */
export function brandTheme(primaryColor: string): CSSProperties {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(primaryColor.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  const foreground = luminance > 0.179 ? "#000000" : "#ffffff";
  return {
    "--primary": primaryColor,
    "--primary-foreground": foreground,
    "--ring": primaryColor,
    "--sidebar-primary": primaryColor,
    "--sidebar-primary-foreground": foreground,
    "--sidebar-ring": primaryColor,
  } as CSSProperties;
}
