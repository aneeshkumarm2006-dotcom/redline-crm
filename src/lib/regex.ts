/** Escape user text for a literal, case-insensitive MongoDB `$regex` match. */
export const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
