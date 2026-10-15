import Link from "next/link";
import { connection } from "next/server";
import { listPublicDealerships } from "@/modules/dealerships/service";
import { getSettings } from "@/modules/settings/service";
import { StatusBadgeView } from "@/components/shared/status-badge-view";
import { listPublicVehicles } from "../service";
import { publicInventoryFilterSchema } from "../schema";
import { formatMileage, formatPrice, vehicleTitle } from "../copy";
import { publicInventoryCopy as copy } from "../public-copy";
import { VehiclePhoto } from "./vehicle-photo";

export async function PublicInventoryScreen({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Live stock: render at request time rather than prerendering database reads.
  await connection();
  const params = await searchParams;
  const parsed = publicInventoryFilterSchema.safeParse({ dealershipId: params.dealershipId || undefined, page: params.page ?? 1 });
  const filters = parsed.success ? parsed.data : { page: 1 };
  const [result, dealerships, settings] = await Promise.all([listPublicVehicles(filters), listPublicDealerships(), getSettings()]);
  const locationNames = new Map(dealerships.map((entry) => [entry.id, entry.name]));
  const pageLink = (page: number) => `/inventory?${new URLSearchParams({ ...(filters.dealershipId ? { dealershipId: filters.dealershipId } : {}), page: String(page) })}`;
  return <div className="space-y-8">
    <div className="max-w-2xl space-y-3"><p className="text-sm font-semibold text-primary">{copy.available}</p><h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">{copy.title}</h1><p className="text-base leading-7 text-muted-foreground">{copy.intro}</p></div>
    <form action="/inventory" className="flex flex-wrap items-end gap-3 rounded-xl border bg-muted/30 p-4">
      <div className="min-w-0 flex-1 space-y-2 sm:max-w-sm"><label htmlFor="dealership" className="block text-sm font-medium">{copy.dealership}</label>
        <select id="dealership" name="dealershipId" defaultValue={filters.dealershipId ?? ""} className="min-h-11 w-full min-w-0 rounded-md border bg-background px-3 text-base">
          <option value="">{copy.all}</option>{dealerships.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
        </select>
      </div>
      <button className="min-h-11 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground">{copy.filter}</button>
      {filters.dealershipId && <Link href="/inventory" className="inline-flex min-h-11 items-center px-3 text-sm underline">{copy.clear}</Link>}
    </form>
    {!parsed.success && <p role="alert" className="text-sm text-destructive">{copy.invalid}</p>}
    <p className="text-sm text-muted-foreground">{copy.results(result.total)}</p>
    {result.vehicles.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{result.vehicles.map((vehicle) => <article key={vehicle.id} data-stock={vehicle.stockNo} className="min-w-0 overflow-hidden rounded-2xl border bg-card">
      <Link href={`/inventory/${vehicle.id}`} className="group block h-full p-3 focus-visible:outline-2 focus-visible:outline-ring">
        <VehiclePhoto src={vehicle.photos[0]} alt={vehicleTitle(vehicle)} />
        <div className="space-y-3 p-2 pt-4">
          <StatusBadgeView kind="vehicle" status={vehicle.status} settings={settings} />
          <div><h2 className="break-words text-lg font-semibold group-hover:underline">{vehicleTitle(vehicle)}</h2><p className="break-words text-sm text-muted-foreground">{vehicle.trim}</p></div>
          <p className="text-2xl font-semibold">{formatPrice(vehicle.price)} <span className="text-xs font-normal text-muted-foreground">CAD</span></p>
          <p className="text-sm text-muted-foreground">{formatMileage(vehicle.mileage)}</p>
          <p className="break-words border-t pt-3 text-sm">{locationNames.get(vehicle.dealershipId)}</p>
          <span className="inline-block text-sm font-medium text-primary">{copy.view} →</span>
        </div>
      </Link>
    </article>)}</div> : <div className="rounded-2xl border border-dashed px-6 py-16 text-center"><h2 className="text-xl font-semibold">{copy.empty}</h2><p className="mt-2 text-muted-foreground">{copy.emptyHint}</p></div>}
    {result.pageCount > 1 && <nav aria-label={copy.inventory} className="flex flex-wrap items-center justify-center gap-4">
      {result.page > 1 && <Link href={pageLink(result.page - 1)} className="inline-flex min-h-11 items-center rounded-md border px-4">{copy.previous}</Link>}
      <span className="text-sm">{copy.page(result.page, result.pageCount)}</span>
      {result.page < result.pageCount && <Link href={pageLink(result.page + 1)} className="inline-flex min-h-11 items-center rounded-md border px-4">{copy.next}</Link>}
    </nav>}
  </div>;
}

