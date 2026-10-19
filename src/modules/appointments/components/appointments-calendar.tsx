import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/shared/avatar";
import { weekdays } from "@/modules/settings/schema";
import type { Settings } from "@/modules/settings/schema";
import { listAppointmentsBetween } from "../service";
import { addDays, localDate, localWeek, zonedTimeToUtc } from "../slots";
import { appointmentsCopy as copy } from "../copy";
import { describeAppointments } from "./appointments-screen";

type Option = { id: string; name: string };
export type CalendarQuery = { week?: string; dealershipId?: string; salespersonId?: string };
const iso = (instant: number) => new Date(instant).toISOString();

/** Calendar URL for these filters (the view is always week here). */
function calendarHref(query: CalendarQuery) {
  const search = new URLSearchParams({ view: "week", ...Object.fromEntries(Object.entries(query).filter(([, value]) => value)) });
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
  const selectClass = "min-h-11 w-full min-w-0 rounded-md border bg-background px-3 text-base";
  const people = dealershipId ? salespeople.filter((entry) => entry.dealershipId === dealershipId || entry.id === salespersonId) : salespeople;
  return <section aria-labelledby="calendar-week" className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label={copy.weekNav} className="flex items-center gap-1">
        <Button asChild variant="outline" size="icon" className="size-11"><Link href={calendarHref({ ...filters, week: addDays(monday, -7) })} aria-label={copy.previousWeek}><ChevronLeft aria-hidden className="size-4" /></Link></Button>
        <h2 id="calendar-week" className="min-w-0 px-2 text-sm font-semibold tabular-nums sm:text-base">
          {rangeLabel.formatRange(new Date(`${monday}T12:00:00Z`), new Date(`${addDays(monday, 6)}T12:00:00Z`))}
        </h2>
        <Button asChild variant="outline" size="icon" className="size-11"><Link href={calendarHref({ ...filters, week: addDays(monday, 7) })} aria-label={copy.nextWeek}><ChevronRight aria-hidden className="size-4" /></Link></Button>
        {!days.some((day) => day.date === today) && <Button asChild variant="ghost" className="min-h-11"><Link href={calendarHref(filters)}>{copy.thisWeek}</Link></Button>}
      </nav>
      <p className="text-sm text-muted-foreground">{copy.weekCount(appointments.length)}</p>
    </div>
    {owner && <form action="/crm/leads/appointments" aria-label={copy.filters} className="grid gap-3 rounded-xl border bg-card p-3 sm:grid-cols-[1fr_1fr_auto]">
      <input type="hidden" name="view" value="week" />
      <input type="hidden" name="week" value={monday} />
      <label className="min-w-0 space-y-1.5"><span className="text-sm font-medium">{copy.location}</span>
        <select name="dealershipId" defaultValue={dealershipId ?? ""} className={selectClass}><option value="">{copy.allLocations}</option>{dealerships.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
      <label className="min-w-0 space-y-1.5"><span className="text-sm font-medium">{copy.salesperson}</span>
        <select name="salespersonId" defaultValue={salespersonId ?? ""} className={selectClass}><option value="">{copy.allSalespeople}</option>{people.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
      <Button type="submit" className="min-h-11 self-end">{copy.apply}</Button>
    </form>}
    <ol className="grid gap-3 lg:grid-cols-7 lg:gap-2">{days.map((day) => {
      const entries = appointments.filter((entry) => localDate(Date.parse(entry.startsAt), zone) === day.date);
      const closed = !settings.booking.businessHours[day.name];
      const isToday = day.date === today;
      return <li key={day.date} aria-label={dayLabel.format(new Date(`${day.date}T12:00:00Z`))}
        className={cn("flex min-w-0 flex-col rounded-xl border bg-card lg:min-h-48", isToday && "border-primary ring-1 ring-primary", closed && !entries.length && "bg-muted/40")}>
        <h3 className="flex items-center justify-between gap-2 border-b px-3 py-2 text-sm font-semibold">
          <span className={cn(isToday && "text-primary")}>{dayLabel.format(new Date(`${day.date}T12:00:00Z`))}{isToday && <span className="ml-1.5 text-xs font-medium">· {copy.today}</span>}</span>
          {entries.length > 0 && <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{entries.length}</span>}
        </h3>
        {!entries.length ? <p className="px-3 py-3 text-xs text-muted-foreground">{closed ? copy.closed : copy.noneDay}</p>
          : <ul className="space-y-1.5 p-2">{entries.map((entry) => {
            const completed = entry.status !== "booked";
            const body = <>
              <span className="flex items-center justify-between gap-2 text-xs font-semibold tabular-nums">{time.format(new Date(entry.startsAt))}
                {completed && <span className="font-normal text-muted-foreground">{copy.status[entry.status] ?? entry.status}</span>}</span>
              <span className="block break-words text-sm font-medium">{entry.leadName}</span>
              <span className="block truncate text-xs text-muted-foreground">{entry.vehicleName}</span>
              {owner && <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"><Avatar name={entry.salespersonName} size="sm" /><span className="truncate">{entry.salespersonName}</span></span>}
            </>;
            const classes = cn("block rounded-lg border-l-4 bg-muted/40 px-2.5 py-2", completed ? "border-l-muted-foreground/40 opacity-75" : "border-l-primary");
            return <li key={entry.id} data-appointment={entry.id}>{entry.leadVisible
              ? <Link href={`/crm/leads/${entry.leadId}`} className={cn(classes, "min-h-11 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring")}>{body}</Link>
              : <div className={classes}>{body}</div>}</li>;
          })}</ul>}
      </li>;
    })}</ol>
  </section>;
}
