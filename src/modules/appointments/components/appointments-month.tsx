import Link from "next/link";
import { cn } from "@/lib/utils";
import { weekdays } from "@/modules/settings/schema";
import { addDays, localDate, weekday } from "../slots";
import { appointmentsCopy as copy } from "../copy";
import { AppointmentTrigger } from "./appointment-details";
import { CalendarToolbar, addMonths, calendarFilters, calendarHref, loadCalendarAppointments, monthGrid, parseDate, type CalendarContext } from "./calendar-shared";
import { statusTone } from "./calendar-tone";

const SHOWN = 3;

/**
 * Month view: six Monday-first weeks. Each day lists its first few visits (each opens its details sheet) and a
 * "+N more" link to the day schedule; phones show a count per day instead. Closed days are shaded.
 */
export async function AppointmentsMonth({ context }: { context: CalendarContext }) {
  const { settings, now, owner } = context;
  const zone = settings.booking.timeZone;
  const primaryColor = settings.brand.primaryColor;
  const today = localDate(now, zone);
  const date = parseDate(context.query.date, today);
  const grid = monthGrid(date);
  const filters = calendarFilters(context);
  const appointments = await loadCalendarAppointments(context, grid.days[0], addDays(grid.days[41], 1));
  const inMonth = appointments.filter((entry) => localDate(Date.parse(entry.startsAt), zone).slice(0, 7) === grid.first.slice(0, 7));
  const time = new Intl.DateTimeFormat("en-CA", { hour: "numeric", minute: "2-digit", timeZone: zone });
  const long = new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  const title = new Intl.DateTimeFormat("en-CA", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${grid.first}T12:00:00Z`));
  const month = grid.first.slice(0, 7);

  return <section aria-labelledby="calendar-month" className="space-y-4">
    <CalendarToolbar id="calendar-month" title={title}
      prev={calendarHref({ ...filters, date: addMonths(grid.first, -1) }, "month")} next={calendarHref({ ...filters, date: addMonths(grid.first, 1) }, "month")}
      prevLabel={copy.previousMonth} nextLabel={copy.nextMonth} today={today.slice(0, 7) === month ? undefined : calendarHref(filters, "month")} todayLabel={copy.thisMonth}
      date={date} base={calendarHref(filters, "month")}>
      <span className="rounded-full bg-muted px-3 py-1">{copy.monthCount(inMonth.length)}</span>
    </CalendarToolbar>
    <div className="overflow-clip rounded-2xl border bg-card shadow-xs">
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {weekdays.map((name) => <span key={name} className="px-2 py-2 text-center text-xs font-semibold uppercase text-muted-foreground sm:text-left">{name.slice(0, 3)}</span>)}
      </div>
      <ol className="grid grid-cols-7">{grid.days.map((day, index) => {
        const entries = appointments.filter((entry) => localDate(Date.parse(entry.startsAt), zone) === day);
        const outside = day.slice(0, 7) !== month;
        const closed = !settings.booking.businessHours[weekday(day)];
        const isToday = day === today;
        const dayHref = calendarHref({ ...filters, date: day }, "day");
        return <li key={day} aria-label={`${long.format(new Date(`${day}T12:00:00Z`))}${entries.length ? `, ${copy.visits(entries.length)}` : ""}`}
          className={cn("flex min-h-20 min-w-0 flex-col gap-1 border-b border-r p-1 sm:min-h-32 sm:p-1.5", index % 7 === 6 && "border-r-0", index >= 35 && "border-b-0",
            closed && "bg-muted/40", outside && "bg-muted/60 text-muted-foreground")}>
          <Link href={dayHref} aria-label={copy.openDay(long.format(new Date(`${day}T12:00:00Z`)))}
            className={cn("flex size-7 items-center justify-center self-center rounded-full text-xs font-semibold tabular-nums hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring sm:self-start",
              isToday && "bg-primary text-primary-foreground hover:bg-primary/90")}>{Number(day.slice(8))}</Link>
          {entries.length > 0 && <Link href={dayHref} className="mx-auto rounded-full bg-primary px-1.5 text-[0.6875rem] font-semibold tabular-nums text-primary-foreground sm:hidden">{entries.length}</Link>}
          <ul className="hidden min-w-0 space-y-1 sm:block">
            {entries.slice(0, SHOWN).map((entry) => <li key={entry.id} data-appointment={entry.id}>
              <AppointmentTrigger appointment={entry} zone={zone} primaryColor={primaryColor}
                className={cn("flex w-full min-w-0 items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-xs transition-shadow hover:shadow-sm focus-visible:outline-2 focus-visible:outline-ring", statusTone(entry.status).chip)}>
                <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", statusTone(entry.status).dot)} />
                <span className="shrink-0 font-semibold tabular-nums">{time.format(new Date(entry.startsAt))}</span>
                <span className="truncate">{owner ? `${entry.leadName} · ${entry.salespersonName}` : entry.leadName}</span>
              </AppointmentTrigger></li>)}
            {entries.length > SHOWN && <li><Link href={dayHref} className="block rounded-md px-1.5 py-0.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">{copy.more(entries.length - SHOWN)}</Link></li>}
          </ul>
        </li>;
      })}</ol>
    </div>
  </section>;
}
