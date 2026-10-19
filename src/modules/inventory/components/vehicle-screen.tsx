import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeDollarSign, CarFront, ChevronRight, PackagePlus, Tag, Wrench, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadgeView } from "@/components/shared/status-badge-view";
import { StatusPill, resolvePill } from "@/components/shared/status-pill";
import { PageHeader } from "@/components/shared/page-header";
import { PersonChip } from "@/components/shared/avatar";
import { requestNow } from "@/lib/clock";
import { cn } from "@/lib/utils";
import { requirePageUser } from "@/modules/auth/page-guards";
import { listDealerships } from "@/modules/dealerships/service";
import { listGarages } from "@/modules/garages/service";
import { listVehicleLeads } from "@/modules/leads/service";
import { getSettings } from "@/modules/settings/service";
import { getStaffNames, listSalespeople } from "@/modules/users/service";
import { getVehicle } from "../service";
import { vehicleWorkflows, type InventoryVehicle, type VehicleWorkflow } from "../schema";
import { inventoryCopy as copy, daysBetween, formatDate, formatTimestamp, formatPrice, formatMileage, vehicleTitle } from "../copy";
import { VehiclePhoto } from "./vehicle-photo";
import { VehicleControls } from "./vehicle-controls";
import { VehicleForm } from "./vehicle-form";
import { CompleteRepairSheet, MarkSoldSheet, RepairTimer, SendToRepairSheet } from "./vehicle-workflows";

const tabs = ["overview", "repairs", "leads", "timeline"] as const;
type Tab = (typeof tabs)[number];
type TimelineEntry = { at: string; kind: "acquired" | "status" | "price" | "repair" | "sale"; text: string; actorId: string | null };
const timelineIcons: Record<TimelineEntry["kind"], LucideIcon> = { acquired: PackagePlus, status: CarFront, price: Tag, repair: Wrench, sale: BadgeDollarSign };
const timelineTones: Record<TimelineEntry["kind"], string> = { acquired: "bg-info/10 text-info", status: "bg-muted text-foreground/70", price: "bg-brand-soft text-primary", repair: "bg-warning/12 text-warning", sale: "bg-success/12 text-success" };

/** Status, price, repair and sale history merged newest first. Status moves made by a repair or sale show as that workflow. */
function timelineOf(vehicle: InventoryVehicle, labels: { status: (key: string) => string; repairType: (key: string) => string; garage: (id: string) => string; staff: (id: string) => string }): TimelineEntry[] {
  const repairs = [...vehicle.repairHistory, ...(vehicle.repair ? [{ ...vehicle.repair, completedAt: null, cost: null, completedBy: null }] : [])];
  const workflowTimes = new Set([...repairs.flatMap((entry) => [entry.startedAt, entry.completedAt]), vehicle.sale?.soldAt].filter((value): value is string => Boolean(value)));
  const startedBy = (at: string) => vehicle.statusHistory.find((entry) => entry.changedAt === at)?.changedBy ?? null;
  const entries: TimelineEntry[] = [
    { at: vehicle.dateInStock, kind: "acquired", text: copy.timelineEntry.acquired, actorId: null },
    ...vehicle.statusHistory.filter((entry) => !workflowTimes.has(entry.changedAt)).map((entry) => ({ at: entry.changedAt, kind: "status" as const,
      text: copy.timelineEntry.status(labels.status(entry.previousStatus), labels.status(entry.status)), actorId: entry.changedBy })),
    ...vehicle.priceHistory.map((entry) => ({ at: entry.changedAt, kind: "price" as const, text: copy.timelineEntry.price(formatPrice(entry.previousPrice), formatPrice(entry.price)), actorId: entry.changedBy })),
    ...repairs.flatMap((entry) => [
      { at: entry.startedAt, kind: "repair" as const, text: copy.timelineEntry.repairStarted(labels.repairType(entry.typeKey), labels.garage(entry.garageId)), actorId: startedBy(entry.startedAt) },
      ...(entry.completedAt && entry.cost !== null ? [{ at: entry.completedAt, kind: "repair" as const,
        text: copy.timelineEntry.repairCompleted(labels.repairType(entry.typeKey), labels.garage(entry.garageId), formatPrice(entry.cost)), actorId: entry.completedBy }] : []),
    ]),
    ...(vehicle.sale ? [{ at: vehicle.sale.soldAt, kind: "sale" as const,
      text: copy.timelineEntry.sold(labels.staff(vehicle.sale.salespersonId), formatPrice(vehicle.sale.price), formatPrice(vehicle.sale.commission)), actorId: vehicle.sale.recordedBy }] : []),
  ];
  return entries.toSorted((a, b) => b.at.localeCompare(a.at));
}

function Section({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={cn("min-w-0 rounded-2xl border bg-card p-5 shadow-xs sm:p-6", className)}>
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><h2 className="text-[0.9375rem] font-semibold tracking-tight">{title}</h2>{action}</div>
    {children}
  </section>;
}
function Facts({ items, columns = "sm:grid-cols-2", ink = false }: { items: [string, React.ReactNode][]; columns?: string; ink?: boolean }) {
  return <dl className={cn("mt-4 grid grid-cols-2 gap-x-4 gap-y-4", columns)}>{items.map(([label, value]) => <div key={label} className="min-w-0">
    <dt className={ink ? "text-[0.6875rem] leading-4 font-semibold tracking-[0.08em] text-ink-muted uppercase" : "eyebrow"}>{label}</dt>
    <dd className="mt-1 break-words text-sm font-medium tabular-nums">{value}</dd>
  </div>)}</dl>;
}
const tabClass = (active: boolean) => cn("inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  active ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground");

type Params = { params: Promise<{ id: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> };
export async function VehicleScreen({ params, searchParams, edit = false }: Params & { edit?: boolean }) {
  const user = await requirePageUser(...(edit ? ["owner" as const] : []));
  const { id } = await params;
  const vehicle = await getVehicle(id);
  if (!vehicle) notFound();
  const [settings, dealerships] = await Promise.all([getSettings(), listDealerships()]);
  if (edit) return <><PageHeader eyebrow={<span className="font-mono normal-case tracking-normal">{vehicle.stockNo}</span>} title={copy.edit} description={copy.formHint} /><VehicleForm vehicle={vehicle} settings={settings} dealerships={dealerships} today="" /></>;
  const query = (await searchParams) ?? {};
  const tab: Tab = tabs.find((entry) => entry === query.tab) ?? "overview";
  const action: VehicleWorkflow | null = vehicleWorkflows.find((entry) => entry === query.action) ?? null;
  const owner = user.role === "owner";
  const actorIds = [...vehicle.priceHistory.map((entry) => entry.changedBy), ...vehicle.statusHistory.map((entry) => entry.changedBy), ...vehicle.repairHistory.map((entry) => entry.completedBy),
    ...(vehicle.sale ? [vehicle.sale.salespersonId, vehicle.sale.recordedBy] : [])];
  const [leads, names, garages, salespeople] = await Promise.all([listVehicleLeads(id), getStaffNames([...new Set(actorIds)]), listGarages(), owner ? listSalespeople() : []]);
  const now = requestNow();
  const staff = (staffId: string) => names.find((entry) => entry.id === staffId)?.name ?? copy.unknownActor;
  const statusLabel = (key: string) => settings.vehicleStatuses.find((status) => status.key === key)?.label ?? key;
  const stageLabel = (key: string) => settings.leadStages.find((stage) => stage.key === key)?.label ?? key;
  const repairType = (key: string) => settings.repairTypes.find((type) => type.key === key) ?? { key, label: key, color: "#94A3B8" };
  const garage = (garageId: string) => garages.find((entry) => entry.id === garageId);
  const garageName = (garageId: string) => garage(garageId)?.name ?? copy.unknownGarage;
  const title = vehicleTitle(vehicle);
  const ref = { id: vehicle.id, revision: vehicle.revision, stockNo: vehicle.stockNo, title };
  const sold = Boolean(vehicle.sale) || vehicle.status === settings.statusRoles.sold;
  const daysInStock = daysBetween(vehicle.dateInStock, vehicle.sale ? Date.parse(vehicle.sale.soldAt) : now);
  const repairSpend = vehicle.repairHistory.reduce((total, entry) => total + entry.cost, 0);
  const repairDays = vehicle.repair ? daysBetween(vehicle.repair.startedAt, now) : 0;
  const overdue = vehicle.repair !== null && repairDays > settings.repairOverdueDays;
  const commission = vehicle.sale?.commission ?? vehicle.commission;
  const margin = vehicle.acquisitionCost === null ? null : (vehicle.sale?.price ?? vehicle.price) - vehicle.acquisitionCost - repairSpend - commission;
  const timeZone = settings.booking.timeZone;
  const linkedLead = vehicle.sale?.leadId ? leads.find((lead) => lead.id === vehicle.sale?.leadId) : undefined;
  const primaryColor = settings.brand.primaryColor;

  const photos = vehicle.photos.length ? vehicle.photos : [undefined];
  const [cover, ...thumbnails] = photos;

  const currentRepair = vehicle.repair && <div className={cn("rounded-xl p-4 sm:p-5", overdue ? "bg-danger/8" : "bg-muted/60")}>
    <div className="flex flex-wrap items-center gap-2">
      <StatusPill option={repairType(vehicle.repair.typeKey)} className="min-h-7 px-3" />
      <span className="font-medium">{garageName(vehicle.repair.garageId)}</span>
      {overdue && <span className="rounded-full bg-danger px-2.5 py-0.5 text-xs font-semibold text-white">{copy.overdue}</span>}
    </div>
    <p className="eyebrow mt-4">{copy.inRepairFor}</p>
    <RepairTimer startedAt={vehicle.repair.startedAt} serverNow={now} className={cn("font-display mt-1 block text-[2rem] leading-tight font-semibold tabular-nums", overdue && "text-danger")} />
    <Facts items={[
      [copy.started, formatTimestamp(vehicle.repair.startedAt, timeZone)],
      [copy.estimatedCost, vehicle.repair.estimatedCost === null ? "—" : formatPrice(vehicle.repair.estimatedCost)],
      ...(garage(vehicle.repair.garageId)?.phone ? [[copy.garage, <a key="phone" href={`tel:${garage(vehicle.repair.garageId)?.phone}`} className="inline-flex min-h-11 items-center font-medium text-info underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">{garage(vehicle.repair.garageId)?.phone}</a>] as [string, React.ReactNode]] : []),
      ...(vehicle.repair.notes ? [[copy.notes, vehicle.repair.notes] as [string, React.ReactNode]] : []),
    ]} />
  </div>;

  return <>
    <PageHeader
      eyebrow={<Link href="/crm/inventory" className="-my-3 inline-flex min-h-11 items-center gap-1.5 rounded-md transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"><ArrowLeft aria-hidden className="size-3.5" />{copy.back}</Link>}
      title={<span className="font-display">{title}</span>}
      description={<span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-mono text-[0.8125rem] text-foreground">{vehicle.stockNo}</span>
        <StatusPill option={resolvePill(settings.vehicleStatuses, vehicle.status)} className="min-h-6" />
        <span className="tabular-nums">{copy.daysInStock(daysInStock)}</span>
        {vehicle.trim && <span>{vehicle.trim}</span>}
      </span>}
      actions={<>
        <span className="font-display text-[1.75rem] leading-none font-semibold tabular-nums sm:text-[2rem]">{formatPrice(vehicle.price)}</span>
        {owner && <Button asChild variant="outline" className="ml-2 min-h-11"><Link href={`/crm/inventory/${id}/edit`}>{copy.edit}</Link></Button>}
      </>}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label={copy.tabsLabel} className="scrollbar-thin flex w-full gap-1 overflow-x-auto rounded-xl bg-muted p-1 sm:w-fit">{tabs.map((entry) =>
          <Link key={entry} href={entry === "overview" ? `/crm/inventory/${id}` : `/crm/inventory/${id}?tab=${entry}`} aria-current={tab === entry ? "page" : undefined} scroll={false} className={tabClass(tab === entry)}>
            {copy.tabs[entry]}
            {entry === "repairs" && vehicle.repair && <span aria-hidden className={cn("size-2 rounded-full", overdue ? "bg-danger" : "bg-warning")} />}
            {entry === "leads" && leads.length > 0 && <span className="rounded-full bg-foreground/[0.07] px-1.5 text-xs font-semibold tabular-nums">{leads.length}</span>}
          </Link>)}
        </nav>
        <div className="flex min-w-0 flex-wrap items-center gap-2">{owner ? <>
          {vehicle.repair ? <CompleteRepairSheet key={`complete-${action}`} vehicle={ref} estimatedCost={vehicle.repair.estimatedCost} primaryColor={primaryColor} defaultOpen={action === "complete-repair"} />
            : !sold && <>
              <SendToRepairSheet key={`repair-${action}`} vehicle={ref} repairTypes={settings.repairTypes} garages={garages.filter((entry) => entry.active)} primaryColor={primaryColor} defaultOpen={action === "repair"} />
              <MarkSoldSheet key={`sell-${action}`} vehicle={ref} price={vehicle.price} commission={vehicle.commission} primaryColor={primaryColor} defaultOpen={action === "sell"}
                salespeople={salespeople.filter((person) => person.active && person.dealershipId === vehicle.dealershipId)}
                leads={leads.map((lead) => ({ id: lead.id, name: lead.name, stageLabel: stageLabel(lead.stage), assignedTo: lead.assignedTo }))} />
            </>}
          {!sold && <VehicleControls vehicle={vehicle} settings={settings} />}
          <VehicleControls vehicle={vehicle} settings={settings} price />
        </> : <StatusBadgeView kind="vehicle" status={vehicle.status} settings={settings} />}</div>
      </div>
    </PageHeader>

    {tab === "overview" && <div className="grid gap-5 xl:grid-cols-12">
      <div className="min-w-0 space-y-5 xl:col-span-8">
        <section aria-label={copy.photos} className="min-w-0 space-y-3">
          <VehiclePhoto src={cover} alt={`${title} · 1`} className="aspect-[16/10] rounded-2xl border shadow-xs" />
          {thumbnails.length > 0 && <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 2xl:grid-cols-6">{thumbnails.map((src, index) => <li key={`${src}-${index}`} className="min-w-0">
            <VehiclePhoto src={src} alt={`${title} · ${index + 2}`} compact className="aspect-[4/3] rounded-xl border" />
          </li>)}</ul>}
        </section>
        <Section title={copy.specs}><Facts columns="sm:grid-cols-3" items={[
          [copy.fields.vin, <span key="vin" className="font-mono text-[0.8125rem] break-all">{vehicle.vin}</span>], [copy.fields.stockNo, <span key="stock" className="font-mono text-[0.8125rem]">{vehicle.stockNo}</span>],
          [copy.fields.year, vehicle.year], [copy.fields.make, vehicle.make], [copy.fields.model, vehicle.model], [copy.fields.trim, vehicle.trim || "—"],
          [copy.fields.mileage, formatMileage(vehicle.mileage)], [copy.dealership, dealerships.find((item) => item.id === vehicle.dealershipId)?.name ?? copy.unknownDealership], [copy.fields.dateInStock, formatDate(vehicle.dateInStock, timeZone)],
        ]} /></Section>
      </div>
      <div className="min-w-0 space-y-5 xl:col-span-4">
        <section aria-labelledby="vehicle-pricing" className="rounded-[1.25rem] bg-ink p-5 text-ink-foreground shadow-md sm:p-6">
          <h2 id="vehicle-pricing" className="text-[0.9375rem] font-semibold tracking-tight">{copy.pricing}</h2>
          <p className="mt-4 text-[0.6875rem] leading-4 font-semibold tracking-[0.08em] text-ink-muted uppercase">{copy.fields.price}</p>
          <p className="font-display mt-1 text-[2.25rem] leading-none font-semibold tabular-nums">{formatPrice(vehicle.price)}</p>
          <div className="mt-5 border-t border-white/10">
            <Facts ink items={[
              [copy.commission, formatPrice(commission)],
              ...(vehicle.acquisitionCost !== null ? [[copy.acquisitionCost, formatPrice(vehicle.acquisitionCost)], [copy.repairSpend, formatPrice(repairSpend)]] as [string, React.ReactNode][] : []),
              ...(margin !== null ? [[copy.margin, <span key="margin" className={cn("font-display text-lg font-semibold", margin < 0 ? "text-[color-mix(in_oklab,var(--danger)_55%,white)]" : "text-ink-foreground")}>{formatPrice(margin)}</span>]] as [string, React.ReactNode][] : []),
            ]} />
          </div>
          {margin !== null && <p className="mt-4 text-xs text-ink-muted">{copy.marginHint}</p>}
        </section>
        {vehicle.sale && <Section title={copy.sale}>
          <Facts items={[
            [copy.soldBy, <PersonChip key="seller" name={staff(vehicle.sale.salespersonId)} />],
            [copy.salePrice, <span key="price" className="font-display text-base font-semibold">{formatPrice(vehicle.sale.price)}</span>], [copy.commission, formatPrice(vehicle.sale.commission)],
            [copy.soldOn, formatTimestamp(vehicle.sale.soldAt, timeZone)],
            ...(linkedLead ? [[copy.linkedLead, <Link key="lead" href={`/crm/leads/${linkedLead.id}`} className="font-medium text-info underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">{linkedLead.name}</Link>] as [string, React.ReactNode]] : []),
          ]} />
        </Section>}
        {vehicle.repair && <Section title={copy.currentRepair}><div className="mt-4">{currentRepair}</div></Section>}
      </div>
    </div>}

    {tab === "repairs" && <div className="grid gap-5 xl:grid-cols-12">
      <Section title={copy.currentRepair} className="xl:col-span-5 xl:self-start">{currentRepair ? <div className="mt-4">{currentRepair}</div> : <p className="mt-3 text-sm text-muted-foreground">{copy.noCurrentRepair}</p>}</Section>
      <Section title={copy.repairHistory} className="xl:col-span-7"
        action={<p className="text-sm text-muted-foreground">{copy.totalSpend}: <span className="font-display font-semibold text-foreground tabular-nums">{formatPrice(repairSpend)}</span></p>}>
        {!vehicle.repairHistory.length ? <p className="mt-3 text-sm text-muted-foreground">{copy.noRepairs}</p>
          : <ol className="mt-3 divide-y">{vehicle.repairHistory.toReversed().map((entry, index) => <li key={`${entry.startedAt}-${index}`} className="flex flex-wrap items-start justify-between gap-3 py-3.5">
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2"><StatusPill option={repairType(entry.typeKey)} className="min-h-6 px-2.5" /><span className="text-sm font-medium">{garageName(entry.garageId)}</span></div>
              <p className="text-xs text-muted-foreground">{formatDate(entry.startedAt, timeZone)} → {formatDate(entry.completedAt, timeZone)} · {copy.repairDuration(daysBetween(entry.startedAt, Date.parse(entry.completedAt)))} · {staff(entry.completedBy)}</p>
            </div>
            <span className="font-display font-semibold tabular-nums">{formatPrice(entry.cost)}</span>
          </li>)}</ol>}
      </Section>
    </div>}

    {tab === "leads" && <Section title={copy.leads}>{!leads.length ? <p className="mt-3 text-sm text-muted-foreground">{copy.noLeads}</p>
      : <ul className="mt-3 divide-y">{leads.map((lead) => <li key={lead.id}><Link href={`/crm/leads/${lead.id}`} className="group -mx-2 flex min-h-11 items-center gap-3 rounded-lg px-2 py-3 transition-colors duration-150 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring">
        <span className="min-w-0 flex-1 sm:grid sm:grid-cols-12 sm:items-center sm:gap-4">
          <span className="block font-medium sm:col-span-4">{lead.name}</span>
          <span className="block break-all text-sm text-muted-foreground sm:col-span-5">{lead.email}</span>
          <span className="block text-sm text-muted-foreground tabular-nums sm:col-span-3">{lead.phone}</span>
        </span>
        <StatusBadgeView kind="lead" status={lead.stage} settings={settings} />
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
      </Link></li>)}</ul>}</Section>}

    {tab === "timeline" && <Section title={copy.timeline}>
      <ol className="mt-3 divide-y">{timelineOf(vehicle, { status: statusLabel, repairType: (key) => repairType(key).label, garage: garageName, staff }).map((entry, index) => {
        const Icon = timelineIcons[entry.kind];
        return <li key={`${entry.at}-${index}`} className="flex items-start gap-3.5 py-3.5">
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", timelineTones[entry.kind])}><Icon aria-hidden className="size-[1.125rem]" /></span>
          <div className="min-w-0 flex-1 sm:flex sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0"><p className="break-words text-sm font-medium">{entry.text}</p>
              {entry.actorId && <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{staff(entry.actorId)}</p>}</div>
            <p className="mt-0.5 shrink-0 text-xs leading-5 text-muted-foreground tabular-nums sm:text-right">{formatTimestamp(entry.at, timeZone)}</p>
          </div>
        </li>;
      })}</ol>
    </Section>}
  </>;
}

export async function NewVehicleScreen() {
  await requirePageUser("owner");
  const [settings, dealerships] = await Promise.all([getSettings(), listDealerships()]);
  return <><PageHeader title={copy.add} description={copy.formHint} /><VehicleForm settings={settings} dealerships={dealerships} today={new Date().toISOString().slice(0, 10)} /></>;
}
