import Link from "next/link";
import { BadgeDollarSign, CalendarClock, CarFront, UserPlus } from "lucide-react";
import { formatValue } from "@/components/shared/charts/format";
import { KpiRow, StatCard } from "@/components/shared/stats/stat-card";
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
  return <>
    <header><h1 className="text-3xl font-semibold tracking-tight">{shellCopy.sections.dashboard.label}</h1>
      <p className="mt-2 break-words text-sm text-muted-foreground">{copy.greeting(user.name)} {copy.introMine}</p></header>

    <KpiRow label={copy.myKpis}>
      <StatCard label={copy.openLeads} icon={UserPlus} value={data.openLeads} hint={copy.carsWorking(data.workingVehicles)} href="/crm/leads" />
      <StatCard label={copy.appointmentsToday} icon={CalendarClock} value={appointments.length} href="/crm/leads/appointments" />
      <StatCard label={copy.mySales} icon={CarFront} value={month.target === null ? month.units : `${month.units} / ${month.target}`}
        hint={month.target === null ? copy.noTarget : copy.toGo(month.target - month.units)} href={mySales} />
      <StatCard label={copy.myCommission} icon={BadgeDollarSign} value={month.commission} format="money" hint={copy.commissionFrom(formatValue(month.revenue, "money"))} href={mySales} />
    </KpiRow>

    <section aria-labelledby="dashboard-appointments" className="space-y-3">
      <SectionHeading id="dashboard-appointments" title={copy.todaysAppointments} action={<Link href="/crm/leads/appointments" className={textLink}>{copy.viewAppointments}</Link>} />
      {appointments.length ? <AppointmentList appointments={appointments} timeZone={timeZone} showDate={false} showSalesperson={false} />
        : <p className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">{copy.noAppointments}</p>}
    </section>

    <NeedsAttention data={data.attention} repairStatusKey={settings.statusRoles.repair} />

    <div className="grid gap-6 lg:grid-cols-2">
      <section aria-labelledby="dashboard-reminders" className="min-w-0 space-y-3">
        <SectionHeading id="dashboard-reminders" title={copy.reminders} hint={copy.remindersHint} action={<Link href="/crm/alerts?category=reminders" className={textLink}>{copy.allReminders}</Link>} />
        {data.reminders.length ? <AlertsList notifications={data.reminders} times={reminderTimes} summary={false} />
          : <p className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">{copy.noReminders}</p>}
      </section>
      <section aria-labelledby="dashboard-activity" className="min-w-0 space-y-3">
        <SectionHeading id="dashboard-activity" title={copy.recent} />
        <ActivityList activity={data.activity} timeZone={timeZone} />
      </section>
    </div>
  </>;
}
