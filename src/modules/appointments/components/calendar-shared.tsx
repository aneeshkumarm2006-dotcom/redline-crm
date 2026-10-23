import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownField } from "@/components/ui/dropdown-field";
import { weekdays, type Settings } from "@/modules/settings/schema";
import { listAppointmentsBetween } from "../service";
import { addDays, localDate, weekday, zonedTimeToUtc } from "../slots";
import { appointmentsCopy as copy } from "../copy";
import { describeAppointments } from "./appointments-screen";
import { DateJump } from "./calendar-keys";
import { legendStatuses, statusTone } from "./calendar-tone";

export const calendarViews = ["month", "week", "day", "list"] as const;
export type CalendarView = (typeof calendarViews)[number];
export type CalendarQuery = { date?: string; dealershipId?: string; salespersonId?: string; all?: string };
type Option = { id: string; name: string };
/** Everything a calendar view needs; filters are re-validated against the lists (owners only). */
export type CalendarContext = {
  query: CalendarQuery; settings: Settings; now: number; owner: boolean; self: Option;
  dealerships: Option[]; salespeople: (Option & { dealershipId: string | null; active: boolean })[];
};

export const iso = (instant: number) => new Date(instant).toISOString();

/** Calendar URL for a view with these filters. Week is the default view, so it is left out of the URL. */
export function calendarHref(query: CalendarQuery, view: CalendarView = "week") {
  const search = new URLSearchParams(view === "week" ? [] : [["view", view]]);
  for (const [key, value] of Object.entries(query)) if (value) search.set(key, value);
  return search.size ? `/crm/calendar?${search}` : "/crm/calendar";
}

export const parseDate = (value: string | undefined, fallback: string) =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : fallback;

/** Same day `months` later, clamped to the month's length (Jan 31 + 1 → Feb 28). */
export function addMonths(date: string, months: number) {
  const [year, month, day] = date.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1 + months, 1));
  const length = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(day, length))).toISOString().slice(0, 10);
}
export const mondayOf = (date: string) => addDays(date, -weekdays.indexOf(weekday(date)));
/** Six Monday-first weeks covering the month of `date`. */
export function monthGrid(date: string) {
  const first = `${date.slice(0, 8)}01`;
  const start = mondayOf(first);
  return { first, days: Array.from({ length: 42 }, (_, index) => addDays(start, index)) };
}

/** Validated filters: owners may narrow by location and salesperson; anyone may include cancelled and no-show visits. */
export function calendarFilters({ query, owner, dealerships, salespeople }: CalendarContext) {
  return {
    dealershipId: owner && dealerships.some((entry) => entry.id === query.dealershipId) ? query.dealershipId : undefined,
    salespersonId: owner && salespeople.some((entry) => entry.id === query.salespersonId) ? query.salespersonId : undefined,
    all: query.all === "1" ? "1" : undefined,
  };
}

/** Described appointments starting on local dates [from, to) in the dealership zone, with the calendar's filters applied. */
export async function loadCalendarAppointments(context: CalendarContext, from: string, to: string) {
  const zone = context.settings.booking.timeZone;
  const filters = calendarFilters(context);
  const all = await listAppointmentsBetween(iso(zonedTimeToUtc(from, "00:00", zone)), iso(zonedTimeToUtc(to, "00:00", zone)), filters.salespersonId,
    filters.all ? legendStatuses : ["booked", "completed"]);
  return describeAppointments(all.filter((entry) => !filters.dealershipId || entry.dealershipId === filters.dealershipId));
}

/** Period navigation shared by the month, week and day views: previous / title / next, Today, a date jump and counters. */
export function CalendarToolbar({ id, title, prev, next, prevLabel, nextLabel, today, todayLabel, date, base, children }: {
  id: string; title: string; prev: string; next: string; prevLabel: string; nextLabel: string; today?: string; todayLabel: string;
  date: string; base: string; children?: React.ReactNode;
}) {
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-2 shadow-xs sm:p-2.5">
    <nav aria-label={title} className="flex min-w-0 flex-wrap items-center gap-1">
      <Button asChild variant="ghost" size="icon" className="size-11 rounded-xl"><Link href={prev} aria-label={prevLabel}><ChevronLeft aria-hidden className="size-4" /></Link></Button>
      <h2 id={id} className="font-display min-w-0 px-1.5 text-base font-semibold tabular-nums sm:text-lg">{title}</h2>
      <Button asChild variant="ghost" size="icon" className="size-11 rounded-xl"><Link href={next} aria-label={nextLabel}><ChevronRight aria-hidden className="size-4" /></Link></Button>
      {today && <Button asChild variant="outline" className="ml-1 min-h-11 rounded-xl"><Link href={today}>{todayLabel}</Link></Button>}
      <span className="ml-1"><DateJump date={date} base={base} /></span>
    </nav>
    {children && <div className="flex flex-wrap items-center gap-2 text-sm font-medium tabular-nums text-muted-foreground">{children}</div>}
  </div>;
}

/**
 * Side rail: a mini month (dots on days with visits) for jumping around, the filters and the status key.
 * The mini month and key only show on wide screens; filters stay on top on smaller ones.
 */
export async function CalendarRail({ context, view, date }: { context: CalendarContext; view: Exclude<CalendarView, "list">; date: string }) {
  const { owner, dealerships, salespeople, now, settings } = context;
  const zone = settings.booking.timeZone;
  const today = localDate(now, zone);
  const filters = calendarFilters(context);
  const grid = monthGrid(date);
  const busy = new Map<string, number>();
  for (const entry of await loadCalendarAppointments(context, grid.days[0], addDays(grid.days[41], 1))) {
    const day = localDate(Date.parse(entry.startsAt), zone);
    busy.set(day, (busy.get(day) ?? 0) + 1);
  }
  const month = new Intl.DateTimeFormat("en-CA", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${grid.first}T12:00:00Z`));
  const long = new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  const target = view === "month" ? "day" : view;
  const people = filters.dealershipId ? salespeople.filter((entry) => entry.dealershipId === filters.dealershipId || entry.id === filters.salespersonId) : salespeople;
  const inWeek = (day: string) => view === "week" && mondayOf(day) === mondayOf(date);

  return <aside className="min-w-0 space-y-4">
    <section aria-label={copy.miniMonth} className="hidden rounded-2xl border bg-card p-3 shadow-xs xl:block">
      <div className="flex items-center justify-between gap-1 pb-2">
        <Button asChild variant="ghost" size="icon" className="size-9 rounded-lg"><Link href={calendarHref({ ...filters, date: addMonths(date, -1) }, view)} aria-label={copy.previousMonth}><ChevronLeft aria-hidden className="size-4" /></Link></Button>
        <p className="text-sm font-semibold">{month}</p>
        <Button asChild variant="ghost" size="icon" className="size-9 rounded-lg"><Link href={calendarHref({ ...filters, date: addMonths(date, 1) }, view)} aria-label={copy.nextMonth}><ChevronRight aria-hidden className="size-4" /></Link></Button>
      </div>
      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {weekdays.map((name) => <span key={name} aria-hidden className="pb-1 text-[0.6875rem] font-semibold uppercase text-muted-foreground">{name.slice(0, 2)}</span>)}
        {grid.days.map((day) => {
          const count = busy.get(day) ?? 0;
          const selected = view === "day" ? day === date : inWeek(day);
          return <Link key={day} href={calendarHref({ ...filters, date: day }, target)} aria-label={`${long.format(new Date(`${day}T12:00:00Z`))}${count ? `, ${copy.visits(count)}` : ""}`}
            aria-current={day === date ? "date" : undefined}
            className={cn("relative mx-auto flex size-8 flex-col items-center justify-center rounded-lg text-xs tabular-nums transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
              day.slice(0, 7) !== grid.first.slice(0, 7) && "text-muted-foreground/60", selected && "bg-muted font-semibold",
              day === today && "bg-primary font-semibold text-primary-foreground hover:bg-primary/90")}>
            {Number(day.slice(8))}
            {count > 0 && <span aria-hidden className={cn("absolute bottom-1 size-1 rounded-full", day === today ? "bg-primary-foreground" : "bg-primary")} />}
          </Link>;
        })}
      </div>
    </section>

    <form action="/crm/calendar" aria-label={copy.filters} className="grid gap-3 rounded-2xl border bg-card p-4 shadow-xs sm:grid-cols-[1fr_1fr_auto] xl:grid-cols-1">
      {view !== "week" && <input type="hidden" name="view" value={view} />}
      <input type="hidden" name="date" value={date} />
      {owner && <>
        <label className="min-w-0 space-y-2"><span className="text-sm font-medium">{copy.location}</span>
          <DropdownField name="dealershipId" defaultValue={filters.dealershipId ?? ""} options={[{ value: "", label: copy.allLocations }, ...dealerships.map((entry) => ({ value: entry.id, label: entry.name }))]} /></label>
        <label className="min-w-0 space-y-2"><span className="text-sm font-medium">{copy.salesperson}</span>
          <DropdownField name="salespersonId" defaultValue={filters.salespersonId ?? ""} options={[{ value: "", label: copy.allSalespeople }, ...people.map((entry) => ({ value: entry.id, label: entry.name }))]} /></label>
      </>}
      <label className={cn("flex min-h-11 items-center gap-2.5 text-sm", owner && "sm:col-span-2 xl:col-span-1")}>
        <input type="checkbox" name="all" value="1" defaultChecked={Boolean(filters.all)} className="size-4 accent-primary" />{copy.showAll}</label>
      <Button type="submit" variant="outline" className={cn("min-h-11", owner ? "sm:col-start-3 sm:row-start-1 sm:self-end xl:col-start-auto xl:row-start-auto" : "sm:col-start-3")}>{copy.apply}</Button>
    </form>

    <section aria-label={copy.legend} className="hidden space-y-2 rounded-2xl border bg-card p-4 shadow-xs xl:block">
      <p className="eyebrow">{copy.legend}</p>
      <ul className="grid grid-cols-2 gap-2 text-xs">{legendStatuses.map((status) => <li key={status} className="flex items-center gap-2">
        <span aria-hidden className={cn("size-2.5 rounded-full", statusTone(status).dot)} />{copy.status[status]}</li>)}</ul>
      <p className="pt-1 text-xs text-muted-foreground">{copy.shortcuts}</p>
    </section>
  </aside>;
}
