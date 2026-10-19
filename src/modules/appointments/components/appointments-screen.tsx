import { requestNow } from "@/lib/clock";
import Link from "next/link";
import { CalendarDays, CalendarRange, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { requirePageUser } from "@/modules/auth/page-guards";
import { getVehicleSummaries } from "@/modules/inventory/service";
import { getLeadSummaries } from "@/modules/leads/service";
import { leadsCopy } from "@/modules/leads/copy";
import { LeadsTabs } from "@/modules/leads/components/leads-tabs";
import { getSettings } from "@/modules/settings/service";
import { getStaffNames, listSalespeople } from "@/modules/users/service";
import { listDealerships } from "@/modules/dealerships/service";
import { listStaffAppointments, type StaffAppointment } from "../service";
import { localDate, startOfLocalDay } from "../slots";
import { appointmentsCopy as copy } from "../copy";
import { AppointmentsCalendar } from "./appointments-calendar";

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
  return <ul className="divide-y rounded-xl border bg-card">{appointments.map((entry) => {
    const body = <>
      <span className="flex w-20 shrink-0 flex-col text-sm font-semibold tabular-nums">
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
      ? <Link href={`/crm/leads/${entry.leadId}`} className="flex min-h-16 items-start gap-3 p-4 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring">{body}</Link>
      : <div className="flex min-h-16 items-start gap-3 p-4">{body}</div>}</li>;
  })}</ul>;
}

export async function AppointmentsScreen({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePageUser();
  const query = await searchParams;
  const text = (key: string) => typeof query[key] === "string" ? query[key] : undefined;
  const week = query.view === "week";
  const settings = await getSettings();
  const zone = settings.booking.timeZone;
  const now = requestNow();
  const owner = user.role === "owner";
  const header = <header className="space-y-4">
    <div><h1 className="text-3xl font-semibold tracking-tight">{leadsCopy.title}</h1><p className="mt-2 text-sm text-muted-foreground">{owner ? copy.intro : copy.introMine}</p></div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <LeadsTabs active="appointments" />
      <nav aria-label={copy.viewLabel} className="inline-flex rounded-lg border bg-card p-0.5">
        {(["list", "week"] as const).map((entry) => {
          const Icon = entry === "list" ? List : CalendarRange;
          const active = (entry === "week") === week;
          return <Link key={entry} href={entry === "week" ? "/crm/leads/appointments?view=week" : "/crm/leads/appointments"} aria-current={active ? "page" : undefined}
            className={cn("inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-medium", active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
            <Icon aria-hidden className="size-4" />{copy.views[entry]}</Link>;
        })}
      </nav>
    </div>
  </header>;
  if (week) {
    const [dealerships, salespeople] = await Promise.all([owner ? listDealerships() : [], owner ? listSalespeople() : []]);
    return <>{header}<AppointmentsCalendar query={{ week: text("week"), dealershipId: text("dealershipId"), salespersonId: text("salespersonId") }} settings={settings} now={now} owner={owner}
      dealerships={dealerships.filter((entry) => entry.active)} salespeople={salespeople.map((entry) => ({ id: entry.id, name: entry.name, dealershipId: entry.dealershipId }))} /></>;
  }
  const appointments = await describeAppointments(await listStaffAppointments(new Date(startOfLocalDay(now, zone)).toISOString()));
  const today = localDate(now, zone);
  const todays = appointments.filter((entry) => localDate(Date.parse(entry.startsAt), zone) === today);
  const later = appointments.filter((entry) => localDate(Date.parse(entry.startsAt), zone) !== today);
  return <>
    {header}
    {!appointments.length ? <EmptyState icon={CalendarDays} title={copy.empty} description={copy.emptyHint} /> : <>
      <section aria-labelledby="appointments-today" className="space-y-3">
        <h2 id="appointments-today" className="font-semibold">{copy.today} <span className="font-normal text-muted-foreground">· {todays.length}</span></h2>
        {todays.length ? <AppointmentList appointments={todays} timeZone={zone} showDate={false} showSalesperson={owner} /> : <p className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">{copy.noneToday}</p>}
      </section>
      <section aria-labelledby="appointments-upcoming" className="space-y-3">
        <h2 id="appointments-upcoming" className="font-semibold">{copy.upcoming} <span className="font-normal text-muted-foreground">· {later.length}</span></h2>
        {later.length ? <AppointmentList appointments={later} timeZone={zone} showDate showSalesperson={owner} /> : <p className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">{copy.noneUpcoming}</p>}
      </section>
    </>}
  </>;
}
