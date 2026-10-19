/** Colour helpers shared by the shell, pills and avatars. Settings validate six-digit hex. */

function channels(hex: string) {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}

/** WCAG relative luminance of a `#rrggbb` colour. */
export function luminance(hex: string) {
  const [r, g, b] = channels(hex).map((value) => {
    const unit = value / 255;
    return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
  });
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

/** Black or white text, whichever reads better on the given fill. */
export function readableForeground(hex: string) {
  return luminance(hex) > 0.179 ? "#0B1220" : "#ffffff";
}

/** The colour with an alpha channel, for soft tints of settings colours. */
export function withAlpha(hex: string, alpha: number) {
  const [r, g, b] = channels(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Mid-tone hues that all carry white initials at 4.5:1 or better.
const avatarPalette = ["#2F5BEA", "#7C5CFC", "#D9487E", "#C2410C", "#0B875E", "#14A38B", "#1E40C0", "#6D4AE8", "#B4234A", "#0E7490", "#4B5568", "#9A3412"];

/** A stable colour derived from a name, so the same person always looks the same. */
export function colorFromName(name: string) {
  let hash = 0;
  for (const character of name.trim().toLowerCase()) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return avatarPalette[hash % avatarPalette.length];
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}
