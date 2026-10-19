import { cn } from "@/lib/utils";
import { formatValue, themeSeriesColor, type ValueFormat } from "./format";
import type { ChartDatum, ChartSeries } from "./types";

export const seriesColor = (series: ChartSeries, index: number) => series.color ?? themeSeriesColor(index);

/** Card frame shared by every chart: title, optional description and action, then the plot. */
export function ChartCard({ title, description, action, children, className }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={cn("min-w-0 rounded-2xl border bg-card p-5 shadow-xs sm:p-6", className)}>
    <header className="mb-5 flex items-start justify-between gap-3">
      <div className="min-w-0"><h2 className="text-[0.9375rem] font-semibold tracking-tight">{title}</h2>{description && <p className="mt-1 text-[0.8125rem] text-muted-foreground">{description}</p>}</div>
      {action}
    </header>
    {children}
  </section>;
}

/** Identity never relies on colour alone: a swatch plus readable text for each series. */
export function ChartLegend({ items }: { items: { key: string; label: string; color: string }[] }) {
  if (items.length < 2) return null;
  return <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
    {items.map((item) => <li key={item.key} className="flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-sm" style={{ backgroundColor: item.color }} />{item.label}</li>)}
  </ul>;
}

/** Screen-reader table view of the plotted values. */
export function ChartTable({ title, data, series, format }: { title: string; data: ChartDatum[]; series: ChartSeries[]; format?: ValueFormat }) {
  return <table className="sr-only">
    <caption>{title}</caption>
    <thead><tr><th scope="col" />{series.map((item) => <th key={item.key} scope="col">{item.label}</th>)}</tr></thead>
    <tbody>{data.map((datum) => <tr key={datum.label}><th scope="row">{datum.label}</th>{series.map((item) => <td key={item.key}>{formatValue(datum.values[item.key] ?? 0, format)}</td>)}</tr>)}</tbody>
  </table>;
}
