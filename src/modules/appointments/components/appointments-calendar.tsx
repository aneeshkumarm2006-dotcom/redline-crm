import Link from "next/link";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/shared/avatar";
import { weekdays } from "@/modules/settings/schema";
import { addDays, localDate, localMinutes } from "../slots";
import { appointmentsCopy as copy } from "../copy";
import { AppointmentTrigger } from "./appointment-details";
import { CalendarToolbar, calendarFilters, calendarHref, loadCalendarAppointments, mondayOf, parseDate, type CalendarContext } from "./calendar-shared";
import { statusTone } from "./calendar-tone";
import { PX, clock, minutesOf, placeInLanes } from "./time-grid";

/**
 * Week view, Monday to Sunday in the dealership time zone. Wide screens get a time grid (one column per day, visits
 * placed by time, closed hours shaded, a now line); phones get the days stacked as lists. Every visit opens its
 * details sheet. A salesperson only ever sees their own calendar (enforced by the appointments service).
 */
export async function AppointmentsCalendar({ context }: { context: CalendarContext }) {
  const { settings, now, owner } = context;
  const zone = settings.booking.timeZone;
  const primaryColor = settings.brand.primaryColor;
  const today = localDate(now, zone);
  const monday = mondayOf(parseDate(context.query.date, today));
  const days = weekdays.map((name, index) => ({ name, date: addDays(monday, index), hours: settings.booking.businessHours[name] }));
  const appointments = await loadCalendarAppointments(context, monday, addDays(monday, 7));
  const filters = calendarFilters(context);
  const time = new Intl.DateTimeFormat("en-CA", { timeStyle: "short", timeZone: zone });
  const dayLabel = new Intl.DateTimeFormat("en-CA", { weekday: "short", day: "numeric", timeZone: "UTC" });
  const rangeLabel = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const label = (date: string) => dayLabel.format(new Date(`${date}T12:00:00Z`));
  const byDay = new Map(days.map((day) => [day.date, appointments.filter((entry) => localDate(Date.parse(entry.startsAt), zone) === day.date)]));

  // Time grid range: every day's business hours and every visit, rounded out to whole hours.
  const timed = appointments.map((entry) => {
    const date = localDate(Date.parse(entry.startsAt), zone);
    const from = localMinutes(Date.parse(entry.startsAt), zone);
    const end = localDate(Date.parse(entry.endsAt), zone) === date ? localMinutes(Date.parse(entry.endsAt), zone) : 24 * 60;
    return { ...entry, date, from, to: Math.max(end, from + 15) };
  });
  const open = days.flatMap((day) => day.hours ? [minutesOf(day.hours.opensAt)] : []);
  const close = days.flatMap((day) => day.hours ? [minutesOf(day.hours.closesAt)] : []);
  const start = Math.floor(Math.min(open.length ? Math.min(...open) : 9 * 60, ...timed.map((entry) => entry.from)) / 60) * 60;
  const end = Math.ceil(Math.max(close.length ? Math.max(...close) : 17 * 60, ...timed.map((entry) => entry.to)) / 60) * 60;
  const marks = Array.from({ length: Math.max(0, (end - start) / 60 + 1) }, (_, index) => start + index * 60);
  const height = (end - start) * PX;
  const y = (minutes: number) => (minutes - start) * PX;
  const nowMinutes = localMinutes(now, zone);

  return <section aria-labelledby="calendar-week" className="space-y-4">
    <CalendarToolbar id="calendar-week" title={rangeLabel.formatRange(new Date(`${monday}T12:00:00Z`), new Date(`${addDays(monday, 6)}T12:00:00Z`))}
      prev={calendarHref({ ...filters, date: addDays(monday, -7) })} next={calendarHref({ ...filters, date: addDays(monday, 7) })}
      prevLabel={copy.previousWeek} nextLabel={copy.nextWeek} today={days.some((day) => day.date === today) ? undefined : calendarHref(filters)} todayLabel={copy.thisWeek}
      date={parseDate(context.query.date, today)} base={calendarHref(filters)}>
      <span className="rounded-full bg-muted px-3 py-1">{copy.weekCount(appointments.length)}</span>
    </CalendarToolbar>

    {/* Phones and tablets: one card per day. */}
    <ol className="grid gap-3 sm:grid-cols-2 lg:hidden">{days.map((day) => {
      const entries = byDay.get(day.date) ?? [];
      const isToday = day.date === today;
      return <li key={day.date} aria-label={label(day.date)} className={cn("flex min-w-0 flex-col overflow-clip rounded-2xl border bg-card shadow-xs", !day.hours && !entries.length && "bg-muted/50 shadow-none")}>
        <h3 className={cn("flex min-h-11 items-center justify-between gap-2 border-b px-3 py-2 text-sm font-semibold", isToday && "bg-brand-soft")}>
          <span className="flex min-w-0 items-center gap-2"><Link href={calendarHref({ ...filters, date: day.date }, "day")} aria-label={copy.openDay(label(day.date))}
            className="-mx-1 rounded-md px-1 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">{label(day.date)}</Link>
            {isToday && <span className="rounded-full bg-primary px-2 py-0.5 text-[0.6875rem] font-semibold text-primary-foreground">{copy.today}</span>}</span>
          {entries.length > 0 && <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-card px-1.5 py-0.5 text-xs font-semibold tabular-nums ring-1 ring-border">{entries.length}</span>}
        </h3>
        {!entries.length ? <p className="px-3 py-3 text-xs text-muted-foreground">{day.hours ? copy.noneDay : copy.closed}</p>
          : <ul className="space-y-2 p-2">{entries.map((entry) => <li key={entry.id} data-appointment={entry.id}>
            <AppointmentTrigger appointment={entry} zone={zone} primaryColor={primaryColor}
              className={cn("block min-h-11 w-full rounded-xl border-l-4 px-2.5 py-2 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", statusTone(entry.status).block)}>
              <span className="flex items-center justify-between gap-2 text-xs font-semibold tabular-nums">{time.format(new Date(entry.startsAt))}
                {entry.status !== "booked" && <span className="rounded-full bg-background/70 px-1.5 py-0.5 text-[0.6875rem] font-medium no-underline">{copy.status[entry.status] ?? entry.status}</span>}</span>
              <span className="mt-1 block break-words text-sm font-medium">{entry.leadName}</span>
              <span className="block truncate text-xs text-muted-foreground">{entry.vehicleName}</span>
              {owner && <span className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"><Avatar name={entry.salespersonName} size="sm" /><span className="truncate">{entry.salespersonName}</span></span>}
            </AppointmentTrigger></li>)}</ul>}
      </li>;
    })}</ol>

    {/* Desktop: time grid. */}
    <div className="hidden overflow-x-auto rounded-2xl border bg-card shadow-xs lg:block">
      <div className="grid min-w-[52rem]" style={{ gridTemplateColumns: "4rem repeat(7, minmax(0, 1fr))" }}>
        <div className="sticky left-0 z-20 border-b border-r bg-card" aria-hidden />
        {days.map((day) => {
          const count = byDay.get(day.date)?.length ?? 0;
          const isToday = day.date === today;
          return <Link key={day.date} href={calendarHref({ ...filters, date: day.date }, "day")} aria-label={copy.openDay(label(day.date))}
            className={cn("flex min-w-0 items-center justify-between gap-1 border-b border-r px-2.5 py-2 last:border-r-0 hover:bg-muted/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring", isToday && "bg-brand-soft")}>
            <span className="flex min-w-0 items-baseline gap-1.5">
              <span className="text-xs font-medium uppercase text-muted-foreground">{day.name.slice(0, 3)}</span>
              <span className={cn("text-lg font-semibold tabular-nums", isToday && "text-primary")}>{Number(day.date.slice(8))}</span>
            </span>
            {count > 0 ? <span className="rounded-full bg-card px-1.5 text-xs font-semibold tabular-nums ring-1 ring-border">{count}</span>
              : !day.hours && <span className="text-[0.6875rem] text-muted-foreground">{copy.closed}</span>}
          </Link>;
        })}

        <div className="sticky left-0 z-20 border-r bg-card" style={{ height }} aria-hidden>
          {marks.map((mark) => <span key={mark} className="absolute right-2 -translate-y-1/2 text-[0.6875rem] font-medium tabular-nums text-muted-foreground first:translate-y-0.5"
            style={{ top: y(mark) }}>{mark < end ? clock(mark, "hour") : null}</span>)}
        </div>
        {days.map((day) => {
          const opens = day.hours ? minutesOf(day.hours.opensAt) : null;
          const closes = day.hours ? minutesOf(day.hours.closesAt) : null;
          const entries = placeInLanes(timed.filter((entry) => entry.date === day.date));
          return <section key={day.date} aria-label={label(day.date)} className="relative border-r last:border-r-0" style={{ height }}>
            {opens === null || closes === null ? <div aria-hidden className="absolute inset-0 bg-muted/60" /> : <>
              {opens > start && <div aria-hidden className="absolute inset-x-0 top-0 bg-muted/60" style={{ height: y(opens) }} />}
              {closes < end && <div aria-hidden className="absolute inset-x-0 bottom-0 bg-muted/60" style={{ top: y(closes) }} />}
            </>}
            {marks.slice(1, -1).map((mark) => <div key={mark} aria-hidden className="absolute inset-x-0 border-t" style={{ top: y(mark) }} />)}
            {day.date === today && nowMinutes >= start && nowMinutes <= end && <div aria-hidden className="absolute inset-x-0 z-10 border-t-2 border-primary" style={{ top: y(nowMinutes) }}>
              <span className="absolute -left-1 -top-[5px] size-2 rounded-full bg-primary" />
            </div>}
            <ol>{entries.map((entry) => <li key={entry.id} data-appointment={entry.id}>
              <AppointmentTrigger appointment={entry} zone={zone} primaryColor={primaryColor}
                style={{ top: y(entry.from) + 1, height: Math.max((entry.to - entry.from) * PX - 2, 30), left: `calc(${(entry.lane / entry.lanes) * 100}% + 3px)`, width: `calc(${100 / entry.lanes}% - 6px)` }}
                className={cn("absolute z-10 block overflow-hidden rounded-lg border-l-4 px-1.5 py-1 transition-shadow hover:z-20 hover:shadow-md focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", statusTone(entry.status).block)}>
                <span className="block truncate text-[0.6875rem] font-semibold tabular-nums">{time.format(new Date(entry.startsAt))}</span>
                <span className="block truncate text-xs font-medium leading-tight">{entry.leadName}</span>
                <span className="block truncate text-[0.6875rem] text-muted-foreground">{owner ? entry.salespersonName : entry.vehicleName}</span>
              </AppointmentTrigger></li>)}</ol>
          </section>;
        })}
      </div>
    </div>
  </section>;
}
