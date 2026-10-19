import Link from "next/link";
import { BadgeDollarSign, CalendarClock, CarFront, UserPlus } from "lucide-react";
import { formatValue } from "@/components/shared/charts/format";
import { KpiRow, StatCard } from "@/components/shared/stats/stat-card";
import { PageHeader } from "@/components/shared/page-header";
import { shellCopy } from "@/components/shared/app-shell/copy";
import { requestNow } from "@/lib/clock";
import { requirePageUser } from "@/modules/auth/page-guards";
import { AppointmentList, describeAppointments } from "@/modules/appointments/components/appointments-screen";
import { formatTimestamp } from "@/modules/inventory/copy";
import { AlertsList } from "@/modules/notifications/components/alerts-list";
import { NeedsAttention } from "@/modules/notifications/components/needs-attention";
import { getSalespersonDashboard } from "../service";
import { dashboardCopy as copy } from "../copy";
import { ActivityList, SectionHeading, boardHref, textLink } from "./parts";

/** A salesperson's day: their pipeline, today's appointments, the month against target, reminders and activity. */
export async function SalespersonDashboard() {
  await requirePageUser("salesperson");
  const now = requestNow();
  const data = await getSalespersonDashboard(now);
  const { user, settings, month, timeZone } = data;
  const appointments = await describeAppointments(data.appointments);
  const mySales = boardHref("/crm/inventory", { status: settings.statusRoles.sold, soldBy: user.id });
  const reminderTimes = Object.fromEntries(data.reminders.map((entry) => [entry.id, formatTimestamp(entry.createdAt, timeZone)]));
  const empty = "rounded-2xl border bg-card p-5 text-sm text-muted-foreground shadow-xs";
  return <>
    <PageHeader title={shellCopy.sections.dashboard.label} description={<>{copy.greeting(user.name)} {copy.introMine}</>} />

    <KpiRow label={copy.myKpis} className="md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-4">
      <StatCard label={copy.openLeads} icon={UserPlus} value={data.openLeads} hint={copy.carsWorking(data.workingVehicles)} href="/crm/leads" />
      <StatCard label={copy.appointmentsToday} icon={CalendarClock} value={appointments.length} href="/crm/leads/appointments" />
      <StatCard label={copy.mySales} icon={CarFront} value={month.target === null ? month.units : `${month.units} / ${month.target}`}
        hint={month.target === null ? copy.noTarget : copy.toGo(month.target - month.units)} href={mySales} />
      <StatCard label={copy.myCommission} icon={BadgeDollarSign} value={month.commission} format="money" hint={copy.commissionFrom(formatValue(month.revenue, "money"))} href={mySales} />
    </KpiRow>

    <div className="grid gap-6 xl:grid-cols-12">
      <section aria-labelledby="dashboard-appointments" className="min-w-0 space-y-3 xl:col-span-5">
        <SectionHeading id="dashboard-appointments" title={copy.todaysAppointments} action={<Link href="/crm/leads/appointments" className={textLink}>{copy.viewAppointments}</Link>} />
        {appointments.length ? <AppointmentList appointments={appointments} timeZone={timeZone} showDate={false} showSalesperson={false} />
          : <p className={empty}>{copy.noAppointments}</p>}
      </section>
      <div className="min-w-0 xl:col-span-7"><NeedsAttention variant="ink" data={data.attention} repairStatusKey={settings.statusRoles.repair} /></div>
    </div>

    <div className="grid gap-6 xl:grid-cols-12">
      <section aria-labelledby="dashboard-reminders" className="min-w-0 space-y-3 xl:col-span-5">
        <SectionHeading id="dashboard-reminders" title={copy.reminders} hint={copy.remindersHint} action={<Link href="/crm/alerts?category=reminders" className={textLink}>{copy.allReminders}</Link>} />
        {data.reminders.length ? <AlertsList notifications={data.reminders} times={reminderTimes} summary={false} />
          : <p className={empty}>{copy.noReminders}</p>}
      </section>
      <section aria-labelledby="dashboard-activity" className="min-w-0 space-y-3 xl:col-span-7">
        <SectionHeading id="dashboard-activity" title={copy.recent} />
        <ActivityList activity={data.activity} timeZone={timeZone} />
      </section>
    </div>
  </>;
}
