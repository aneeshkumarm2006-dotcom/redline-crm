import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatValue, type ValueFormat } from "../charts/format";

export type StatDelta = {
  /** Already formatted, signed text such as "+3" or "−12%". */
  label: string;
  direction: "up" | "down" | "flat";
  /** Whether this direction is good news; drives the colour. */
  good: boolean;
  /** The comparison period, e.g. "vs last month". */
  period?: string;
};

export type StatCardProps = {
  label: string;
  value: number | string;
  format?: ValueFormat;
  href?: string;
  icon?: LucideIcon;
  hint?: string;
  delta?: StatDelta;
  /** Small coloured dot before the label (e.g. a settings status colour). */
  color?: string;
  className?: string;
};

/** One KPI: label, auto-compacted value, optional delta and hint. Links to its filtered board when `href` is set. */
export function StatCard({ label, value, format = "number", href, icon: Icon, hint, delta, color, className }: StatCardProps) {
  const display = typeof value === "number" ? formatValue(value, format, true) : value;
  const DeltaIcon = delta?.direction === "up" ? ArrowUpRight : delta?.direction === "down" ? ArrowDownRight : ArrowRight;
  const body = <>
    <span className="flex items-start justify-between gap-3">
      <span className="flex min-w-0 items-center gap-2 pt-1 text-[0.8125rem] font-medium text-muted-foreground">
        {color && <span aria-hidden className="size-2.5 shrink-0 rounded-full ring-4" style={{ backgroundColor: color, "--tw-ring-color": `color-mix(in oklab, ${color} 18%, transparent)` } as React.CSSProperties} />}
        <span className="line-clamp-2 sm:truncate">{label}</span>
      </span>
      {Icon && <span aria-hidden className="hidden size-9 shrink-0 sm:flex items-center justify-center rounded-xl bg-muted text-foreground/70 transition-colors group-hover/stat:bg-brand-soft group-hover/stat:text-primary"><Icon className="size-[1.125rem]" /></span>}
    </span>
    <span className="font-display mt-3 block truncate text-[1.75rem] leading-none font-semibold tabular-nums sm:text-[2rem]">{display}</span>
    {(delta || hint) && <span className="mt-2.5 flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
      {delta && <span className={cn("inline-flex items-center gap-0.5 font-medium", delta.direction === "flat" ? "text-muted-foreground" : delta.good ? "text-success" : "text-danger")}>
        <DeltaIcon aria-hidden className="size-3.5" />{delta.label}{delta.period && <span className="font-normal text-muted-foreground">&nbsp;{delta.period}</span>}
      </span>}
      {hint && <span className="truncate">{hint}</span>}
    </span>}
  </>;
  const classes = cn("group/stat block min-w-0 rounded-2xl border bg-card p-5 shadow-xs", className);
  return href
    ? <Link href={href} className={cn(classes, "transition-[border-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring")}>{body}</Link>
    : <div className={classes}>{body}</div>;
}

/** Responsive KPI row: two per row on phones, widening with the screen. */
export function KpiRow({ children, className, label }: { children: React.ReactNode; className?: string; label?: string }) {
  return <section aria-label={label} className={cn("grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 2xl:grid-cols-6", className)}>{children}</section>;
}
