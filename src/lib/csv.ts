/** CSV for spreadsheets: quoted where needed, formulas neutralised in text cells, CRLF lines and a UTF-8 BOM. */
export function csvCell(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  // Neutralise spreadsheet formulas in text cells.
  const safe = typeof value === "string" && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}
export const csvRow = (cells: readonly (string | number | null | undefined)[]) => cells.map(csvCell).join(",");
export const csvDocument = (rows: readonly (readonly (string | number | null | undefined)[])[]) => `﻿${rows.map(csvRow).join("\r\n")}\r\n`;
