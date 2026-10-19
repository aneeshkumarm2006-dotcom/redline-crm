import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Board, type BoardColumn, type BoardGroup, type BoardItem } from "@/components/shared/board";
import { FilterDisclosure } from "@/components/shared/filter-disclosure";
import { colorFromName } from "@/lib/color";
import { cn } from "@/lib/utils";
import { requirePageUser } from "@/modules/auth/page-guards";
import { listDealerships } from "@/modules/dealerships/service";
import { listGarages } from "@/modules/garages/service";
import { countLeadsByVehicle } from "@/modules/leads/service";
import { getSettings } from "@/modules/settings/service";
import { getStaffNames } from "@/modules/users/service";
import { getInventorySummary, listVehicles } from "../service";
import { inventoryFilterSchema, inventoryGroupings, type InventoryFilters, type InventoryVehicle } from "../schema";
import { requestNow } from "@/lib/clock";
import { inventoryCopy as copy, daysBetween, formatMileage, vehicleTitle } from "../copy";
import { boardPriceAction, boardStatusAction } from "../actions";
import { listMyViews } from "@/modules/views/service";
import { SavedViews } from "@/modules/views/components/saved-views";

const filterKeys = ["q", "dealershipId", "status", "page", "groupBy", "repairType", "garageId", "aging", "sold", "minDays", "maxDays", "soldBy"] as const;
const defaults: Partial<Record<keyof InventoryFilters, string>> = { groupBy: "status", sold: "month", page: "1" };
/** Board URL for these filters; defaults stay out of the query string. */
function boardHref(filters: InventoryFilters, change: Partial<InventoryFilters> = {}) {
  const query = new URLSearchParams(Object.entries({ ...filters, ...change })
    .filter(([key, value]) => value !== undefined && value !== "" && defaults[key as keyof InventoryFilters] !== String(value))
    .map(([key, value]) => [key, String(value)]));
  return query.size ? `/crm/inventory?${query}` : "/crm/inventory";
}

export type InventorySearch = Promise<Record<string, string | string[] | undefined>>;
export async function InventoryScreen({ searchParams }: { searchParams: InventorySearch }) {
  const user = await requirePageUser();
  const params = await searchParams;
  const raw = Object.fromEntries(filterKeys.flatMap((key) => typeof params[key] === "string" && params[key] ? [[key, params[key]]] : []));
  const parsed = inventoryFilterSchema.safeParse(raw);
  const filters = parsed.success ? parsed.data : inventoryFilterSchema.parse({});
  const [result, summary, dealerships, settings, garages, views] = await Promise.all([listVehicles(filters), getInventorySummary(), listDealerships(), getSettings(), listGarages(), listMyViews("inventory")]);
  const ids = result.vehicles.map((vehicle) => vehicle.id);
  const sellerIds = [...new Set(result.vehicles.flatMap((vehicle) => vehicle.sale ? [vehicle.sale.salespersonId] : []))];
  const [leadCounts, sellers] = await Promise.all([countLeadsByVehicle(ids), getStaffNames(filters.soldBy ? [...new Set([...sellerIds, filters.soldBy])] : sellerIds)]);
  const location = (id: string) => dealerships.find((item) => item.id === id)?.name ?? copy.unknownDealership;
  const garageName = (id: string) => garages.find((item) => item.id === id)?.name ?? copy.unknownGarage;
  const repairType = (key: string) => settings.repairTypes.find((item) => item.key === key) ?? { key, label: key, color: "#94A3B8" };
  const canEdit = user.role === "owner";
  const roles = settings.statusRoles;
  const selectClass = "min-h-11 w-full min-w-0 rounded-md border bg-background px-3 text-base";
  const statuses = [...settings.vehicleStatuses, ...[...new Set(summary.map((row) => row.status))].filter((key) => !settings.vehicleStatuses.some((status) => status.key === key)).map((key) => ({ key, label: key, color: "#888888" }))];
  const now = requestNow();
  const byLocation = filters.groupBy === "location";
  const columns: BoardColumn[] = [
    { id: "vehicle", header: copy.columns.vehicle, cell: "link", width: 320 },
    { id: "stockNo", header: copy.columns.stockNo, cell: "label", width: 104, hideOnMobile: true },
    { id: "location", header: copy.columns.location, cell: "label", width: 170, hideOnMobile: byLocation },
    { id: "status", header: copy.columns.status, cell: "status", options: statuses, editable: canEdit },
    { id: "days", header: copy.columns.days, cell: "days", warnDays: settings.inventoryAging.warnDays, criticalDays: settings.inventoryAging.criticalDays },
    { id: "price", header: copy.columns.price, cell: "money", editable: canEdit },
    { id: "commission", header: copy.columns.commission, cell: "money", width: 120 },
    { id: "repairType", header: copy.columns.repairType, cell: "label", width: 150 },
    { id: "garage", header: copy.columns.garage, cell: "label", width: 190 },
    // Past the overdue threshold the repair counter turns red.
    { id: "repairDays", header: copy.columns.repairDays, cell: "days", width: 112, warnDays: settings.repairOverdueDays, criticalDays: settings.repairOverdueDays + 1 },
    { id: "leads", header: copy.columns.leads, cell: "label", width: 84, align: "center" },
    { id: "salesperson", header: copy.columns.salesperson, cell: "person", width: 180 },
  ];
  const toItem = (vehicle: InventoryVehicle): BoardItem => {
    const type = vehicle.repair ? repairType(vehicle.repair.typeKey) : null;
    const seller = vehicle.sale ? sellers.find((entry) => entry.id === vehicle.sale?.salespersonId)?.name ?? copy.unknownActor : null;
    const leads = leadCounts[vehicle.id] ?? 0;
    return {
      id: vehicle.id, version: vehicle.revision,
      values: {
        vehicle: { text: vehicleTitle(vehicle), href: `/crm/inventory/${vehicle.id}`, description: [vehicle.stockNo, vehicle.trim, formatMileage(vehicle.mileage)].filter(Boolean).join(" · "), imageUrl: vehicle.photos[0] ?? null },
        stockNo: { text: vehicle.stockNo }, location: { text: location(vehicle.dealershipId) }, status: vehicle.status,
        // A sold car's age stops at its sale date.
        days: daysBetween(vehicle.dateInStock, vehicle.sale ? Date.parse(vehicle.sale.soldAt) : now),
        price: vehicle.price, commission: vehicle.sale?.commission ?? vehicle.commission,
        repairType: type ? { text: type.label, color: type.color } : null,
        garage: vehicle.repair ? { text: garageName(vehicle.repair.garageId) } : null,
        repairDays: vehicle.repair ? daysBetween(vehicle.repair.startedAt, now) : null,
        leads: leads ? { text: String(leads) } : null,
        salesperson: seller ? { name: seller } : null,
      },
    };
  };
  // Oldest first, so aging stock and long repairs lead each group; sold cars show the latest sale first.
  const ageOrder = (a: InventoryVehicle, b: InventoryVehicle) => a.dateInStock.localeCompare(b.dateInStock);
  const statusOrder = (status: string) => { const index = statuses.findIndex((entry) => entry.key === status); return index < 0 ? statuses.length : index; };
  const sortFor = (status: string) => status === roles.sold ? (a: InventoryVehicle, b: InventoryVehicle) => (b.sale?.soldAt ?? "").localeCompare(a.sale?.soldAt ?? "")
    : status === roles.repair ? (a: InventoryVehicle, b: InventoryVehicle) => (a.repair?.startedAt ?? "").localeCompare(b.repair?.startedAt ?? "") : ageOrder;
  const groups: BoardGroup[] = byLocation
    ? dealerships.filter((dealership) => dealership.active || result.vehicles.some((vehicle) => vehicle.dealershipId === dealership.id)).map((dealership) => ({
      id: dealership.id, title: dealership.name, color: colorFromName(dealership.name),
      items: result.vehicles.filter((vehicle) => vehicle.dealershipId === dealership.id)
        .toSorted((a, b) => statusOrder(a.status) - statusOrder(b.status) || ageOrder(a, b)).map(toItem),
    }))
    : statuses.map((status) => ({
      id: status.key, title: status.label, color: status.color, collapsed: status.key === roles.sold && filters.status !== roles.sold,
      items: result.vehicles.filter((vehicle) => vehicle.status === status.key).toSorted(sortFor(status.key)).map(toItem),
    }));
  const ageRange = filters.minDays !== undefined || filters.maxDays !== undefined;
  const active = [filters.q, filters.dealershipId, filters.status, filters.repairType, filters.garageId, filters.aging, filters.sold === "all" ? "all" : undefined, ageRange, filters.soldBy].filter(Boolean).length;
  // Filters opened from dashboard links that the form has no control for: shown as removable chips.
  const linked = [
    ...(ageRange ? [{ key: "age", label: copy.ageRange(filters.minDays, filters.maxDays), href: boardHref(filters, { minDays: undefined, maxDays: undefined }) }] : []),
    ...(filters.soldBy ? [{ key: "soldBy", label: copy.soldByFilter(sellers.find((entry) => entry.id === filters.soldBy)?.name ?? copy.unknownActor), href: boardHref(filters, { soldBy: undefined }) }] : []),
  ];
  return <>
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-semibold tracking-tight">{copy.title}</h1><p className="mt-2 text-sm text-muted-foreground">{copy.intro}</p></div>{canEdit && <Button asChild className="min-h-11"><Link href="/crm/inventory/new">{copy.add}</Link></Button>}</header>
    <section aria-labelledby="stock-summary" className="space-y-3"><div><h2 id="stock-summary" className="font-semibold">{copy.summary}</h2><p className="text-xs leading-5 text-muted-foreground">{copy.summaryHint}</p></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{dealerships.map((dealership) => <div key={dealership.id} className="min-w-0 rounded-xl border bg-card p-4"><h3 className="break-words text-sm font-medium">{dealership.name}</h3><dl className="mt-3 flex flex-wrap gap-x-5 gap-y-3">{statuses.map((status) => <div key={status.key}><dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: status.color }} />{status.label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{summary.find((row) => row.dealershipId === dealership.id && row.status === status.key)?.count ?? 0}</dd></div>)}</dl></div>)}</div>
    </section>
    <SavedViews board="inventory" views={views} currentQuery={new URLSearchParams(raw).toString()} primaryColor={settings.brand.primaryColor} />
    <FilterDisclosure label={copy.filters} active={active}>
      <form action="/crm/inventory" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {byLocation && <input type="hidden" name="groupBy" value="location" />}
        {(["minDays", "maxDays", "soldBy"] as const).map((key) => filters[key] !== undefined && <input key={key} type="hidden" name={key} value={String(filters[key])} />)}
        <label className="min-w-0 space-y-2 sm:col-span-2"><span className="text-sm font-medium">{copy.search}</span><Input type="search" name="q" defaultValue={filters.q} placeholder={copy.searchPlaceholder} maxLength={120} className="min-h-11 text-base" /></label>
        <label className="min-w-0 space-y-2"><span className="text-sm font-medium">{copy.dealership}</span><select name="dealershipId" defaultValue={filters.dealershipId ?? ""} className={selectClass}><option value="">{copy.allDealerships}</option>{dealerships.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="min-w-0 space-y-2"><span className="text-sm font-medium">{copy.status}</span><select name="status" defaultValue={filters.status ?? ""} className={selectClass}><option value="">{copy.allStatuses}</option>{statuses.map((status) => <option key={status.key} value={status.key}>{status.label}</option>)}</select></label>
        <label className="min-w-0 space-y-2"><span className="text-sm font-medium">{copy.repairType}</span><select name="repairType" defaultValue={filters.repairType ?? ""} className={selectClass}><option value="">{copy.allRepairTypes}</option>{settings.repairTypes.map((type) => <option key={type.key} value={type.key}>{type.label}</option>)}</select></label>
        <label className="min-w-0 space-y-2"><span className="text-sm font-medium">{copy.garage}</span><select name="garageId" defaultValue={filters.garageId ?? ""} className={selectClass}><option value="">{copy.allGarages}</option>{garages.map((garage) => <option key={garage.id} value={garage.id}>{garage.name}</option>)}</select></label>
        <label className="min-w-0 space-y-2"><span className="text-sm font-medium">{copy.soldWindow}</span><select name="sold" defaultValue={filters.sold} className={selectClass}>{(["month", "all"] as const).map((key) => <option key={key} value={key}>{copy.soldWindows[key]}</option>)}</select></label>
        <label className="flex min-h-11 min-w-0 cursor-pointer items-center gap-3 self-end rounded-md border bg-background px-3">
          <input type="checkbox" name="aging" value="1" defaultChecked={Boolean(filters.aging)} className="size-5 accent-primary" />
          <span className="min-w-0"><span className="block text-sm font-medium">{copy.agingOnly}</span><span className="block text-xs text-muted-foreground">{copy.agingHint(settings.inventoryAging.warnDays)}</span></span>
        </label>
        <Button type="submit" className="min-h-11 self-end sm:col-span-2 xl:col-span-1">{copy.apply}</Button>
      </form>
    </FilterDisclosure>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <nav aria-label={copy.groupBy} className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{copy.groupBy}</span>
        <span className="inline-flex rounded-lg border bg-card p-0.5">{inventoryGroupings.map((grouping) => <Link key={grouping} href={boardHref(filters, { groupBy: grouping })} aria-current={filters.groupBy === grouping ? "page" : undefined}
          className={cn("inline-flex min-h-10 items-center rounded-md px-3 text-sm font-medium", filters.groupBy === grouping ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>{copy.groupings[grouping]}</Link>)}</span>
      </nav>
      <div className="flex items-center gap-2"><p className="text-sm text-muted-foreground">{copy.results(result.total)}</p>{active > 0 && <Button asChild variant="ghost" className="min-h-11"><Link href={boardHref(inventoryFilterSchema.parse({ groupBy: filters.groupBy }))}>{copy.clear}</Link></Button>}</div>
    </div>
    {linked.length > 0 && <ul aria-label={copy.linkedFilters} className="flex flex-wrap gap-2">{linked.map((entry) => <li key={entry.key}>
      <Link href={entry.href} aria-label={copy.removeFilter(entry.label)} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-primary/40 bg-primary/5 px-3 text-sm font-medium hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-ring">
        {entry.label}<X aria-hidden className="size-4 text-muted-foreground" />
      </Link>
    </li>)}</ul>}
    {result.truncated && <p role="status" className="rounded-lg border bg-muted/50 px-3 py-2 text-sm">{copy.truncated(result.vehicles.length, result.total)}</p>}
    {result.vehicles.length === 0 ? <div className="rounded-xl border bg-card p-10 text-center"><h2 className="font-semibold">{copy.empty}</h2><p className="mt-2 text-sm text-muted-foreground">{copy.emptyHint}</p></div>
      : <Board label={copy.board} columns={columns} groups={groups} onStatusChange={canEdit ? boardStatusAction : undefined} onMoneyChange={canEdit ? boardPriceAction : undefined} hideEmptyGroups={active > 0} exportName="inventory" />}
  </>;
}
