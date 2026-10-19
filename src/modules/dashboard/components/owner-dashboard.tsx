import Link from "next/link";
import { BadgeDollarSign, CarFront, Hourglass, Percent, UserPlus, Wallet } from "lucide-react";
import { BarChart, ChartCard, FunnelChart } from "@/components/shared/charts";
import { formatValue } from "@/components/shared/charts/format";
import { KpiRow, StatCard } from "@/components/shared/stats/stat-card";
import { requestNow } from "@/lib/clock";
import { requirePageUser } from "@/modules/auth/page-guards";
import { AppointmentList, describeAppointments } from "@/modules/appointments/components/appointments-screen";
import { NeedsAttention } from "@/modules/notifications/components/needs-attention";
import { getOwnerDashboard, type AgingBucket } from "../service";
import { dashboardCopy as copy } from "../copy";
import { ActivityList, Leaderboard, LocationFilter, SectionHeading, StockByLocation, boardHref, textLink } from "./parts";

/** Owner Command Center: "how is the business doing today?", for every location or one. */
export async function OwnerDashboard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePageUser("owner");
  const query = await searchParams;
  const now = requestNow();
  const data = await getOwnerDashboard({ dealershipId: typeof query.dealershipId === "string" ? query.dealershipId : undefined }, now);
  const { settings, dealerships, dealershipId, stock, leads, sales, attention, timeZone } = data;
  const roles = settings.statusRoles;
  const at = (path: string, params: Record<string, string | number | undefined> = {}) => boardHref(path, { ...params, dealershipId });
  const locationName = dealerships.find((entry) => entry.id === dealershipId)?.name;
  const appointments = await describeAppointments(data.appointments);

  const targets = sales.leaderboard.filter((row) => row.user.active && row.user.monthlyTarget !== null);
  const teamTarget = targets.reduce((sum, row) => sum + (row.user.monthlyTarget ?? 0), 0);
  const { warnDays, criticalDays } = settings.inventoryAging;
  const bucketColor = (bucket: AgingBucket) => bucket.min > criticalDays ? "var(--danger)" : bucket.max !== null && bucket.max <= warnDays ? "var(--success)" : "var(--warning)";

  return <>
    <header className="space-y-3">
      <div><h1 className="text-3xl font-semibold tracking-tight">{copy.commandCenter}</h1>
        <p className="mt-2 break-words text-sm text-muted-foreground">{copy.greeting(user.name)} {locationName ? copy.introLocation(locationName) : copy.intro}</p></div>
      <LocationFilter dealerships={dealerships.filter((entry) => entry.active || entry.id === dealershipId)} current={dealershipId} />
    </header>

    <KpiRow label={copy.kpis} className="xl:grid-cols-3">
      <StatCard label={copy.inventoryValue} icon={Wallet} value={stock.value} format="money" hint={copy.inStock(stock.units)} href={at("/crm/inventory")} />
      <StatCard label={copy.averageDays} icon={Hourglass} value={stock.averageDays === null ? copy.none : copy.days(stock.averageDays)}
        hint={copy.agingHint(stock.aging, warnDays)} href={at("/crm/inventory", { aging: 1 })} />
      <StatCard label={copy.leadsThisMonth} icon={UserPlus} value={leads.thisMonth} hint={copy.leadsToday(leads.today)} href={at("/crm/leads", { view: "list" })} />
      <StatCard label={copy.conversion} icon={Percent} value={leads.conversion === null ? copy.none : formatValue(leads.conversion, "percent")}
        hint={copy.conversionHint} href={at("/crm/leads", { view: "list", stage: settings.wonStageKey })} />
      <StatCard label={copy.salesThisMonth} icon={CarFront} value={sales.thisMonth.revenue} format="money"
        hint={teamTarget && !dealershipId ? copy.unitsOfTarget(sales.thisMonth.units, teamTarget) : copy.units(sales.thisMonth.units)}
        href={at("/crm/inventory", { status: roles.sold })} />
      <StatCard label={copy.commissionPayable} icon={BadgeDollarSign} value={sales.thisMonth.commission} format="money" hint={copy.commissionHint} href="/crm/team/commissions" />
    </KpiRow>

    <section aria-labelledby="dashboard-status" className="space-y-3">
      <SectionHeading id="dashboard-status" title={copy.unitsByStatus} hint={copy.unitsByStatusHint} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{stock.statuses.map((status) => <StatCard key={status.key} label={status.label} color={status.color}
        value={stock.byStatus[status.key] ?? 0} hint={status.key === roles.sold ? copy.soldThisMonth : undefined} href={at("/crm/inventory", { status: status.key })} />)}</div>
    </section>

    <NeedsAttention data={attention} repairStatusKey={roles.repair} dealershipId={dealershipId} />

    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title={copy.leaderboard} description={copy.leaderboardHint} action={<Link href="/crm/team" className={textLink}>{copy.openTeam}</Link>}>
        <Leaderboard rows={sales.leaderboard} locationName={dealershipId ? undefined : (id) => dealerships.find((entry) => entry.id === id)?.name ?? ""} />
      </ChartCard>
      <ChartCard title={copy.salesByMonth} description={copy.salesByMonthHint}>
        <BarChart title={copy.salesByMonth} format="money" series={[{ key: "revenue", label: copy.revenue }]}
          data={sales.months.map((month) => ({ label: month.label, href: `/crm/team/commissions?month=${month.key}`, values: { revenue: month.revenue } }))} />
      </ChartCard>
      <ChartCard title={copy.funnel} description={copy.funnelHint(leads.lost)}>
        {leads.total ? <FunnelChart title={copy.funnel} conversionLabel={copy.ofLeads}
          steps={leads.steps.map((step) => ({ key: step.key, label: step.label, value: step.value, color: step.color, href: at("/crm/leads", { view: "list", stage: step.key }) }))} />
          : <p className="text-sm text-muted-foreground">{copy.noLeads}</p>}
      </ChartCard>
      <ChartCard title={copy.aging} description={copy.agingChartHint(warnDays, criticalDays)}>
        <BarChart title={copy.aging} height={200} series={[{ key: "cars", label: copy.cars }]}
          data={stock.buckets.map((bucket) => ({ label: copy.bucket(bucket.min, bucket.max), color: bucketColor(bucket), values: { cars: bucket.count },
            href: at("/crm/inventory", { minDays: bucket.min, maxDays: bucket.max ?? undefined }) }))} />
      </ChartCard>
      <ChartCard title={copy.stockByLocation} description={copy.stockByLocationHint} className="lg:col-span-2">
        <StockByLocation rows={stock.byLocation} statuses={stock.statuses} />
      </ChartCard>
    </div>

    <div className="grid gap-6 lg:grid-cols-2">
      <section aria-labelledby="dashboard-appointments" className="min-w-0 space-y-3">
        <SectionHeading id="dashboard-appointments" title={copy.todaysAppointments} action={<Link href="/crm/leads/appointments" className={textLink}>{copy.viewAppointments}</Link>} />
        {appointments.length ? <AppointmentList appointments={appointments} timeZone={timeZone} showDate={false} showSalesperson />
          : <p className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">{copy.noAppointments}</p>}
      </section>
      <section aria-labelledby="dashboard-activity" className="min-w-0 space-y-3">
        <SectionHeading id="dashboard-activity" title={copy.recent} />
        <ActivityList activity={data.activity} timeZone={timeZone} />
      </section>
    </div>
  </>;
}
