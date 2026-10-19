import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, CarFront, ChevronRight, Percent, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/shared/avatar";
import { Board, type BoardColumn, type BoardGroup } from "@/components/shared/board";
import { BarChart, ChartCard } from "@/components/shared/charts";
import { formatValue } from "@/components/shared/charts/format";
import { PageHeader } from "@/components/shared/page-header";
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
  const sold: BoardGroup[] = [{ id: "sales", title: copy.soldGroup, color: "#0B875E", items: sales.map((sale) => ({ id: sale.vehicleId, values: {
    vehicle: { text: `${sale.year} ${sale.make} ${sale.model}`, href: `/crm/inventory/${sale.vehicleId}`, description: [sale.stockNo, sale.trim].filter(Boolean).join(" · "), imageUrl: sale.photo },
    soldAt: sale.soldAt, price: sale.price, commission: sale.commission,
  } })) }];
  const chartData = months.map((month) => ({ label: month.label, values: { units: month.units, commission: month.commission } }));
  const fileSlug = user.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || user.id;
  const leadName = (leadId: string) => leads.find((lead) => lead.id === leadId)?.name ?? copy.unknownCustomer;
  const target = user.monthlyTarget;
  const contact: [string, React.ReactNode][] = [
    [copy.phone, user.phone ? <a key="phone" href={`tel:${user.phone}`} className="underline decoration-white/30 underline-offset-4 hover:decoration-current focus-visible:outline-2 focus-visible:outline-ring">{user.phone}</a> : copy.none],
    [copy.email, <a key="email" href={`mailto:${user.email}`} className="break-all underline decoration-white/30 underline-offset-4 hover:decoration-current focus-visible:outline-2 focus-visible:outline-ring">{user.email}</a>],
    [copy.hired, user.hiredAt ? new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(user.hiredAt)) : copy.none],
    [copy.target, target === null ? copy.none : copy.units(target)],
  ];
  const inkLabel = "text-[0.6875rem] leading-4 font-semibold uppercase tracking-[0.08em] text-ink-muted";
  const empty = "rounded-2xl border border-dashed bg-card p-5 text-sm text-muted-foreground";
  return <>
    <PageHeader
      eyebrow={<Link href="/crm/team" className="-my-3 inline-flex min-h-11 items-center gap-1.5 rounded-md transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"><ArrowLeft aria-hidden className="size-3.5" />{copy.back}</Link>}
      title={<span className="flex min-w-0 items-center gap-4"><Avatar name={user.name} size="lg" className="size-14 text-lg shadow-sm sm:size-16 sm:text-xl" /><span className="min-w-0 break-words">{user.name}</span></span>}
      description={<span className="flex flex-wrap items-center gap-2"><span>{location}</span>
        {!user.active && <span className="inline-flex min-h-6 items-center gap-1.5 rounded-full bg-muted px-2.5 text-xs font-semibold text-muted-foreground"><span aria-hidden className="size-1.5 rounded-full bg-muted-foreground/60" />{copy.inactive}</span>}</span>}
      actions={<StaffFormSheet user={user} dealerships={dealerships} primaryColor={settings.brand.primaryColor} />} />

    <section aria-label={copy.profile} className="ink-glow rounded-[1.25rem] bg-ink p-5 text-ink-foreground sm:p-6">
      <div className="grid gap-6 xl:grid-cols-12 xl:items-center xl:gap-8">
        <div className="grid gap-3 sm:grid-cols-2 xl:col-span-7">
          <div className="min-w-0 rounded-2xl border border-white/[0.07] bg-white/[0.05] p-5">
            <p className={inkLabel}>{copy.soldThisMonth}</p>
            <p className="font-display mt-3 text-[2.25rem] leading-none font-semibold tabular-nums sm:text-[2.5rem]">{stats.unitsThisMonth}{target !== null && <span className="text-xl text-ink-muted"> / {target}</span>}</p>
            {target ? <span aria-hidden className="mt-4 block h-1.5 overflow-hidden rounded-full bg-white/10">
              <span className={cn("block h-full rounded-full", stats.unitsThisMonth >= target ? "bg-success" : "bg-primary")} style={{ width: `${Math.min(100, (stats.unitsThisMonth / target) * 100)}%` }} />
            </span> : null}
          </div>
          <div className="min-w-0 rounded-2xl border border-white/[0.07] bg-white/[0.05] p-5">
            <p className={inkLabel}>{copy.commissionThisMonth}</p>
            <p className="font-display mt-3 truncate text-[2.25rem] leading-none font-semibold tabular-nums sm:text-[2.5rem]">{formatValue(stats.commissionThisMonth, "money", true)}</p>
          </div>
        </div>
        <dl className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2 xl:col-span-5">
          {contact.map(([label, value]) => <div key={label} className="min-w-0"><dt className={inkLabel}>{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}
        </dl>
      </div>
    </section>

    <KpiRow label={copy.profileKpis} className="md:grid-cols-4 2xl:grid-cols-4">
      <StatCard label={copy.openLeads} icon={UserPlus} value={stats.openLeads} href={`/crm/leads?assignedTo=${user.id}`} />
      <StatCard label={copy.vehicles} icon={CarFront} value={stats.workingVehicles} />
      <StatCard label={copy.appointmentsWeek} icon={CalendarClock} value={stats.appointmentsThisWeek} />
      <StatCard label={copy.conversion} icon={Percent} value={formatPercent(stats.conversion)} hint={copy.record(stats.won, stats.lost)} />
    </KpiRow>

    <div className="grid gap-4 sm:gap-5 xl:grid-cols-12">
      <ChartCard title={copy.commissionChart} description={copy.chartsTitle} className="xl:col-span-7"><BarChart title={copy.commissionChart} height={260} data={chartData} series={[{ key: "commission", label: copy.series.commission }]} format="money" /></ChartCard>
      <ChartCard title={copy.unitsChart} description={copy.chartsTitle} className="xl:col-span-5"><BarChart title={copy.unitsChart} height={260} data={chartData} series={[{ key: "units", label: copy.series.units }]} /></ChartCard>
    </div>

    <section aria-labelledby="profile-upcoming" className="space-y-4"><h2 id="profile-upcoming" className="text-lg font-semibold tracking-tight">{copy.upcoming}</h2>
      {!upcoming.length ? <p className={empty}>{copy.upcomingEmpty}</p>
        : <ul className="divide-y overflow-clip rounded-2xl border bg-card shadow-xs">{upcoming.map((entry) => <li key={entry.id}><Link href={`/crm/leads/${entry.leadId}`} className="group flex min-h-16 items-center gap-3.5 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:px-5">
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-info/12 text-info"><CalendarClock className="size-5" /></span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{leadName(entry.leadId)}</span><span className="block truncate text-sm text-muted-foreground">{vehicleName(entry.vehicleId)}</span></span>
          <time dateTime={entry.startsAt} className="shrink-0 text-right text-sm font-medium tabular-nums">{when.format(new Date(entry.startsAt))}</time>
          <ChevronRight aria-hidden className="hidden size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 sm:block" />
        </Link></li>)}</ul>}
    </section>
    <section aria-labelledby="profile-pipeline" className="space-y-4"><h2 id="profile-pipeline" className="text-lg font-semibold tracking-tight">{copy.pipeline}</h2>
      {!leads.length ? <p className={empty}>{copy.pipelineEmpty}</p>
        : <Board label={copy.pipeline} columns={pipelineColumns} groups={pipeline} hideEmptyGroups exportName={`leads-${fileSlug}`} />}
    </section>
    <section aria-labelledby="profile-sold" className="space-y-4"><h2 id="profile-sold" className="text-lg font-semibold tracking-tight">{copy.soldVehicles}</h2>
      {!sales.length ? <p className={empty}>{copy.soldEmpty}</p>
        : <Board label={copy.soldVehicles} columns={soldColumns} groups={sold} exportName={`sales-${fileSlug}`} />}
    </section>
  </>;
}
