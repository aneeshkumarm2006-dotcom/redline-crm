import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, Gauge, MapPin, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { listPublicDealerships } from "@/modules/dealerships/service";
import { getSettings } from "@/modules/settings/service";
import { StatusBadgeView } from "@/components/shared/status-badge-view";
import { countPublicVehiclesByDealership, listPublicVehicles } from "../service";
import { publicInventoryFilterSchema } from "../schema";
import { formatMileage, formatPrice, vehicleTitle } from "../copy";
import { publicInventoryCopy as copy } from "../public-copy";
import { PublicBadgePill } from "./public-badge";
import { VehiclePhoto } from "./vehicle-photo";

const tel = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

export async function PublicInventoryScreen({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Live stock: render at request time rather than prerendering database reads.
  await connection();
  const params = await searchParams;
  const parsed = publicInventoryFilterSchema.safeParse({ dealershipId: params.dealershipId || undefined, page: params.page ?? 1 });
  const filters = parsed.success ? parsed.data : { page: 1 };
  const [result, dealerships, settings, counts] = await Promise.all([listPublicVehicles(filters), listPublicDealerships(), getSettings(), countPublicVehiclesByDealership()]);
  const locationNames = new Map(dealerships.map((entry) => [entry.id, entry.name]));
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const listHref = (dealershipId?: string, page?: number) => {
    const query = new URLSearchParams({ ...(dealershipId ? { dealershipId } : {}), ...(page && page > 1 ? { page: String(page) } : {}) });
    return query.size ? `/inventory?${query}` : "/inventory";
  };
  const chip = (active: boolean) => cn("inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted");
  const chipCount = (active: boolean) => cn("rounded-full px-1.5 text-xs tabular-nums", active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground");
  return <div className="space-y-8">
    <section aria-labelledby="public-hero" className="overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-background p-5 sm:p-10">
      <div className="max-w-2xl space-y-3">
        <p className="text-sm font-semibold text-primary">{settings.brand.companyName} · {copy.heroEyebrow(dealerships.length)}</p>
        <h1 id="public-hero" className="text-3xl font-semibold tracking-tight sm:text-5xl">{copy.title}</h1>
        <p className="text-base leading-7 text-muted-foreground">{copy.intro}</p>
        <div className="pt-2"><a href="#vehicles" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          {copy.browse}<ArrowRight aria-hidden className="size-4" /></a></div>
      </div>
      {dealerships.length > 0 && <div className="mt-8">
        <h2 className="text-sm font-semibold">{copy.locations}</h2>
        {/* Swipeable on a phone so the vehicles stay close to the top; a grid from small tablets up. */}
        <ul className="-mx-5 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">{dealerships.map((entry) => <li key={entry.id}
          className="w-[80%] shrink-0 snap-start rounded-2xl border bg-card/90 p-4 sm:w-auto">
          <p className="break-words font-semibold">{entry.name}</p>
          <p className="mt-1 flex gap-1.5 break-words text-sm text-muted-foreground"><MapPin aria-hidden className="mt-0.5 size-4 shrink-0" />{entry.address}</p>
          <a href={tel(entry.phone)} className="mt-1 inline-flex min-h-10 items-center gap-1.5 text-sm hover:underline"><Phone aria-hidden className="size-4 text-muted-foreground" />{entry.phone}</a>
          <Link href={`${listHref(entry.id)}#vehicles`} className="mt-2 flex min-h-11 items-center justify-between gap-2 border-t pt-3 text-sm font-medium text-primary hover:underline">
            {copy.vehiclesAt(counts[entry.id] ?? 0)}<span className="inline-flex items-center gap-1">{copy.seeVehicles}<ArrowRight aria-hidden className="size-4" /></span>
          </Link>
        </li>)}</ul>
      </div>}
    </section>

    <section id="vehicles" aria-labelledby="public-vehicles" className="scroll-mt-4 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="public-vehicles" className="text-2xl font-semibold tracking-tight">{copy.available}</h2>
        <p className="text-sm text-muted-foreground">{copy.results(result.total)}</p>
      </div>
      <nav aria-label={copy.locationFilter} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <Link href={listHref()} scroll={false} aria-current={!filters.dealershipId ? "page" : undefined} className={chip(!filters.dealershipId)}>
          {copy.allLocations}<span className={chipCount(!filters.dealershipId)}>{total}</span></Link>
        {dealerships.map((entry) => {
          const active = filters.dealershipId === entry.id;
          return <Link key={entry.id} href={listHref(entry.id)} scroll={false} aria-current={active ? "page" : undefined} className={chip(active)}>
            {entry.name}<span className={chipCount(active)}>{counts[entry.id] ?? 0}</span></Link>;
        })}
      </nav>
      {!parsed.success && <p role="alert" className="text-sm text-destructive">{copy.invalid}</p>}
      {result.vehicles.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{result.vehicles.map((vehicle) => <article key={vehicle.id} data-stock={vehicle.stockNo}
        className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-xs transition-shadow hover:shadow-md has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-offset-2">
        <div className="relative">
          <VehiclePhoto src={vehicle.photos[0]} alt={vehicleTitle(vehicle)} className="rounded-none" />
          <div className="absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
            {vehicle.badge ? <PublicBadgePill badge={vehicle.badge} /> : <span />}
            <StatusBadgeView kind="vehicle" status={vehicle.status} settings={settings} className="bg-background/90 backdrop-blur" />
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="min-w-0">
            <h3 className="break-words text-lg font-semibold leading-snug">
              {/* The whole card is the link target; the title carries the accessible name. */}
              <Link href={`/inventory/${vehicle.id}`} className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none">{vehicleTitle(vehicle)}</Link>
            </h3>
            {vehicle.trim && <p className="break-words text-sm text-muted-foreground">{vehicle.trim}</p>}
          </div>
          <p className="text-2xl font-semibold tabular-nums">{formatPrice(vehicle.price)} <span className="text-xs font-normal text-muted-foreground">CAD</span></p>
          <ul className="mt-auto grid gap-1.5 border-t pt-3 text-sm text-muted-foreground">
            <li className="flex items-center gap-2"><Gauge aria-hidden className="size-4 shrink-0" />{formatMileage(vehicle.mileage)}</li>
            <li className="flex min-w-0 items-center gap-2"><MapPin aria-hidden className="size-4 shrink-0" /><span className="truncate">{locationNames.get(vehicle.dealershipId)}</span></li>
          </ul>
          <span aria-hidden className="inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:underline">{copy.view}<ArrowRight className="size-4" /></span>
        </div>
      </article>)}</div> : <div className="rounded-2xl border border-dashed px-6 py-16 text-center"><h3 className="text-xl font-semibold">{copy.empty}</h3><p className="mt-2 text-muted-foreground">{copy.emptyHint}</p></div>}
      {result.pageCount > 1 && <nav aria-label={copy.inventory} className="flex flex-wrap items-center justify-center gap-4">
        {result.page > 1 && <Link href={listHref(filters.dealershipId, result.page - 1)} className="inline-flex min-h-11 items-center rounded-md border px-4">{copy.previous}</Link>}
        <span className="text-sm">{copy.page(result.page, result.pageCount)}</span>
        {result.page < result.pageCount && <Link href={listHref(filters.dealershipId, result.page + 1)} className="inline-flex min-h-11 items-center rounded-md border px-4">{copy.next}</Link>}
      </nav>}
    </section>
  </div>;
}
