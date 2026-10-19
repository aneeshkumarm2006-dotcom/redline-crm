import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeDollarSign, CarFront, PackagePlus, Tag, Wrench, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadgeView } from "@/components/shared/status-badge-view";
import { StatusPill } from "@/components/shared/status-pill";
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

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return <section className={cn("min-w-0 rounded-xl border bg-card p-5", className)}><h2 className="text-lg font-semibold">{title}</h2>{children}</section>;
}
function Facts({ items }: { items: [string, React.ReactNode][] }) {
  return <dl className="mt-4 grid gap-4 sm:grid-cols-2">{items.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{value}</dd></div>)}</dl>;
}

type Params = { params: Promise<{ id: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> };
export async function VehicleScreen({ params, searchParams, edit = false }: Params & { edit?: boolean }) {
  const user = await requirePageUser(...(edit ? ["owner" as const] : []));
  const { id } = await params;
  const vehicle = await getVehicle(id);
  if (!vehicle) notFound();
  const [settings, dealerships] = await Promise.all([getSettings(), listDealerships()]);
  if (edit) return <><h1 className="text-3xl font-semibold">{copy.edit}</h1><p className="text-sm text-muted-foreground">{copy.formHint}</p><VehicleForm vehicle={vehicle} settings={settings} dealerships={dealerships} today="" /></>;
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

  const currentRepair = vehicle.repair && <div className={cn("rounded-xl border p-4", overdue ? "border-danger/40 bg-danger/5" : "bg-muted/30")}>
    <div className="flex flex-wrap items-center gap-2">
      <StatusPill option={repairType(vehicle.repair.typeKey)} className="min-h-7 px-3" />
      <span className="font-medium">{garageName(vehicle.repair.garageId)}</span>
      {overdue && <span className="rounded-full bg-danger px-2 py-0.5 text-xs font-semibold text-white">{copy.overdue}</span>}
    </div>
    <p className="mt-3 text-sm text-muted-foreground">{copy.inRepairFor}</p>
    <RepairTimer startedAt={vehicle.repair.startedAt} serverNow={now} className={cn("block text-3xl font-semibold tabular-nums", overdue && "text-danger")} />
    <Facts items={[
      [copy.started, formatTimestamp(vehicle.repair.startedAt, timeZone)],
      [copy.estimatedCost, vehicle.repair.estimatedCost === null ? "—" : formatPrice(vehicle.repair.estimatedCost)],
      ...(garage(vehicle.repair.garageId)?.phone ? [[copy.garage, <a key="phone" href={`tel:${garage(vehicle.repair.garageId)?.phone}`} className="underline">{garage(vehicle.repair.garageId)?.phone}</a>] as [string, React.ReactNode]] : []),
      ...(vehicle.repair.notes ? [[copy.notes, vehicle.repair.notes] as [string, React.ReactNode]] : []),
    ]} />
  </div>;

  return <>
    <Button asChild variant="ghost" className="min-h-11 self-start"><Link href="/crm/inventory">← {copy.back}</Link></Button>
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">{vehicle.stockNo}<StatusBadgeView kind="vehicle" status={vehicle.status} settings={settings} /><span>{copy.daysInStock(daysInStock)}</span></p>
        <h1 className="mt-1 break-words text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-2 text-muted-foreground">{vehicle.trim}</p>
      </div>
      {owner && <Button asChild variant="outline" className="min-h-11"><Link href={`/crm/inventory/${id}/edit`}>{copy.edit}</Link></Button>}
    </header>
    <div className="flex flex-wrap items-center gap-3">
      <span className="mr-auto text-3xl font-semibold">{formatPrice(vehicle.price)}</span>
      {owner ? <>
        {vehicle.repair ? <CompleteRepairSheet key={`complete-${action}`} vehicle={ref} estimatedCost={vehicle.repair.estimatedCost} primaryColor={primaryColor} defaultOpen={action === "complete-repair"} />
          : !sold && <>
            <SendToRepairSheet key={`repair-${action}`} vehicle={ref} repairTypes={settings.repairTypes} garages={garages.filter((entry) => entry.active)} primaryColor={primaryColor} defaultOpen={action === "repair"} />
            <MarkSoldSheet key={`sell-${action}`} vehicle={ref} price={vehicle.price} commission={vehicle.commission} primaryColor={primaryColor} defaultOpen={action === "sell"}
              salespeople={salespeople.filter((person) => person.active && person.dealershipId === vehicle.dealershipId)}
              leads={leads.map((lead) => ({ id: lead.id, name: lead.name, stageLabel: stageLabel(lead.stage), assignedTo: lead.assignedTo }))} />
          </>}
        {!sold && <VehicleControls vehicle={vehicle} settings={settings} />}
        <VehicleControls vehicle={vehicle} settings={settings} price />
      </> : <StatusBadgeView kind="vehicle" status={vehicle.status} settings={settings} />}
    </div>

    <nav aria-label={copy.tabsLabel} className="scrollbar-thin -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b">{tabs.map((entry) => <li key={entry}>
        <Link href={entry === "overview" ? `/crm/inventory/${id}` : `/crm/inventory/${id}?tab=${entry}`} aria-current={tab === entry ? "page" : undefined} scroll={false}
          className={cn("-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium", tab === entry ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
          {copy.tabs[entry]}
          {entry === "repairs" && vehicle.repair && <span aria-hidden className={cn("size-2 rounded-full", overdue ? "bg-danger" : "bg-warning")} />}
          {entry === "leads" && leads.length > 0 && <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">{leads.length}</span>}
        </Link>
      </li>)}</ul>
    </nav>

    {tab === "overview" && <>
      {vehicle.sale && <Section title={copy.sale}>
        <Facts items={[
          [copy.soldBy, <PersonChip key="seller" name={staff(vehicle.sale.salespersonId)} />],
          [copy.salePrice, formatPrice(vehicle.sale.price)], [copy.commission, formatPrice(vehicle.sale.commission)],
          [copy.soldOn, formatTimestamp(vehicle.sale.soldAt, timeZone)],
          ...(linkedLead ? [[copy.linkedLead, <Link key="lead" href={`/crm/leads/${linkedLead.id}`} className="underline">{linkedLead.name}</Link>] as [string, React.ReactNode]] : []),
        ]} />
      </Section>}
      {vehicle.repair && <Section title={copy.currentRepair}><div className="mt-4">{currentRepair}</div></Section>}
      <Section title={copy.pricing}>
        <Facts items={[
          [copy.fields.price, formatPrice(vehicle.price)], [copy.commission, formatPrice(commission)],
          ...(vehicle.acquisitionCost !== null ? [[copy.acquisitionCost, formatPrice(vehicle.acquisitionCost)], [copy.repairSpend, formatPrice(repairSpend)]] as [string, React.ReactNode][] : []),
          ...(margin !== null ? [[copy.margin, <span key="margin" className={cn(margin < 0 && "text-danger")}>{formatPrice(margin)}</span>]] as [string, React.ReactNode][] : []),
        ]} />
        {margin !== null && <p className="mt-3 text-xs text-muted-foreground">{copy.marginHint}</p>}
      </Section>
      <section aria-label={copy.photos} className="grid gap-3 sm:grid-cols-2">{(vehicle.photos.length ? vehicle.photos : [undefined]).map((src, index) => <VehiclePhoto key={`${src}-${index}`} src={src} alt={`${title} · ${index + 1}`} />)}</section>
      <Section title={copy.specs}><Facts items={[
        [copy.fields.vin, vehicle.vin], [copy.fields.stockNo, vehicle.stockNo], [copy.fields.year, vehicle.year], [copy.fields.make, vehicle.make], [copy.fields.model, vehicle.model], [copy.fields.trim, vehicle.trim || "—"],
        [copy.fields.mileage, formatMileage(vehicle.mileage)], [copy.dealership, dealerships.find((item) => item.id === vehicle.dealershipId)?.name ?? copy.unknownDealership], [copy.fields.dateInStock, formatDate(vehicle.dateInStock, timeZone)],
      ]} /></Section>
    </>}

    {tab === "repairs" && <>
      <Section title={copy.currentRepair}>{currentRepair ? <div className="mt-4">{currentRepair}</div> : <p className="mt-3 text-sm text-muted-foreground">{copy.noCurrentRepair}</p>}</Section>
      <Section title={copy.repairHistory}>
        <p className="mt-1 text-sm text-muted-foreground">{copy.totalSpend}: <span className="font-semibold text-foreground tabular-nums">{formatPrice(repairSpend)}</span></p>
        {!vehicle.repairHistory.length ? <p className="mt-3 text-sm text-muted-foreground">{copy.noRepairs}</p>
          : <ol className="mt-4 divide-y">{vehicle.repairHistory.toReversed().map((entry, index) => <li key={`${entry.startedAt}-${index}`} className="flex flex-wrap items-start justify-between gap-3 py-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2"><StatusPill option={repairType(entry.typeKey)} className="min-h-6 px-2.5" /><span className="text-sm font-medium">{garageName(entry.garageId)}</span></div>
              <p className="text-xs text-muted-foreground">{formatDate(entry.startedAt, timeZone)} → {formatDate(entry.completedAt, timeZone)} · {copy.repairDuration(daysBetween(entry.startedAt, Date.parse(entry.completedAt)))} · {staff(entry.completedBy)}</p>
            </div>
            <span className="font-semibold tabular-nums">{formatPrice(entry.cost)}</span>
          </li>)}</ol>}
      </Section>
    </>}

    {tab === "leads" && <Section title={copy.leads}>{!leads.length ? <p className="mt-3 text-sm text-muted-foreground">{copy.noLeads}</p>
      : <ul className="mt-4 divide-y">{leads.map((lead) => <li key={lead.id}><Link href={`/crm/leads/${lead.id}`} className="flex min-h-11 flex-wrap items-center justify-between gap-3 py-3 hover:bg-muted/40">
        <span className="min-w-0"><span className="block font-medium">{lead.name}</span><span className="block break-all text-sm text-muted-foreground">{lead.email}</span><span className="block text-sm text-muted-foreground">{lead.phone}</span></span>
        <StatusBadgeView kind="lead" status={lead.stage} settings={settings} />
      </Link></li>)}</ul>}</Section>}

    {tab === "timeline" && <Section title={copy.timeline}>
      <ol className="mt-4 space-y-4">{timelineOf(vehicle, { status: statusLabel, repairType: (key) => repairType(key).label, garage: garageName, staff }).map((entry, index) => {
        const Icon = timelineIcons[entry.kind];
        return <li key={`${entry.at}-${index}`} className="flex gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted"><Icon aria-hidden className="size-4 text-muted-foreground" /></span>
          <div className="min-w-0"><p className="break-words text-sm font-medium">{entry.text}</p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{[entry.actorId ? staff(entry.actorId) : null, formatTimestamp(entry.at, timeZone)].filter(Boolean).join(" · ")}</p></div>
        </li>;
      })}</ol>
    </Section>}
  </>;
}

export async function NewVehicleScreen() {
  await requirePageUser("owner");
  const [settings, dealerships] = await Promise.all([getSettings(), listDealerships()]);
  return <><h1 className="text-3xl font-semibold">{copy.add}</h1><p className="text-sm text-muted-foreground">{copy.formHint}</p><VehicleForm settings={settings} dealerships={dealerships} today={new Date().toISOString().slice(0, 10)} /></>;
}
