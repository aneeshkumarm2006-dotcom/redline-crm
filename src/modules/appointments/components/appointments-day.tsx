import Link from "next/link";
import { CalendarX2, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownField } from "@/components/ui/dropdown-field";
import { Avatar } from "@/components/shared/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import type { Settings } from "@/modules/settings/schema";
import { listAppointmentsBetween } from "../service";
import { addDays, localDate, localMinutes, weekday, zonedTimeToUtc } from "../slots";
import { appointmentsCopy as copy } from "../copy";
import { describeAppointments, type DescribedAppointment } from "./appointments-screen";
import { calendarHref, iso, type CalendarQuery } from "./appointments-calendar";

type Option = { id: string; name: string };
type Column = { id: string; name: string; location?: string; entries: Placed[]; open: number | null };
type Placed = DescribedAppointment & { from: number; to: number; lane: number; lanes: number };

// Vertical scale of the grid: a 30-minute visit is 48px tall, enough for time, customer and vehicle.
const PX = 1.6;
const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/** Side-by-side lanes for visits that overlap in one column (rare: booked visits are unique per start time). */
function placeInLanes(entries: Omit<Placed, "lane" | "lanes">[]): Placed[] {
  const sorted = [...entries].sort((a, b) => a.from - b.from);
  const placed: Placed[] = [];
  let cluster: Placed[] = [];
  let clusterEnd = -1;
  for (const entry of sorted) {
    if (entry.from >= clusterEnd) cluster = [];
    const used = new Set(cluster.filter((item) => item.to > entry.from).map((item) => item.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    const item = { ...entry, lane, lanes: 1 };
    cluster.push(item);
    placed.push(item);
    clusterEnd = Math.max(clusterEnd, entry.to);
    const lanes = Math.max(...cluster.map((member) => member.lane)) + 1;
    for (const member of cluster) member.lanes = lanes;
  }
  return placed;
}

/**
 * Day schedule: a time grid in the dealership time zone with one column per salesperson, so the owner sees at a
 * glance who is booked when and who still has open slots. Owners filter by location or a single salesperson;
 * a salesperson sees only their own column (enforced by the appointments service).
 */
export async function AppointmentsDay({ query, settings, now, owner, self, dealerships, salespeople }: {
  query: CalendarQuery; settings: Settings; now: number; owner: boolean; self: Option;
  dealerships: Option[]; salespeople: (Option & { dealershipId: string | null; active: boolean })[];
}) {
  const { timeZone: zone, slotLengthMinutes: slot, businessHours } = settings.booking;
  const today = localDate(now, zone);
  const date = query.date && /^\d{4}-\d{2}-\d{2}$/.test(query.date) && !Number.isNaN(Date.parse(query.date)) ? query.date : today;
  const dealershipId = owner && dealerships.some((entry) => entry.id === query.dealershipId) ? query.dealershipId : undefined;
  const salespersonId = owner && salespeople.some((entry) => entry.id === query.salespersonId) ? query.salespersonId : undefined;
  const filters = { dealershipId, salespersonId };
  const all = await listAppointmentsBetween(iso(zonedTimeToUtc(date, "00:00", zone)), iso(zonedTimeToUtc(addDays(date, 1), "00:00", zone)), salespersonId);
  const appointments = await describeAppointments(all.filter((entry) => !dealershipId || entry.dealershipId === dealershipId));

  const hours = businessHours[weekday(date)];
  const opens = hours ? minutesOf(hours.opensAt) : null;
  const closes = hours ? minutesOf(hours.closesAt) : null;
  const timed = appointments.map((entry) => {
    const from = localMinutes(Date.parse(entry.startsAt), zone);
    // A visit ending at or after midnight is drawn to the end of the day.
    const end = localDate(Date.parse(entry.endsAt), zone) === date ? localMinutes(Date.parse(entry.endsAt), zone) : 24 * 60;
    return { ...entry, from, to: Math.max(end, from + 15) };
  });
  const start = Math.floor(Math.min(opens ?? 24 * 60, ...timed.map((entry) => entry.from)) / 60) * 60;
  const end = Math.ceil(Math.max(closes ?? 0, ...timed.map((entry) => entry.to)) / 60) * 60;
  const nowMinutes = date === today ? localMinutes(now, zone) : null;

  /** Free slots left in business hours; past slots don't count, and past days show none. */
  const openSlots = (entries: { from: number; to: number; status: string }[]) => {
    if (opens === null || closes === null || date < today) return null;
    let count = 0;
    for (let at = opens; at + slot <= closes; at += slot) {
      if (nowMinutes !== null && at <= nowMinutes) continue;
      if (!entries.some((entry) => entry.from < at + slot && entry.to > at)) count++;
    }
    return count;
  };

  const locationName = (id: string | null) => dealerships.find((entry) => entry.id === id)?.name;
  const roster = owner
    ? salespeople.filter((entry) => salespersonId ? entry.id === salespersonId : entry.active && (!dealershipId || entry.dealershipId === dealershipId))
      .map((entry) => ({ id: entry.id, name: entry.name, location: dealershipId ? undefined : locationName(entry.dealershipId) }))
    : [{ id: self.id, name: self.name }];
  // Former or reassigned staff who still hold a visit that day keep a column, so no visit is hidden.
  for (const entry of timed) if (!roster.some((person) => person.id === entry.salespersonId)) roster.push({ id: entry.salespersonId, name: entry.salespersonName, location: undefined });
  const columns: Column[] = roster.map((person) => {
    const entries = timed.filter((entry) => entry.salespersonId === person.id);
    return { ...person, entries: placeInLanes(entries), open: openSlots(entries) };
  });
  const booked = new Set(appointments.map((entry) => entry.salespersonId)).size;

  const title = new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
  const time = new Intl.DateTimeFormat("en-CA", { timeStyle: "short", timeZone: zone });
  const clock = (minutes: number, style: "hour" | "full") => new Intl.DateTimeFormat("en-CA", style === "hour" ? { hour: "numeric", timeZone: "UTC" } : { timeStyle: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(2000, 0, 1, Math.floor(minutes / 60), minutes % 60)));
  const marks = Array.from({ length: Math.max(0, (end - start) / 60 + 1) }, (_, index) => start + index * 60);
  const height = (end - start) * PX;
  const y = (minutes: number) => (minutes - start) * PX;
  const people = dealershipId ? salespeople.filter((entry) => entry.dealershipId === dealershipId || entry.id === salespersonId) : salespeople;

  return <section aria-labelledby="calendar-day" className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-2 shadow-xs sm:p-2.5">
      <nav aria-label={copy.dayNav} className="flex min-w-0 items-center gap-1">
        <Button asChild variant="ghost" size="icon" className="size-11 rounded-xl"><Link href={calendarHref({ ...filters, date: addDays(date, -1) }, "day")} aria-label={copy.previousDay}><ChevronLeft aria-hidden className="size-4" /></Link></Button>
        <h2 id="calendar-day" className="font-display min-w-0 px-1.5 text-base font-semibold sm:text-lg">{title}</h2>
        <Button asChild variant="ghost" size="icon" className="size-11 rounded-xl"><Link href={calendarHref({ ...filters, date: addDays(date, 1) }, "day")} aria-label={copy.nextDay}><ChevronRight aria-hidden className="size-4" /></Link></Button>
        {date !== today && <Button asChild variant="outline" className="ml-1 min-h-11 rounded-xl"><Link href={calendarHref(filters, "day")}>{copy.goToday}</Link></Button>}
      </nav>
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium tabular-nums text-muted-foreground">
        {hours && <span className="rounded-full bg-muted px-3 py-1">{copy.hours(clock(opens!, "full"), clock(closes!, "full"))}</span>}
        <span className="rounded-full bg-muted px-3 py-1">{owner ? copy.dayCount(appointments.length, booked) : copy.visits(appointments.length)}</span>
      </div>
    </div>
    {owner && <form action="/crm/leads/appointments" aria-label={copy.filters} className="grid gap-4 rounded-2xl border bg-card p-5 shadow-xs sm:grid-cols-[1fr_1fr_auto]">
      <input type="hidden" name="view" value="day" />
      <input type="hidden" name="date" value={date} />
      <label className="min-w-0 space-y-2"><span className="text-sm font-medium">{copy.location}</span>
        <DropdownField name="dealershipId" defaultValue={dealershipId ?? ""} options={[{ value: "", label: copy.allLocations }, ...dealerships.map((entry) => ({ value: entry.id, label: entry.name }))]} /></label>
      <label className="min-w-0 space-y-2"><span className="text-sm font-medium">{copy.salesperson}</span>
        <DropdownField name="salespersonId" defaultValue={salespersonId ?? ""} options={[{ value: "", label: copy.allSalespeople }, ...people.map((entry) => ({ value: entry.id, label: entry.name }))]} /></label>
      <Button type="submit" className="min-h-11 self-end">{copy.apply}</Button>
    </form>}
    {!hours && !appointments.length ? <EmptyState icon={CalendarX2} title={copy.closedDay} description={copy.closedDayHint} />
      : !columns.length ? <EmptyState icon={Users} title={copy.noSalespeople} description={copy.noSalespeopleHint} />
      : <div className="overflow-x-auto overscroll-x-contain rounded-2xl border bg-card shadow-xs">
        <div className="grid min-w-fit" style={{ gridTemplateColumns: `4rem repeat(${columns.length}, minmax(11rem, 1fr))` }}>
          <div className="sticky left-0 z-20 border-b border-r bg-card" aria-hidden />
          {columns.map((column) => <div key={column.id} className="flex min-w-0 items-center gap-2.5 border-b border-r px-3 py-2.5 last:border-r-0">
            <Avatar name={column.name} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{column.name}</span>
              <span className="block truncate text-xs tabular-nums text-muted-foreground">
                {[copy.visits(column.entries.length), column.open === null ? null : column.open ? copy.open(column.open) : copy.full, column.location].filter(Boolean).join(" · ")}
              </span>
            </span>
          </div>)}

          <div className="sticky left-0 z-20 border-r bg-card" style={{ height }} aria-hidden>
            {marks.map((mark) => <span key={mark} className="absolute right-2 -translate-y-1/2 text-[0.6875rem] font-medium tabular-nums text-muted-foreground first:translate-y-0.5"
              style={{ top: y(mark) }}>{mark < end ? clock(mark, "hour") : null}</span>)}
          </div>
          {columns.map((column) => <section key={column.id} aria-label={copy.scheduleFor(column.name)} className="relative border-r last:border-r-0" style={{ height }}>
            {/* Outside business hours (or a closed day) is shaded. */}
            {opens === null || closes === null ? <div aria-hidden className="absolute inset-0 bg-muted/60" /> : <>
              {opens > start && <div aria-hidden className="absolute inset-x-0 top-0 bg-muted/60" style={{ height: y(opens) }} />}
              {closes < end && <div aria-hidden className="absolute inset-x-0 bottom-0 bg-muted/60" style={{ top: y(closes) }} />}
            </>}
            {marks.slice(1, -1).map((mark) => <div key={mark} aria-hidden className="absolute inset-x-0 border-t" style={{ top: y(mark) }} />)}
            {marks.slice(0, -1).map((mark) => <div key={`${mark}-half`} aria-hidden className="absolute inset-x-0 border-t border-dashed border-border/60" style={{ top: y(mark + 30) }} />)}
            {nowMinutes !== null && nowMinutes >= start && nowMinutes <= end && <div aria-hidden className="absolute inset-x-0 z-10 border-t-2 border-primary" style={{ top: y(nowMinutes) }}>
              <span className="absolute -left-1 -top-[5px] size-2 rounded-full bg-primary" />
            </div>}
            <ol>{column.entries.map((entry) => {
              const completed = entry.status !== "booked";
              const body = <>
                <span className="flex items-center justify-between gap-1.5 text-[0.6875rem] font-semibold tabular-nums">
                  <span className="truncate">{time.formatRange(new Date(entry.startsAt), new Date(entry.endsAt))}</span>
                  {completed && <span className="shrink-0 rounded-full bg-background/70 px-1.5 text-[0.625rem] font-medium">{copy.status[entry.status] ?? entry.status}</span>}
                </span>
                <span className="block truncate text-sm font-medium leading-tight">{entry.leadName}</span>
                <span className="block truncate text-xs text-muted-foreground">{entry.vehicleName}</span>
              </>;
              const classes = cn("absolute block overflow-hidden rounded-lg border-l-4 px-2 py-1",
                completed ? "border-muted-foreground/40 bg-muted text-muted-foreground" : "border-primary bg-brand-soft text-foreground");
              const style = { top: y(entry.from) + 1, height: Math.max((entry.to - entry.from) * PX - 2, 44),
                left: `calc(${(entry.lane / entry.lanes) * 100}% + 4px)`, width: `calc(${100 / entry.lanes}% - 8px)` };
              return <li key={entry.id} data-appointment={entry.id}>{entry.leadVisible
                ? <Link href={`/crm/leads/${entry.leadId}`} style={style} className={cn(classes, "z-10 transition-shadow duration-200 hover:z-20 hover:shadow-md focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring")}>{body}</Link>
                : <div style={style} className={cn(classes, "z-10")}>{body}</div>}</li>;
            })}</ol>
          </section>)}
        </div>
      </div>}
  </section>;
}
