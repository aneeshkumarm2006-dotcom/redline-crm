import { requestNow } from "@/lib/clock";
import Link from "next/link";
import { CalendarClock, CalendarDays, CalendarRange, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { requirePageUser } from "@/modules/auth/page-guards";
import { getVehicleSummaries } from "@/modules/inventory/service";
import { getLeadSummaries } from "@/modules/leads/service";
import { leadsCopy } from "@/modules/leads/copy";
import { LeadsTabs, segmentClass, segmentGroup } from "@/modules/leads/components/leads-tabs";
import { getSettings } from "@/modules/settings/service";
import { getStaffNames, listSalespeople } from "@/modules/users/service";
import { listDealerships } from "@/modules/dealerships/service";
import { listStaffAppointments, type StaffAppointment } from "../service";
import { localDate, startOfLocalDay } from "../slots";
import { appointmentsCopy as copy } from "../copy";
import { AppointmentsCalendar } from "./appointments-calendar";
import { AppointmentsDay } from "./appointments-day";

/** Resolves display names for appointment rows within the viewer's visibility. */
export async function describeAppointments(appointments: StaffAppointment[]) {
  const unique = (values: string[]) => [...new Set(values)];
  const [leads, vehicles, staff] = await Promise.all([
    getLeadSummaries(unique(appointments.map((entry) => entry.leadId))),
    getVehicleSummaries(unique(appointments.map((entry) => entry.vehicleId))),
    getStaffNames(unique(appointments.map((entry) => entry.salespersonId))),
  ]);
  return appointments.map((entry) => {
    const lead = leads.find((item) => item.id === entry.leadId);
    const vehicle = vehicles.find((item) => item.id === entry.vehicleId);
    return { ...entry, leadName: lead?.name ?? copy.unknownLead, leadVisible: Boolean(lead),
      vehicleName: vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : copy.unknownVehicle,
      salespersonName: staff.find((item) => item.id === entry.salespersonId)?.name ?? copy.unknownStaff };
  });
}
export type DescribedAppointment = Awaited<ReturnType<typeof describeAppointments>>[number];

export function AppointmentList({ appointments, timeZone, showDate, showSalesperson }: { appointments: DescribedAppointment[]; timeZone: string; showDate: boolean; showSalesperson: boolean }) {
  const time = new Intl.DateTimeFormat("en-CA", { timeStyle: "short", timeZone });
  const day = new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone });
  return <ul className="divide-y overflow-clip rounded-2xl border bg-card shadow-xs">{appointments.map((entry) => {
    const body = <>
      <span className="flex w-20 shrink-0 flex-col rounded-xl bg-muted px-2.5 py-2 text-center text-sm font-semibold tabular-nums">
        {showDate && <span className="text-xs font-normal text-muted-foreground">{day.format(new Date(entry.startsAt))}</span>}
        {time.format(new Date(entry.startsAt))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block break-words font-medium">{entry.leadName}</span>
        <span className="block break-words text-sm text-muted-foreground">{entry.vehicleName}</span>
        {showSalesperson && <span className="block text-xs text-muted-foreground">{copy.with(entry.salespersonName)}</span>}
      </span>
    </>;
    return <li key={entry.id} data-appointment={entry.id}>{entry.leadVisible
      ? <Link href={`/crm/leads/${entry.leadId}`} className="flex min-h-16 items-center gap-4 p-4 transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">{body}</Link>
      : <div className="flex min-h-16 items-center gap-4 p-4">{body}</div>}</li>;
  })}</ul>;
}

export async function AppointmentsScreen({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePageUser();
  const query = await searchParams;
  const text = (key: string) => typeof query[key] === "string" ? query[key] : undefined;
  const view = query.view === "week" || query.view === "day" ? query.view : "list";
  const settings = await getSettings();
  const zone = settings.booking.timeZone;
  const now = requestNow();
  const owner = user.role === "owner";
  const header = <PageHeader title={leadsCopy.title} description={owner ? copy.intro : copy.introMine}>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <LeadsTabs active="appointments" />
      <nav aria-label={copy.viewLabel} className={segmentGroup}>
        {(["list", "day", "week"] as const).map((entry) => {
          const Icon = { list: List, day: CalendarClock, week: CalendarRange }[entry];
          const active = entry === view;
          return <Link key={entry} href={entry === "list" ? "/crm/leads/appointments" : `/crm/leads/appointments?view=${entry}`} aria-current={active ? "page" : undefined}
            className={cn(segmentClass(active), "min-h-10")}>
            <Icon aria-hidden className="size-4" />{copy.views[entry]}</Link>;
        })}
      </nav>
    </div>
  </PageHeader>;
  if (view !== "list") {
    const [dealerships, salespeople] = await Promise.all([owner ? listDealerships() : [], owner ? listSalespeople() : []]);
    if (view === "day") return <>{header}<AppointmentsDay query={{ date: text("date"), dealershipId: text("dealershipId"), salespersonId: text("salespersonId") }} settings={settings} now={now} owner={owner}
      self={{ id: user.id, name: user.name }} dealerships={dealerships.filter((entry) => entry.active)}
      salespeople={salespeople.map((entry) => ({ id: entry.id, name: entry.name, dealershipId: entry.dealershipId, active: entry.active }))} /></>;
    return <>{header}<AppointmentsCalendar query={{ week: text("week"), dealershipId: text("dealershipId"), salespersonId: text("salespersonId") }} settings={settings} now={now} owner={owner}
      dealerships={dealerships.filter((entry) => entry.active)} salespeople={salespeople.map((entry) => ({ id: entry.id, name: entry.name, dealershipId: entry.dealershipId }))} /></>;
  }
  const appointments = await describeAppointments(await listStaffAppointments(new Date(startOfLocalDay(now, zone)).toISOString()));
  const today = localDate(now, zone);
  const todays = appointments.filter((entry) => localDate(Date.parse(entry.startsAt), zone) === today);
  const later = appointments.filter((entry) => localDate(Date.parse(entry.startsAt), zone) !== today);
  return <>
    {header}
    {!appointments.length ? <EmptyState icon={CalendarDays} title={copy.empty} description={copy.emptyHint} /> : <div className="grid gap-6 xl:grid-cols-12">
      <section aria-labelledby="appointments-today" className="min-w-0 space-y-3 xl:col-span-5">
        <h2 id="appointments-today" className="flex min-h-10 items-center gap-2.5 text-lg font-semibold tracking-tight">{copy.today}
          <span className={cn("inline-flex min-w-7 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", todays.length ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}><span className="sr-only">· </span>{todays.length}</span></h2>
        {todays.length ? <AppointmentList appointments={todays} timeZone={zone} showDate={false} showSalesperson={owner} /> : <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground shadow-xs">{copy.noneToday}</p>}
      </section>
      <section aria-labelledby="appointments-upcoming" className="min-w-0 space-y-3 xl:col-span-7">
        <h2 id="appointments-upcoming" className="flex min-h-10 items-center gap-2.5 text-lg font-semibold tracking-tight">{copy.upcoming}
          <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground"><span className="sr-only">· </span>{later.length}</span></h2>
        {later.length ? <AppointmentList appointments={later} timeZone={zone} showDate showSalesperson={owner} /> : <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground shadow-xs">{copy.noneUpcoming}</p>}
      </section>
    </div>}
  </>;
}
