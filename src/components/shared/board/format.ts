import type { BoardCellType } from "./types";

export const defaultWidths: Record<BoardCellType, number> = {
  link: 300, status: 140, person: 180, date: 124, days: 104, money: 124, label: 148, progress: 168, number: 104,
};

export const formatMoney = (value: number, currency = "CAD") =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);

export const formatNumber = (value: number, format: "number" | "percent" = "number") =>
  format === "percent" ? `${Math.round(value * 100)}%` : new Intl.NumberFormat("en-CA", { maximumFractionDigits: 1 }).format(value);

export const formatBoardDate = (value: string, timeZone = "UTC") =>
  new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone }).format(new Date(value));

export type AgingLevel = "ok" | "warn" | "critical";
export function agingLevel(days: number, warnDays?: number, criticalDays?: number): AgingLevel {
  if (criticalDays !== undefined && days >= criticalDays) return "critical";
  if (warnDays !== undefined && days >= warnDays) return "warn";
  return "ok";
}

export const alignClass = (align: "start" | "center" | "end" | undefined, cell: BoardCellType) => {
  const resolved = align ?? (cell === "money" || cell === "days" || cell === "number" ? "end" : cell === "status" ? "center" : "start");
  return resolved === "end" ? "text-right justify-end" : resolved === "center" ? "text-center justify-center" : "text-left justify-start";
};
