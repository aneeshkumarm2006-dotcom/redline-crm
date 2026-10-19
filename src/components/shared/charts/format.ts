/** Serializable value formats, so server screens can pick one for client charts. */
export type ValueFormat = "number" | "money" | "percent";

export function formatValue(value: number, format: ValueFormat = "number", compact = false) {
  const notation = compact && Math.abs(value) >= 10_000 ? "compact" : "standard";
  if (format === "money") {
    return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", notation, maximumFractionDigits: notation === "compact" ? 1 : 0 }).format(value);
  }
  if (format === "percent") return new Intl.NumberFormat("en-CA", { style: "percent", maximumFractionDigits: 0 }).format(value);
  return new Intl.NumberFormat("en-CA", { notation, maximumFractionDigits: notation === "compact" ? 1 : 0 }).format(value);
}

/** Categorical theme colours in their fixed, validated order; never cycled past eight. */
export const themeSeriesColor = (index: number) => `var(--chart-${Math.min(index, 7) + 1})`;
