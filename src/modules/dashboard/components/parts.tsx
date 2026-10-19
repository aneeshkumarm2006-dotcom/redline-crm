import Link from "next/link";
import { CarFront, ChevronRight, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/shared/avatar";
import { formatValue } from "@/components/shared/charts/format";
import { formatTimestamp } from "@/modules/inventory/copy";
import type { Dealership } from "@/modules/dealerships/schema";
import type { LeaderboardRow } from "@/modules/sales/service";
import { getStaffNames } from "@/modules/users/service";
import type { DashboardActivity } from "../service";
import { dashboardCopy as copy } from "../copy";

/** Board URL with only the filters that are set, so every tile and segment opens exactly what it counts. */
export function boardHref(path: string, params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams(Object.entries(params).flatMap(([key, value]) => value === undefined || value === "" ? [] : [[key, String(value)]]));
  return query.size ? `${path}?${query}` : path;
}

export function SectionHeading({ id, title, hint, action }: { id: string; title: string; hint?: string; action?: React.ReactNode }) {
  return <div className="flex min-h-10 items-end justify-between gap-3">
    <div className="min-w-0"><h2 id={id} className="text-lg font-semibold tracking-tight">{title}</h2>{hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}</div>
    {action}
  </div>;
}

export const textLink = "inline-flex min-h-10 shrink-0 items-center text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring";

/** "All locations" plus one chip per location, kept in the query string; scrolls sideways on a phone. */
export function LocationFilter({ dealerships, current }: { dealerships: Dealership[]; current?: string }) {
  const chip = (active: boolean) => cn("inline-flex min-h-9 shrink-0 items-center rounded-lg px-3.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    active ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground");
  return <nav aria-label={copy.locationFilter} className="scrollbar-thin flex w-full gap-1 overflow-x-auto rounded-xl bg-muted p-1 sm:w-fit">
    <Link href="/crm" scroll={false} aria-current={!current ? "page" : undefined} className={chip(!current)}>{copy.allLocations}</Link>
    {dealerships.map((entry) => <Link key={entry.id} href={boardHref("/crm", { dealershipId: entry.id })} scroll={false} aria-current={current === entry.id ? "page" : undefined}
      className={chip(current === entry.id)}>{entry.name}</Link>)}
  </nav>;
}

type Status = { key: string; label: string; color: string };
/**
 * One stacked bar per location (part-to-whole by status) with a labelled count per status underneath.
 * Plain HTML so long location names wrap at 375px; every count opens the board filtered to that location and status.
 */
export function StockByLocation({ rows, statuses }: { rows: { dealership: Dealership; counts: Record<string, number> }[]; statuses: Status[] }) {
  return <ul className="space-y-5">{rows.map(({ dealership, counts }) => {
    const total = statuses.reduce((sum, status) => sum + (counts[status.key] ?? 0), 0);
    const href = (status?: string) => boardHref("/crm/inventory", { dealershipId: dealership.id, status });
    return <li key={dealership.id}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <Link href={href()} className="min-w-0 break-words font-medium hover:underline focus-visible:outline-2 focus-visible:outline-ring">{dealership.name}</Link>
        <span className="shrink-0 tabular-nums text-muted-foreground">{copy.locationTotal(total)}</span>
      </div>
      <div className="mt-2.5 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted">
        {total > 0 && statuses.filter((status) => counts[status.key]).map((status) => <Link key={status.key} href={href(status.key)} aria-hidden tabIndex={-1}
          className="block h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${((counts[status.key] ?? 0) / total) * 100}%`, backgroundColor: status.color }} />)}
      </div>
      <ul className="mt-1.5 flex flex-wrap gap-x-4">{statuses.map((status) => <li key={status.key}>
        <Link href={href(status.key)} aria-label={copy.segment(status.label, counts[status.key] ?? 0, dealership.name)}
          className="inline-flex min-h-9 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
          <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: status.color }} />{status.label}
          <span className="font-semibold tabular-nums text-foreground">{counts[status.key] ?? 0}</span>
        </Link>
      </li>)}</ul>
    </li>;
  })}</ul>;
}

/** This month's ranking: units against target, commission, and a link to each profile. */
export function Leaderboard({ rows, locationName }: { rows: LeaderboardRow[]; locationName?: (id: string | null) => string }) {
  if (!rows.length) return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{copy.noSalespeople}</p>;
  return <ol className="-mx-2">{rows.map((row, index) => {
    const target = row.user.monthlyTarget;
    return <li key={row.user.id}>
      <Link href={`/crm/team/${row.user.id}`} className="flex min-h-16 items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring">
        <span className={cn("w-5 shrink-0 text-center text-sm font-semibold tabular-nums", index === 0 && row.units > 0 ? "text-primary" : "text-muted-foreground")}>{index + 1}</span>
        <Avatar name={row.user.name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{row.user.name}</span>
          {target ? <span aria-hidden className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
            <span className={cn("block h-full rounded-full", row.units >= target ? "bg-success" : "bg-primary")} style={{ width: `${Math.min(100, (row.units / target) * 100)}%` }} />
          </span> : null}
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{[copy.progress(row.units, target), locationName?.(row.user.dealershipId)].filter(Boolean).join(" · ")}</span>
        </span>
        <span className="shrink-0 text-right text-sm font-semibold tabular-nums">{formatValue(row.commission, "money")}</span>
      </Link>
    </li>;
  })}</ol>;
}

/** Newest lead and vehicle activity with who did it; each row opens the lead or car. */
export async function ActivityList({ activity, timeZone }: { activity: DashboardActivity[]; timeZone: string }) {
  if (!activity.length) return <p className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">{copy.noActivity}</p>;
  const names = await getStaffNames([...new Set(activity.flatMap((entry) => entry.actorId ? [entry.actorId] : []))]);
  const actor = (entry: DashboardActivity) => entry.actorId ? names.find((item) => item.id === entry.actorId)?.name ?? copy.formerStaff
    : entry.type === "lead.assigned" ? copy.automatic : copy.customer;
  return <ol className="divide-y overflow-clip rounded-2xl border bg-card shadow-xs">{activity.map((entry, index) => <li key={`${entry.href}-${entry.occurredAt}-${index}`}>
    <Link href={entry.href} className="group flex min-h-16 items-center gap-3.5 p-4 transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">{entry.kind === "vehicle" ? <CarFront aria-hidden className="size-5 text-muted-foreground" /> : <UserPlus aria-hidden className="size-5 text-muted-foreground" />}</span>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-sm font-medium">{entry.subject}</span>
        <span className="block break-words text-sm">{entry.message}</span>
        <span className="block text-xs text-muted-foreground">{actor(entry)} · {formatTimestamp(entry.occurredAt, timeZone)}</span>
      </span>
      <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  </li>)}</ol>;
}
