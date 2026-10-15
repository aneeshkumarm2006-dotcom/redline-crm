import { requestNow } from "@/lib/clock";
import Link from "next/link";
import { CalendarClock, CarFront, ChevronRight, UserPlus } from "lucide-react";
import { requirePageUser } from "@/modules/auth/page-guards";
import { listStaffAppointments } from "@/modules/appointments/service";
import { localDate, startOfLocalDay } from "@/modules/appointments/slots";
import { AppointmentList, describeAppointments } from "@/modules/appointments/components/appointments-screen";
import { getInventorySummary, listRecentVehicleActivity } from "@/modules/inventory/service";
import { formatTimestamp } from "@/modules/inventory/copy";
import { countLeadsSince, listRecentLeadActivity } from "@/modules/leads/service";
import { getSettings } from "@/modules/settings/service";
import { getStaffNames } from "@/modules/users/service";
import { shellCopy } from "@/components/shared/app-shell/copy";
import { dashboardCopy as copy } from "../copy";

function StatTile({ href, label, value, icon: Icon, action }: { href: string; label: string; value: number; icon: typeof UserPlus; action: string }) {
  return <Link href={href} aria-label={`${label}: ${value}. ${action}`} className="group flex min-w-0 flex-col justify-between gap-3 rounded-2xl border bg-card p-4 shadow-xs transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring">
    <span className="flex items-center justify-between gap-2 text-sm text-muted-foreground">{label}<Icon aria-hidden className="size-5 shrink-0 text-primary" /></span>
    <span className="text-4xl font-semibold tabular-nums tracking-tight">{value}</span>
  </Link>;
}

export async function DashboardScreen() {
  const user = await requirePageUser();
  const owner = user.role === "owner";
  const settings = await getSettings();
  const zone = settings.booking.timeZone;
  const now = requestNow();
  const dayStart = new Date(startOfLocalDay(now, zone)).toISOString();
  const [newLeads, appointments, stock, leadActivity, vehicleActivity] = await Promise.all([
    countLeadsSince(dayStart), listStaffAppointments(dayStart), getInventorySummary(), listRecentLeadActivity(10), listRecentVehicleActivity(10),
  ]);
  const today = localDate(now, zone);
  const todays = await describeAppointments(appointments.filter((entry) => localDate(Date.parse(entry.startsAt), zone) === today));
  const activity = [
    ...leadActivity.map((entry) => ({ ...entry, href: `/crm/leads/${entry.leadId}`, subject: entry.name })),
    ...vehicleActivity.map((entry) => ({ ...entry, href: `/crm/inventory/${entry.vehicleId}`, subject: `${entry.name} · ${entry.stockNo}` })),
  ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 10);
  const names = await getStaffNames([...new Set(activity.flatMap((entry) => entry.actorId ? [entry.actorId] : []))]);
  const actor = (entry: (typeof activity)[number]) => entry.actorId ? names.find((item) => item.id === entry.actorId)?.name ?? copy.formerStaff
    : entry.type === "lead.assigned" ? copy.automatic : copy.customer;
  const statusCount = (key: string) => stock.filter((row) => row.status === key).reduce((sum, row) => sum + row.count, 0);
  return <>
    <header><h1 className="text-3xl font-semibold tracking-tight">{shellCopy.sections.dashboard.label}</h1><p className="mt-2 break-words text-sm text-muted-foreground">{copy.greeting(user.name)} {owner ? copy.intro : copy.introMine}</p></header>
    <div className="grid grid-cols-2 gap-3">
      <StatTile href="/crm/leads" label={copy.newLeads} value={newLeads} icon={UserPlus} action={copy.viewLeads} />
      <StatTile href="/crm/leads/appointments" label={copy.appointmentsToday} value={todays.length} icon={CalendarClock} action={copy.viewAppointments} />
    </div>
    <section aria-labelledby="dashboard-stock" className="space-y-3">
      <div><h2 id="dashboard-stock" className="font-semibold">{copy.stock}</h2><p className="text-xs text-muted-foreground">{copy.stockHint}</p></div>
      <div className="grid grid-cols-3 gap-3">{settings.vehicleStatuses.map((status) => <Link key={status.key} href={`/crm/inventory?status=${encodeURIComponent(status.key)}`} data-status={status.key}
        className="min-w-0 rounded-2xl border bg-card p-4 shadow-xs transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: status.color }} /><span className="truncate">{status.label}</span></span>
        <span className="mt-2 block text-2xl font-semibold tabular-nums">{statusCount(status.key)}</span>
      </Link>)}</div>
    </section>
    <section aria-labelledby="dashboard-appointments" className="space-y-3">
      <h2 id="dashboard-appointments" className="font-semibold">{copy.todaysAppointments}</h2>
      {todays.length ? <AppointmentList appointments={todays} timeZone={zone} showDate={false} showSalesperson={owner} />
        : <p className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">{copy.noAppointments}</p>}
    </section>
    <section aria-labelledby="dashboard-activity" className="space-y-3">
      <h2 id="dashboard-activity" className="font-semibold">{copy.recent}</h2>
      {!activity.length ? <p className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">{copy.noActivity}</p>
        : <ol className="divide-y rounded-xl border bg-card">{activity.map((entry, index) => <li key={`${entry.href}-${entry.occurredAt}-${index}`}>
          <Link href={entry.href} className="flex min-h-16 items-center gap-3 p-4 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">{"vehicleId" in entry ? <CarFront aria-hidden className="size-5 text-muted-foreground" /> : <UserPlus aria-hidden className="size-5 text-muted-foreground" />}</span>
            <span className="min-w-0 flex-1">
              <span className="block break-words text-sm font-medium">{entry.subject}</span>
              <span className="block break-words text-sm">{entry.message}</span>
              <span className="block text-xs text-muted-foreground">{actor(entry)} · {formatTimestamp(entry.occurredAt, zone)}</span>
            </span>
            <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        </li>)}</ol>}
    </section>
  </>;
}
