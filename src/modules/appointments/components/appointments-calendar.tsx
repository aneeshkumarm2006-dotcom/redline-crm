import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownField } from "@/components/ui/dropdown-field";
import { Avatar } from "@/components/shared/avatar";
import { weekdays } from "@/modules/settings/schema";
import type { Settings } from "@/modules/settings/schema";
import { listAppointmentsBetween } from "../service";
import { addDays, localDate, localWeek, zonedTimeToUtc } from "../slots";
import { appointmentsCopy as copy } from "../copy";
import { describeAppointments } from "./appointments-screen";

type Option = { id: string; name: string };
export type CalendarQuery = { week?: string; date?: string; dealershipId?: string; salespersonId?: string };
export const iso = (instant: number) => new Date(instant).toISOString();

/** Calendar URL for a view (week or day) with these filters. */
export function calendarHref(query: CalendarQuery, view: "week" | "day" = "week") {
  const search = new URLSearchParams({ view, ...Object.fromEntries(Object.entries(query).filter(([, value]) => value)) });
  return `/crm/leads/appointments?${search}`;
}

/**
 * Week view, Monday to Sunday in the dealership time zone: one column per day on desktop, stacked days on a phone.
 * Booked and completed visits show; closed days come from the booking hours. Owners can filter by location and
 * salesperson; a salesperson only ever sees their own calendar (enforced by the appointments service).
 */
export async function AppointmentsCalendar({ query, settings, now, owner, dealerships, salespeople }: {
  query: CalendarQuery; settings: Settings; now: number; owner: boolean; dealerships: Option[]; salespeople: (Option & { dealershipId: string | null })[];
}) {
  const zone = settings.booking.timeZone;
  const today = localDate(now, zone);
  const anchor = query.week && /^\d{4}-\d{2}-\d{2}$/.test(query.week) && !Number.isNaN(Date.parse(query.week)) ? query.week : today;
  const range = localWeek(zonedTimeToUtc(anchor, "12:00", zone), zone);
  const monday = localDate(range.start, zone);
  const days = weekdays.map((name, index) => ({ name, date: addDays(monday, index) }));
  const dealershipId = owner && dealerships.some((entry) => entry.id === query.dealershipId) ? query.dealershipId : undefined;
  const salespersonId = owner && salespeople.some((entry) => entry.id === query.salespersonId) ? query.salespersonId : undefined;
  const all = await listAppointmentsBetween(iso(range.start), iso(range.end), salespersonId);
  const appointments = await describeAppointments(all.filter((entry) => !dealershipId || entry.dealershipId === dealershipId));
  const filters = { dealershipId, salespersonId };
  const time = new Intl.DateTimeFormat("en-CA", { timeStyle: "short", timeZone: zone });
  const dayLabel = new Intl.DateTimeFormat("en-CA", { weekday: "short", day: "numeric", timeZone: "UTC" });
  const rangeLabel = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const people = dealershipId ? salespeople.filter((entry) => entry.dealershipId === dealershipId || entry.id === salespersonId) : salespeople;
  return <section aria-labelledby="calendar-week" className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-2 shadow-xs sm:p-2.5">
      <nav aria-label={copy.weekNav} className="flex min-w-0 items-center gap-1">
        <Button asChild variant="ghost" size="icon" className="size-11 rounded-xl"><Link href={calendarHref({ ...filters, week: addDays(monday, -7) })} aria-label={copy.previousWeek}><ChevronLeft aria-hidden className="size-4" /></Link></Button>
        <h2 id="calendar-week" className="font-display min-w-0 px-1.5 text-base font-semibold tabular-nums sm:text-lg">
          {rangeLabel.formatRange(new Date(`${monday}T12:00:00Z`), new Date(`${addDays(monday, 6)}T12:00:00Z`))}
        </h2>
        <Button asChild variant="ghost" size="icon" className="size-11 rounded-xl"><Link href={calendarHref({ ...filters, week: addDays(monday, 7) })} aria-label={copy.nextWeek}><ChevronRight aria-hidden className="size-4" /></Link></Button>
        {!days.some((day) => day.date === today) && <Button asChild variant="outline" className="ml-1 min-h-11 rounded-xl"><Link href={calendarHref(filters)}>{copy.thisWeek}</Link></Button>}
      </nav>
      <p className="rounded-full bg-muted px-3 py-1 text-sm font-medium tabular-nums text-muted-foreground">{copy.weekCount(appointments.length)}</p>
    </div>
    {owner && <form action="/crm/leads/appointments" aria-label={copy.filters} className="grid gap-4 rounded-2xl border bg-card p-5 shadow-xs sm:grid-cols-[1fr_1fr_auto]">
      <input type="hidden" name="view" value="week" />
      <input type="hidden" name="week" value={monday} />
      <label className="min-w-0 space-y-2"><span className="text-sm font-medium">{copy.location}</span>
        <DropdownField name="dealershipId" defaultValue={dealershipId ?? ""} options={[{ value: "", label: copy.allLocations }, ...dealerships.map((entry) => ({ value: entry.id, label: entry.name }))]} /></label>
      <label className="min-w-0 space-y-2"><span className="text-sm font-medium">{copy.salesperson}</span>
        <DropdownField name="salespersonId" defaultValue={salespersonId ?? ""} options={[{ value: "", label: copy.allSalespeople }, ...people.map((entry) => ({ value: entry.id, label: entry.name }))]} /></label>
      <Button type="submit" className="min-h-11 self-end">{copy.apply}</Button>
    </form>}
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">{days.map((day) => {
      const entries = appointments.filter((entry) => localDate(Date.parse(entry.startsAt), zone) === day.date);
      const closed = !settings.booking.businessHours[day.name];
      const isToday = day.date === today;
      return <li key={day.date} aria-label={dayLabel.format(new Date(`${day.date}T12:00:00Z`))}
        className={cn("flex min-w-0 flex-col overflow-clip rounded-2xl border bg-card shadow-xs xl:min-h-56", closed && !entries.length && "bg-muted/50 shadow-none")}>
        <h3 className={cn("flex min-h-11 items-center justify-between gap-2 border-b px-3 py-2 text-sm font-semibold", isToday && "bg-brand-soft")}>
          <span className="flex min-w-0 items-center gap-2"><Link href={calendarHref({ ...filters, date: day.date }, "day")} aria-label={copy.openDay(dayLabel.format(new Date(`${day.date}T12:00:00Z`)))}
            className="-mx-1 rounded-md px-1 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">{dayLabel.format(new Date(`${day.date}T12:00:00Z`))}</Link>
            {isToday && <span className="rounded-full bg-primary px-2 py-0.5 text-[0.6875rem] font-semibold text-primary-foreground">{copy.today}</span>}</span>
          {entries.length > 0 && <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-card px-1.5 py-0.5 text-xs font-semibold tabular-nums text-foreground ring-1 ring-border">{entries.length}</span>}
        </h3>
        {!entries.length ? <p className="px-3 py-3 text-xs text-muted-foreground">{closed ? copy.closed : copy.noneDay}</p>
          : <ul className="space-y-2 p-2">{entries.map((entry) => {
            const completed = entry.status !== "booked";
            const body = <>
              <span className="flex items-center justify-between gap-2 text-xs font-semibold tabular-nums">
                <span className="inline-flex items-center gap-1.5"><span aria-hidden className={cn("size-2 shrink-0 rounded-full", completed ? "bg-muted-foreground/50" : "bg-primary")} />{time.format(new Date(entry.startsAt))}</span>
                {completed && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">{copy.status[entry.status] ?? entry.status}</span>}</span>
              <span className="mt-1 block break-words text-sm font-medium">{entry.leadName}</span>
              <span className="block truncate text-xs text-muted-foreground">{entry.vehicleName}</span>
              {owner && <span className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"><Avatar name={entry.salespersonName} size="sm" /><span className="truncate">{entry.salespersonName}</span></span>}
            </>;
            const classes = cn("block rounded-xl border px-2.5 py-2", completed ? "bg-muted/50" : "bg-card shadow-xs");
            return <li key={entry.id} data-appointment={entry.id}>{entry.leadVisible
              ? <Link href={`/crm/leads/${entry.leadId}`} className={cn(classes, "min-h-11 transition-[border-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring")}>{body}</Link>
              : <div className={classes}>{body}</div>}</li>;
          })}</ul>}
      </li>;
    })}</ol>
  </section>;
}
