import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadgeView } from "@/components/shared/status-badge-view";
import { FilterDisclosure } from "@/components/shared/filter-disclosure";
import { requirePageUser } from "@/modules/auth/page-guards";
import { listDealerships } from "@/modules/dealerships/service";
import { getSettings } from "@/modules/settings/service";
import { getInventorySummary, listVehicles } from "../service";
import { inventoryFilterSchema } from "../schema";
import { inventoryCopy as copy, formatPrice, formatMileage, vehicleTitle } from "../copy";
import { VehiclePhoto } from "./vehicle-photo";
import { VehicleControls } from "./vehicle-controls";

export type InventorySearch = Promise<Record<string, string | string[] | undefined>>;
export async function InventoryScreen({ searchParams }: { searchParams: InventorySearch }) {
  const user = await requirePageUser();
  const params = await searchParams;
  const raw = Object.fromEntries(["q", "dealershipId", "status", "page"].flatMap((key) => typeof params[key] === "string" && params[key] ? [[key, params[key]]] : []));
  const parsed = inventoryFilterSchema.safeParse(raw);
  const filters = parsed.success ? parsed.data : inventoryFilterSchema.parse({});
  const [result, summary, dealerships, settings] = await Promise.all([listVehicles(filters), getInventorySummary(), listDealerships(), getSettings()]);
  const location = (id: string) => dealerships.find((item) => item.id === id)?.name ?? copy.unknownDealership;
  const canEdit = user.role === "owner";
  const href = (page: number) => {
    const query = new URLSearchParams(Object.entries({ ...filters, page: String(page) }).filter(([, value]) => value !== undefined && value !== "") as [string, string][]);
    return `/crm/inventory?${query}`;
  };
  const selectClass = "min-h-11 w-full min-w-0 rounded-md border bg-background px-3 text-base";
  const statuses = [...settings.vehicleStatuses, ...[...new Set(summary.map((row) => row.status))].filter((key) => !settings.vehicleStatuses.some((status) => status.key === key)).map((key) => ({ key, label: key, color: "#888888" }))];
  return <>
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-semibold tracking-tight">{copy.title}</h1><p className="mt-2 text-sm text-muted-foreground">{copy.intro}</p></div>{canEdit && <Button asChild className="min-h-11"><Link href="/crm/inventory/new">{copy.add}</Link></Button>}</header>
    <section aria-labelledby="stock-summary" className="space-y-3"><div><h2 id="stock-summary" className="font-semibold">{copy.summary}</h2><p className="text-xs leading-5 text-muted-foreground">{copy.summaryHint}</p></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{dealerships.map((dealership) => <div key={dealership.id} className="min-w-0 rounded-xl border bg-card p-4"><h3 className="break-words text-sm font-medium">{dealership.name}</h3><dl className="mt-3 flex flex-wrap gap-x-5 gap-y-3">{statuses.map((status) => <div key={status.key}><dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: status.color }} />{status.label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{summary.find((row) => row.dealershipId === dealership.id && row.status === status.key)?.count ?? 0}</dd></div>)}</dl></div>)}</div>
    </section>
    <FilterDisclosure label={copy.filters} active={[filters.q, filters.dealershipId, filters.status].filter(Boolean).length}>
    <form action="/crm/inventory" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_auto]">
      <label className="min-w-0 space-y-2"><span className="text-sm font-medium">{copy.search}</span><Input type="search" name="q" defaultValue={filters.q} placeholder={copy.searchPlaceholder} maxLength={120} className="min-h-11 text-base" /></label>
      <label className="min-w-0 space-y-2"><span className="text-sm font-medium">{copy.dealership}</span><select aria-label={copy.dealership} name="dealershipId" defaultValue={filters.dealershipId ?? ""} className={selectClass}><option value="">{copy.allDealerships}</option>{dealerships.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="min-w-0 space-y-2"><span className="text-sm font-medium">{copy.status}</span><select aria-label={copy.status} name="status" defaultValue={filters.status ?? ""} className={selectClass}><option value="">{copy.allStatuses}</option>{statuses.map((status) => <option key={status.key} value={status.key}>{status.label}</option>)}</select></label>
      <Button type="submit" className="min-h-11 self-end">{copy.apply}</Button>
    </form>
    </FilterDisclosure>
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted-foreground">{copy.results(result.total)}</p><Button asChild variant="ghost" className="min-h-11"><Link href="/crm/inventory">{copy.clear}</Link></Button></div>
    {result.vehicles.length === 0 ? <div className="rounded-xl border p-10 text-center"><h2 className="font-semibold">{copy.empty}</h2><p className="mt-2 text-sm text-muted-foreground">{copy.emptyHint}</p></div> : <>
      <div className="grid gap-4 sm:grid-cols-2 lg:hidden">{result.vehicles.map((vehicle) => <article key={vehicle.id} data-stock={vehicle.stockNo} className="min-w-0 space-y-4 rounded-2xl border bg-card p-4 shadow-xs">
        <Link href={`/crm/inventory/${vehicle.id}`} className="block space-y-3"><VehiclePhoto src={vehicle.photos[0]} alt={vehicleTitle(vehicle)} /><div><p className="text-xs text-muted-foreground">{vehicle.stockNo} · {location(vehicle.dealershipId)}</p><h2 className="mt-1 break-words text-lg font-semibold">{vehicleTitle(vehicle)}</h2><p className="text-sm text-muted-foreground">{vehicle.trim}</p></div></Link>
        <div className="flex flex-wrap items-end justify-between gap-2"><p className="text-xl font-semibold tabular-nums">{formatPrice(vehicle.price)}</p><p className="text-sm text-muted-foreground">{formatMileage(vehicle.mileage)}</p></div>
        <div className="flex flex-wrap items-center justify-between gap-2">{canEdit ? <VehicleControls vehicle={vehicle} settings={settings} /> : <StatusBadgeView kind="vehicle" status={vehicle.status} settings={settings} />}<Button variant="ghost" className="min-h-11" asChild><Link href={`/crm/inventory/${vehicle.id}`}>{copy.details}</Link></Button></div>
      </article>)}</div>
      <div className="hidden min-w-0 rounded-xl border bg-card lg:block"><table className="w-full table-fixed text-left text-sm"><thead className="border-b bg-muted/40"><tr>{[copy.details, copy.dealership, copy.fields.price, copy.status].map((label, index) => <th key={label} className={`p-4 font-medium ${index === 0 ? "w-[35%]" : ""}`}>{label}</th>)}</tr></thead><tbody>{result.vehicles.map((vehicle) => <tr key={vehicle.id} data-stock={vehicle.stockNo} className="border-b last:border-0"><td className="p-4"><Link href={`/crm/inventory/${vehicle.id}`} className="flex min-h-11 flex-col justify-center break-words font-medium hover:underline">{vehicleTitle(vehicle)}<span className="text-xs font-normal text-muted-foreground">{vehicle.stockNo} · {formatMileage(vehicle.mileage)}</span></Link></td><td className="break-words p-4 text-muted-foreground">{location(vehicle.dealershipId)}</td><td className="p-4 font-semibold tabular-nums">{formatPrice(vehicle.price)}</td><td className="p-4">{canEdit ? <VehicleControls vehicle={vehicle} settings={settings} /> : <StatusBadgeView kind="vehicle" status={vehicle.status} settings={settings} />}</td></tr>)}</tbody></table></div>
    </>}
    {result.pageCount > 1 && <nav aria-label="Inventory pages" className="flex flex-wrap items-center justify-between gap-3">{result.page > 1 ? <Button asChild variant="outline" className="min-h-11"><Link href={href(result.page - 1)}>{copy.previous}</Link></Button> : <span />}<span className="text-sm">{copy.page(result.page, result.pageCount)}</span>{result.page < result.pageCount ? <Button asChild variant="outline" className="min-h-11"><Link href={href(result.page + 1)}>{copy.next}</Link></Button> : <span />}</nav>}
  </>;
}
