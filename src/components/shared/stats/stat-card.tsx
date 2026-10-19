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
    <span className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
      <span className="flex min-w-0 items-center gap-1.5">
        {color && <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
        <span className="truncate">{label}</span>
      </span>
      {Icon && <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
    </span>
    <span className="mt-2 block truncate text-2xl font-semibold tracking-tight tabular-nums sm:text-[1.75rem]">{display}</span>
    {(delta || hint) && <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
      {delta && <span className={cn("inline-flex items-center gap-0.5 font-medium", delta.direction === "flat" ? "text-muted-foreground" : delta.good ? "text-success" : "text-danger")}>
        <DeltaIcon aria-hidden className="size-3.5" />{delta.label}{delta.period && <span className="font-normal text-muted-foreground">&nbsp;{delta.period}</span>}
      </span>}
      {hint && <span className="truncate">{hint}</span>}
    </span>}
  </>;
  const classes = cn("block min-w-0 rounded-xl border bg-card p-4 shadow-xs", className);
  return href
    ? <Link href={href} className={cn(classes, "transition-colors hover:border-foreground/20 hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring")}>{body}</Link>
    : <div className={classes}>{body}</div>;
}

/** Responsive KPI row: two per row on phones, widening with the screen. */
export function KpiRow({ children, className, label }: { children: React.ReactNode; className?: string; label?: string }) {
  return <section aria-label={label} className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4", className)}>{children}</section>;
}
