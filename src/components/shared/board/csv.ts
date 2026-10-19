import { csvDocument } from "@/lib/csv";
import { resolvePill } from "../status-pill";
import { boardCopy as copy } from "./copy";
import { formatNumber } from "./format";
import type { BoardCellValues, BoardColumn, BoardGroup } from "./types";

/** Spreadsheet value of one cell: labels instead of keys, plain numbers for money and counts. */
function cellText(column: BoardColumn, value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  switch (column.cell) {
    case "status": return resolvePill(column.options, value as BoardCellValues["status"])?.label ?? String(value);
    case "person": return (value as NonNullable<BoardCellValues["person"]>).name;
    case "label": case "link": return (value as { text: string }).text;
    case "date": return new Intl.DateTimeFormat("en-CA", { dateStyle: "short", timeZone: column.timeZone ?? "UTC" }).format(new Date(value as string));
    case "number": return column.format === "percent" ? formatNumber(value as number, "percent") : value as number;
    case "progress": { const progress = value as NonNullable<BoardCellValues["progress"]>; return progress.label ?? copy.progress(progress.value, progress.max); }
    default: return value as number;
  }
}

/** The whole board as CSV: a Group column, then every column in board order, one row per item. */
export function boardCsv(columns: BoardColumn[], groups: BoardGroup[]) {
  return csvDocument([
    [copy.group, ...columns.map((column) => column.header)],
    ...groups.flatMap((group) => group.items.map((item) => [group.title, ...columns.map((column) => cellText(column, item.values[column.id]))])),
  ]);
}
