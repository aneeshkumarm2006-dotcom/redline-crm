import Link from "next/link";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Board, type BoardColumn, type BoardGroup } from "@/components/shared/board";
import { BarChart, ChartCard } from "@/components/shared/charts";
import { EmptyState } from "@/components/shared/empty-state";
import { KpiRow, StatCard } from "@/components/shared/stats/stat-card";
import { requestNow } from "@/lib/clock";
import { colorFromName } from "@/lib/color";
import { requirePageUser } from "@/modules/auth/page-guards";
import { StaffFormSheet } from "@/modules/users/components/staff-form";
import { getTeamPerformance, type SalespersonStats } from "../service";
import { salesCopy as copy } from "../copy";

/** Owner board of salespeople grouped by location (inactive accounts in their own collapsed group). */
export async function TeamScreen() {
  await requirePageUser("owner");
  const { people, months, dealerships, settings } = await getTeamPerformance(requestNow());
  const active = people.filter((entry) => entry.user.active);
  const columns: BoardColumn[] = [
    { id: "person", header: copy.columns.person, cell: "person", width: 220 },
    { id: "phone", header: copy.columns.phone, cell: "label", width: 150, hideOnMobile: true },
    { id: "openLeads", header: copy.columns.openLeads, cell: "number", width: 104 },
    { id: "vehicles", header: copy.columns.vehicles, cell: "number", width: 112 },
    { id: "appointments", header: copy.columns.appointments, cell: "number", width: 128 },
    { id: "sales", header: copy.columns.sales, cell: "progress", width: 190 },
    { id: "commission", header: copy.columns.commission, cell: "money", width: 150 },
    { id: "conversion", header: copy.columns.conversion, cell: "number", format: "percent", width: 112 },
  ];
  const item = (entry: SalespersonStats) => ({
    id: entry.user.id,
    values: {
      person: { name: entry.user.name, detail: entry.user.active ? entry.user.email : copy.inactive, href: `/crm/team/${entry.user.id}` },
      phone: entry.user.phone ? { text: entry.user.phone } : null,
      openLeads: entry.openLeads, vehicles: entry.workingVehicles, appointments: entry.appointmentsThisWeek,
      sales: { value: entry.unitsThisMonth, max: entry.user.monthlyTarget ?? 0, label: copy.progress(entry.unitsThisMonth, entry.user.monthlyTarget) },
      commission: entry.commissionThisMonth, conversion: entry.conversion,
    },
  });
  // Best month first within each location.
  const ranked = (list: SalespersonStats[]) => list.toSorted((a, b) => b.unitsThisMonth - a.unitsThisMonth || b.commissionThisMonth - a.commissionThisMonth || a.user.name.localeCompare(b.user.name));
  const groups: BoardGroup[] = [
    ...dealerships.filter((dealership) => dealership.active || active.some((entry) => entry.user.dealershipId === dealership.id)).map((dealership) => ({
      id: dealership.id, title: dealership.name, color: colorFromName(dealership.name),
      items: ranked(active.filter((entry) => entry.user.dealershipId === dealership.id)).map(item),
    })),
    { id: "inactive", title: copy.inactiveGroup, color: "#94A3B8", collapsed: true, items: ranked(people.filter((entry) => !entry.user.active)).map(item) },
  ];
  const sum = (pick: (entry: SalespersonStats) => number) => active.reduce((total, entry) => total + pick(entry), 0);
  const targets = active.filter((entry) => entry.user.monthlyTarget !== null);
  const teamTarget = targets.reduce((total, entry) => total + (entry.user.monthlyTarget ?? 0), 0);
  const thisMonth = months[months.length - 1];
  const chartData = months.map((month) => ({ label: month.label, values: { units: month.units, commission: month.commission } }));
  return <>
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-3xl font-semibold tracking-tight">{copy.title}</h1><p className="mt-2 text-sm text-muted-foreground">{copy.intro}</p></div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" className="min-h-11"><Link href="/crm/team/commissions">{copy.commissionReport}</Link></Button>
        <StaffFormSheet dealerships={dealerships}primaryColor={settings.brand.primaryColor} />
      </div>
    </header>
    {!people.length ? <EmptyState icon={Users} title={copy.empty} description={copy.emptyHint} /> : <>
      <KpiRow label={copy.kpis}>
        <StatCard label={copy.unitsThisMonth} value={thisMonth?.units ?? 0} hint={targets.length ? copy.targetHint(teamTarget) : copy.noTarget} />
        <StatCard label={copy.revenueThisMonth} value={thisMonth?.revenue ?? 0} format="money" />
        <StatCard label={copy.commissionThisMonth} value={thisMonth?.commission ?? 0} format="money" href="/crm/team/commissions" />
        <StatCard label={copy.openLeads} value={sum((entry) => entry.openLeads)} href="/crm/leads" />
      </KpiRow>
      <Board label={copy.board} columns={columns} groups={groups} hideEmptyGroups exportName="team" />
      <p className="text-xs text-muted-foreground">{copy.columns.conversion}: {copy.conversionHint}</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title={copy.unitsChart} description={copy.chartsTitle}><BarChart title={copy.unitsChart} data={chartData} series={[{ key: "units", label: copy.series.units }]} /></ChartCard>
        <ChartCard title={copy.commissionChart} description={copy.chartsTitle}><BarChart title={copy.commissionChart} data={chartData} series={[{ key: "commission", label: copy.series.commission }]} format="money" /></ChartCard>
      </div>
    </>}
  </>;
}
