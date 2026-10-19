import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/shared/avatar";
import { Board, type BoardColumn, type BoardGroup } from "@/components/shared/board";
import { BarChart, ChartCard } from "@/components/shared/charts";
import { KpiRow, StatCard } from "@/components/shared/stats/stat-card";
import { requestNow } from "@/lib/clock";
import { requirePageUser } from "@/modules/auth/page-guards";
import { getVehicleSummaries } from "@/modules/inventory/service";
import { StaffFormSheet } from "@/modules/users/components/staff-form";
import { getSalespersonPerformance } from "../service";
import { formatPercent, salesCopy as copy } from "../copy";

/** Owner profile of one salesperson: KPIs, 6-month history, pipeline, sold cars and upcoming appointments. */
export async function SalespersonScreen({ params }: { params: Promise<{ id: string }> }) {
  await requirePageUser("owner");
  const { id } = await params;
  const now = requestNow();
  const data = await getSalespersonPerformance(id, now);
  if (!data) notFound();
  const { user, stats, months, leads, sales, upcoming, settings, dealerships, timeZone } = data;
  const vehicles = await getVehicleSummaries([...new Set([...leads.map((lead) => lead.vehicleId), ...upcoming.map((entry) => entry.vehicleId)])]);
  const vehicleName = (vehicleId: string) => { const vehicle = vehicles.find((entry) => entry.id === vehicleId); return vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : copy.unknownVehicle; };
  const location = dealerships.find((entry) => entry.id === user.dealershipId)?.name ?? copy.unknownLocation;
  const when = new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone });
  const sources = settings.leadSources;
  const stages = settings.leadStages.toSorted((a, b) => a.order - b.order);
  const closed = new Set([settings.wonStageKey, settings.lostStageKey]);
  const pipelineColumns: BoardColumn[] = [
    { id: "customer", header: copy.pipelineColumns.customer, cell: "link", width: 240 },
    { id: "vehicle", header: copy.pipelineColumns.vehicle, cell: "label", width: 220 },
    { id: "source", header: copy.pipelineColumns.source, cell: "label", width: 140 },
    { id: "created", header: copy.pipelineColumns.created, cell: "date", timeZone },
  ];
  const pipeline: BoardGroup[] = stages.map((stage) => ({
    id: stage.key, title: stage.label, color: stage.color, collapsed: closed.has(stage.key),
    items: leads.filter((lead) => lead.stage === stage.key).map((lead) => {
      const source = sources.find((entry) => entry.key === lead.source);
      return { id: lead.id, values: {
        customer: { text: lead.name, href: `/crm/leads/${lead.id}`, description: lead.phone },
        vehicle: { text: vehicleName(lead.vehicleId) },
        source: source ? { text: source.label, color: source.color } : { text: lead.source },
        created: lead.createdAt,
      } };
    }),
  }));
  const soldColumns: BoardColumn[] = [
    { id: "vehicle", header: copy.soldColumns.vehicle, cell: "link", width: 280 },
    { id: "soldAt", header: copy.soldColumns.soldAt, cell: "date", timeZone },
    { id: "price", header: copy.soldColumns.price, cell: "money" },
    { id: "commission", header: copy.soldColumns.commission, cell: "money" },
  ];
  const sold: BoardGroup[] = [{ id: "sales", title: copy.soldGroup, color: "#15803D", items: sales.map((sale) => ({ id: sale.vehicleId, values: {
    vehicle: { text: `${sale.year} ${sale.make} ${sale.model}`, href: `/crm/inventory/${sale.vehicleId}`, description: [sale.stockNo, sale.trim].filter(Boolean).join(" · "), imageUrl: sale.photo },
    soldAt: sale.soldAt, price: sale.price, commission: sale.commission,
  } })) }];
  const chartData = months.map((month) => ({ label: month.label, values: { units: month.units, commission: month.commission } }));
  const fileSlug = user.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || user.id;
  const leadName = (leadId: string) => leads.find((lead) => lead.id === leadId)?.name ?? copy.unknownCustomer;
  return <>
    <Button asChild variant="ghost" className="min-h-11 self-start"><Link href="/crm/team">← {copy.back}</Link></Button>
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-center gap-4">
        <Avatar name={user.name} size="lg" />
        <div className="min-w-0"><h1 className="break-words text-3xl font-semibold tracking-tight">{user.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{location}{!user.active && ` · ${copy.inactive}`}</p></div>
      </div>
      <StaffFormSheet user={user} dealerships={dealerships} primaryColor={settings.brand.primaryColor} />
    </header>
    <dl className="grid grid-cols-2 gap-4 rounded-xl border bg-card p-4 text-sm sm:grid-cols-4">
      {([
        [copy.phone, user.phone ? <a key="phone" href={`tel:${user.phone}`} className="underline">{user.phone}</a> : copy.none],
        [copy.email, <a key="email" href={`mailto:${user.email}`} className="break-all underline">{user.email}</a>],
        [copy.hired, user.hiredAt ? new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(user.hiredAt)) : copy.none],
        [copy.target, user.monthlyTarget === null ? copy.none : copy.units(user.monthlyTarget)],
      ] as [string, React.ReactNode][]).map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}
    </dl>
    <KpiRow label={copy.profileKpis} className="xl:grid-cols-3">
      <StatCard label={copy.soldThisMonth} value={user.monthlyTarget === null ? stats.unitsThisMonth : `${stats.unitsThisMonth} / ${user.monthlyTarget}`} />
      <StatCard label={copy.commissionThisMonth} value={stats.commissionThisMonth} format="money" />
      <StatCard label={copy.openLeads} value={stats.openLeads} href={`/crm/leads?assignedTo=${user.id}`} />
      <StatCard label={copy.vehicles} value={stats.workingVehicles} />
      <StatCard label={copy.appointmentsWeek} value={stats.appointmentsThisWeek} />
      <StatCard label={copy.conversion} value={formatPercent(stats.conversion)} hint={copy.record(stats.won, stats.lost)} />
    </KpiRow>
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title={copy.unitsChart} description={copy.chartsTitle}><BarChart title={copy.unitsChart} data={chartData} series={[{ key: "units", label: copy.series.units }]} /></ChartCard>
      <ChartCard title={copy.commissionChart} description={copy.chartsTitle}><BarChart title={copy.commissionChart} data={chartData} series={[{ key: "commission", label: copy.series.commission }]} format="money" /></ChartCard>
    </div>
    <section className="space-y-3"><h2 className="text-lg font-semibold">{copy.upcoming}</h2>
      {!upcoming.length ? <p className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">{copy.upcomingEmpty}</p>
        : <ul className="divide-y rounded-xl border bg-card">{upcoming.map((entry) => <li key={entry.id}><Link href={`/crm/leads/${entry.leadId}`} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-muted/40">
          <CalendarClock aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1"><span className="block truncate font-medium">{leadName(entry.leadId)}</span><span className="block truncate text-sm text-muted-foreground">{vehicleName(entry.vehicleId)}</span></span>
          <time dateTime={entry.startsAt} className="shrink-0 text-right text-sm tabular-nums">{when.format(new Date(entry.startsAt))}</time>
        </Link></li>)}</ul>}
    </section>
    <section className="space-y-3"><h2 className="text-lg font-semibold">{copy.pipeline}</h2>
      {!leads.length ? <p className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">{copy.pipelineEmpty}</p>
        : <Board label={copy.pipeline} columns={pipelineColumns} groups={pipeline} hideEmptyGroups exportName={`leads-${fileSlug}`} />}
    </section>
    <section className="space-y-3"><h2 className="text-lg font-semibold">{copy.soldVehicles}</h2>
      {!sales.length ? <p className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">{copy.soldEmpty}</p>
        : <Board label={copy.soldVehicles} columns={soldColumns} groups={sold} exportName={`sales-${fileSlug}`} />}
    </section>
  </>;
}
