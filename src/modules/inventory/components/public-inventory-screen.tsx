import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, ArrowUpRight, BadgeCheck, CarFront, Gauge, Landmark, MapPin, Phone, Repeat, Search, X, type LucideIcon } from "lucide-react";
import { DropdownField } from "@/components/ui/dropdown-field";
import { cn } from "@/lib/utils";
import { listPublicDealerships } from "@/modules/dealerships/service";
import { getSettings } from "@/modules/settings/service";
import { StatusBadgeView } from "@/components/shared/status-badge-view";
import { countPublicVehiclesByDealership, getPublicFacets, listPublicVehicles } from "../service";
import { publicInventoryFilterSchema, publicSorts, type PublicInventoryFilters } from "../schema";
import { formatMileage, formatPrice, vehicleTitle } from "../copy";
import { publicInventoryCopy as copy } from "../public-copy";
import { PublicBadgePill } from "./public-badge";
import { VehiclePhoto } from "./vehicle-photo";

const tel = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
const whole = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
const text = (value: string | string[] | undefined) => typeof value === "string" && value.trim() ? value : undefined;
const trustIcons: Record<(typeof copy.trust)[number]["key"], LucideIcon> = { inspected: BadgeCheck, financing: Landmark, trade: Repeat };

export async function PublicInventoryScreen({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Live stock: render at request time rather than prerendering database reads.
  await connection();
  const params = await searchParams;
  const parsed = publicInventoryFilterSchema.safeParse({ dealershipId: text(params.dealershipId), page: params.page ?? 1, q: text(params.q) ?? "",
    make: text(params.make), maxPrice: text(params.maxPrice), sort: text(params.sort) });
  const filters: PublicInventoryFilters = parsed.success ? parsed.data : publicInventoryFilterSchema.parse({});
  const [result, dealerships, settings, counts, facets] = await Promise.all([listPublicVehicles(filters), listPublicDealerships(), getSettings(), countPublicVehiclesByDealership(), getPublicFacets()]);
  const locationNames = new Map(dealerships.map((entry) => [entry.id, entry.name]));
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  /** The current filters with some replaced; page resets unless given. */
  const listHref = (patch: Partial<Record<"dealershipId" | "q" | "make" | "maxPrice" | "sort" | "page", string | number | undefined>> = {}) => {
    const next = { dealershipId: filters.dealershipId, q: filters.q || undefined, make: filters.make, maxPrice: filters.maxPrice,
      sort: filters.sort === "newest" ? undefined : filters.sort, page: undefined, ...patch };
    const query = new URLSearchParams(Object.entries(next).flatMap(([key, value]) => value === undefined || value === "" || (key === "page" && Number(value) <= 1) ? [] : [[key, String(value)]]));
    return query.size ? `/inventory?${query}` : "/inventory";
  };
  const priceSteps = [15_000, 20_000, 25_000, 30_000, 35_000, 40_000, 50_000, 75_000]
    .filter((step) => facets.minPrice !== null && facets.maxPrice !== null && step > facets.minPrice && step < facets.maxPrice * 1.25);
  const active = [
    ...(filters.q ? [{ key: "q", label: copy.keywordChip(filters.q), href: listHref({ q: undefined }) }] : []),
    ...(filters.make ? [{ key: "make", label: filters.make, href: listHref({ make: undefined }) }] : []),
    ...(filters.maxPrice ? [{ key: "maxPrice", label: copy.underChip(whole.format(filters.maxPrice)), href: listHref({ maxPrice: undefined }) }] : []),
  ];
  // Hero spotlight: a new arrival with a photo if there is one, else any available vehicle with a photo.
  const withPhoto = result.vehicles.filter((vehicle) => vehicle.photos[0]);
  const featured = withPhoto.find((vehicle) => vehicle.badge === "new_arrival") ?? withPhoto.find((vehicle) => vehicle.status === settings.statusRoles.available) ?? withPhoto[0];
  const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
  const trust = [...copy.trust.map((item) => ({ key: item.key, icon: trustIcons[item.key], title: item.title, text: item.text })),
    { key: "local", icon: MapPin, title: copy.localTrust.title(dealerships.length), text: copy.localTrust.text }];
  const stats = [
    { label: copy.stats.stock, value: String(total) },
    { label: copy.stats.locations, value: String(dealerships.length) },
    ...(facets.minPrice !== null ? [{ label: copy.stats.from, value: whole.format(facets.minPrice) }] : []),
  ];
  return <>
    <section data-public-hero aria-labelledby="public-hero" className="ink-glow relative isolate overflow-hidden bg-ink text-ink-foreground">
      {/* Fine grid texture, faded out towards the edges. */}
      <div aria-hidden className="absolute inset-0 -z-10 opacity-[0.07] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      <div className="page-gutter grid items-center gap-12 pt-28 pb-36 sm:pt-32 lg:grid-cols-12 lg:gap-10 lg:pt-36 lg:pb-44">
        <div className="min-w-0 lg:col-span-6 xl:col-span-5">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3.5 py-1.5 text-xs font-semibold text-ink-foreground ring-1 ring-white/10">
            <span aria-hidden className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60 motion-reduce:animate-none" /><span className="relative inline-flex size-2 rounded-full bg-success" /></span>
            {copy.heroLive(total, dealerships.length)}
          </p>
          <h1 id="public-hero" className="font-display mt-6 text-5xl leading-[1.02] font-bold text-white sm:text-6xl xl:text-7xl">
            {copy.heroTitle.lead}<br /><span className="text-primary">{copy.heroTitle.accent}.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-ink-muted sm:text-lg sm:leading-8">{copy.heroIntro}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#vehicles" className={cn("inline-flex min-h-13 items-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-[0.9375rem] font-semibold text-primary-foreground shadow-[0_10px_24px_-10px_color-mix(in_oklab,var(--primary)_80%,transparent)] transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.98]", focus)}>
              {copy.heroBrowse(total)}<ArrowRight aria-hidden className="size-4" /></a>
            {dealerships.length > 0 && <a href="#public-locations" className={cn("inline-flex min-h-13 items-center gap-2 rounded-2xl bg-white/[0.06] px-6 py-3.5 text-[0.9375rem] font-semibold text-white ring-1 ring-white/15 transition-colors hover:bg-white/10", focus)}>
              <MapPin aria-hidden className="size-4" />{copy.heroLocations}</a>}
          </div>
          <dl className="mt-10 grid max-w-lg grid-cols-[1fr_1fr_1.5fr] divide-x divide-white/10 border-t border-white/10 pt-6">
            {stats.map((stat) => <div key={stat.label} className="min-w-0 px-4 first:pl-0">
              <dt className="text-xs font-medium text-ink-muted">{stat.label}</dt>
              <dd className="font-display mt-1 truncate text-xl font-bold tabular-nums text-white sm:text-3xl">{stat.value}</dd>
            </div>)}
          </dl>
        </div>

        {featured && <div className="relative min-w-0 lg:col-span-6 xl:col-span-7">
          <Link href={`/inventory/${featured.id}`} aria-label={`${copy.featuredView}: ${vehicleTitle(featured)}`}
            className={cn("group relative block overflow-clip rounded-[2rem] shadow-2xl ring-1 ring-white/10", focus)}>
            <VehiclePhoto src={featured.photos[0]} alt="" priority className="aspect-[4/3] rounded-none bg-ink-2 sm:aspect-[16/11] [&_img]:transition-transform [&_img]:duration-500 [&_img]:ease-out group-hover:[&_img]:scale-[1.03]" />
            {/* Bottom scrim only, so the glass panel stays legible on bright photos. */}
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink/85 to-transparent" />
            <span className="absolute top-4 left-4 inline-flex min-h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-bold text-primary-foreground shadow-lg">{copy.featured}</span>
            <div className="absolute inset-x-3 bottom-3 flex items-center gap-4 rounded-[1.375rem] bg-ink/70 p-4 ring-1 ring-white/10 backdrop-blur-md sm:inset-x-4 sm:bottom-4 sm:p-5">
              <div className="min-w-0 flex-1">
                <p className="font-display truncate text-lg font-semibold text-white sm:text-xl">{vehicleTitle(featured)}</p>
                <p className="mt-0.5 truncate text-sm text-ink-muted">{[featured.trim, formatMileage(featured.mileage), locationNames.get(featured.dealershipId)].filter(Boolean).join(" · ")}</p>
              </div>
              <p className="font-display shrink-0 text-xl font-bold tabular-nums text-white sm:text-2xl">{formatPrice(featured.price)}</p>
              <span aria-hidden className="hidden size-11 shrink-0 items-center justify-center rounded-full bg-white text-ink transition-transform duration-200 group-hover:rotate-45 sm:flex"><ArrowUpRight className="size-5" /></span>
            </div>
          </Link>
          <div aria-hidden className="absolute -top-5 -right-2 hidden items-center gap-3 rounded-2xl bg-card p-3 pr-5 text-foreground shadow-xl ring-1 ring-border lg:flex xl:-right-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-success/12 text-success"><BadgeCheck className="size-5" /></span>
            <span><span className="block text-sm font-semibold">{copy.inspected}</span><span className="block text-xs text-muted-foreground">{copy.inspectedHint}</span></span>
          </div>
        </div>}
      </div>
    </section>

    <div className="bg-background pb-12">
      <div className="page-gutter relative z-10 -mt-16 sm:-mt-20">
        {/* Plain GET form: the dropdowns submit through hidden inputs, so search works without client routing. */}
        <form role="search" aria-label={copy.search.label} action="/inventory#vehicles" method="get"
          className="grid gap-1 rounded-[1.75rem] bg-card p-2 shadow-2xl ring-1 ring-border/70 md:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))_auto] xl:items-center">
          <label className="group flex min-h-16 min-w-0 cursor-text items-center gap-3 rounded-[1.125rem] px-4 py-2.5 transition-colors hover:bg-muted/70 focus-within:bg-muted/70 md:col-span-2 xl:col-span-1">
            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground group-hover:bg-card"><Search className="size-[1.125rem]" /></span>
            <span className="min-w-0 flex-1">
              <span className="eyebrow block">{copy.search.keyword}</span>
              <input type="search" name="q" defaultValue={filters.q} maxLength={80} placeholder={copy.search.keywordPlaceholder}
                className="mt-0.5 block w-full min-w-0 bg-transparent text-[0.9375rem] font-semibold outline-none placeholder:font-medium placeholder:text-muted-foreground/80" />
            </span>
          </label>
          <DropdownField name="make" variant="field" label={copy.search.make} icon="car" defaultValue={filters.make ?? ""}
            options={[{ value: "", label: copy.search.anyMake, count: total }, ...facets.makes.map((entry) => ({ value: entry.make, label: entry.make, count: entry.count }))]} />
          <DropdownField name="dealershipId" variant="field" label={copy.search.location} icon="location" defaultValue={filters.dealershipId ?? ""}
            options={[{ value: "", label: copy.allLocations, count: total }, ...dealerships.map((entry) => ({ value: entry.id, label: entry.name, hint: entry.address, count: counts[entry.id] ?? 0 }))]} />
          <DropdownField name="maxPrice" variant="field" label={copy.search.price} icon="price" defaultValue={filters.maxPrice ? String(filters.maxPrice) : ""}
            options={[{ value: "", label: copy.search.anyPrice }, ...priceSteps.map((step) => ({ value: String(step), label: copy.search.under(whole.format(step)) }))]} />
          {filters.sort !== "newest" && <input type="hidden" name="sort" value={filters.sort} />}
          <button type="submit" className={cn("inline-flex min-h-14 items-center justify-center gap-2 rounded-[1.25rem] bg-primary px-7 text-[0.9375rem] font-semibold text-primary-foreground shadow-[0_10px_24px_-10px_color-mix(in_oklab,var(--primary)_80%,transparent)] transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.98] md:col-span-2 xl:col-span-1 xl:ml-1", focus)}>
            <Search aria-hidden className="size-4" />{copy.search.submit}
          </button>
        </form>
      </div>
      <ul aria-label={copy.trustLabel} className="page-gutter mt-10 grid gap-x-6 gap-y-6 sm:grid-cols-2 xl:grid-cols-4">{trust.map(({ key, icon: Icon, title, text }) => <li key={key} className="flex min-w-0 gap-4">
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-primary"><Icon className="size-5" /></span>
        <span className="min-w-0"><span className="block text-sm font-semibold">{title}</span><span className="mt-0.5 block text-sm leading-6 text-muted-foreground">{text}</span></span>
      </li>)}</ul>
    </div>

    <section id="vehicles" aria-labelledby="public-vehicles" className="page-gutter scroll-mt-4 space-y-6 border-t bg-surface py-12 sm:py-16">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <p className="eyebrow">{copy.inventory}</p>
          <h2 id="public-vehicles" className="font-display mt-2 text-3xl font-bold sm:text-4xl">{copy.available}</h2>
          <p className="mt-1.5 text-sm font-medium tabular-nums text-muted-foreground">{copy.results(result.total)}</p>
        </div>
        <form action="/inventory#vehicles" method="get" className="flex items-center gap-2">
          {Object.entries({ dealershipId: filters.dealershipId, q: filters.q || undefined, make: filters.make, maxPrice: filters.maxPrice })
            .flatMap(([key, value]) => value === undefined ? [] : [<input key={key} type="hidden" name={key} value={String(value)} />])}
          <span className="hidden whitespace-nowrap text-sm font-medium text-muted-foreground sm:inline">{copy.sort.label}</span>
          <DropdownField name="sort" label={copy.sort.label} variant="pill" icon="sort" submitOnChange defaultValue={filters.sort}
            options={publicSorts.map((key) => ({ value: key, label: copy.sort[key] }))} className="min-w-52" />
        </form>
      </div>
      <nav aria-label={copy.locationFilter} className="scrollbar-thin flex w-full gap-1.5 overflow-x-auto rounded-[1.25rem] bg-card p-1.5 shadow-xs ring-1 ring-border sm:w-fit sm:max-w-full">
        {[{ id: undefined, name: copy.allLocations, count: total }, ...dealerships.map((entry) => ({ id: entry.id, name: entry.name, count: counts[entry.id] ?? 0 }))].map((entry) => {
          const current = filters.dealershipId === entry.id;
          return <Link key={entry.id ?? "all"} href={`${listHref({ dealershipId: entry.id })}#vehicles`} scroll={false} aria-current={current ? "page" : undefined}
            className={cn("inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-2xl px-4 text-sm font-semibold transition-colors duration-150", focus,
              current ? "bg-ink text-ink-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
            {entry.id ? <MapPin aria-hidden className="size-4 shrink-0" /> : <CarFront aria-hidden className="size-4 shrink-0" />}
            <span className="whitespace-nowrap">{entry.name}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-xs tabular-nums", current ? "bg-white/15 text-white" : "bg-muted text-muted-foreground")}>{entry.count}</span>
          </Link>;
        })}
      </nav>
      {active.length > 0 && <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow mr-1">{copy.activeFilters}</span>
        {active.map((entry) => <Link key={entry.key} href={`${entry.href}#vehicles`} aria-label={copy.removeFilter(entry.label)}
          className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-full bg-brand-soft pr-2 pl-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-primary/15", focus)}>
          {entry.label}<X aria-hidden className="size-3.5 text-muted-foreground" /></Link>)}
        <Link href={`${listHref({ q: undefined, make: undefined, maxPrice: undefined })}#vehicles`} className={cn("ml-1 inline-flex min-h-9 items-center rounded-lg px-2 text-sm font-semibold text-primary hover:underline", focus)}>{copy.clearFilters}</Link>
      </div>}
      {!parsed.success && <p role="alert" className="text-sm font-medium text-destructive">{copy.invalid}</p>}
      {result.vehicles.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 2xl:gap-6">{result.vehicles.map((vehicle) => <article key={vehicle.id} data-stock={vehicle.stockNo}
        className="group relative flex min-w-0 flex-col overflow-clip rounded-[1.375rem] bg-card shadow-md transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-xl has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-offset-2 has-[a:focus-visible]:ring-offset-surface">
        <div className="relative">
          <VehiclePhoto src={vehicle.photos[0]} alt={vehicleTitle(vehicle)} className="aspect-[16/10] rounded-none [&_img]:transition-transform [&_img]:duration-300 [&_img]:ease-out group-hover:[&_img]:scale-[1.03]" />
          <div className="absolute inset-x-3 top-3 flex flex-wrap items-start gap-2">
            <StatusBadgeView kind="vehicle" status={vehicle.status} settings={settings} className="min-h-6 border-transparent bg-background/95 text-foreground shadow-sm backdrop-blur" />
            {vehicle.badge && <PublicBadgePill badge={vehicle.badge} />}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-display break-words text-lg leading-snug font-semibold">
                {/* The whole card is the link target; the title carries the accessible name. */}
                <Link href={`/inventory/${vehicle.id}`} className="after:absolute after:inset-0 after:rounded-[1.375rem] focus-visible:outline-none">{vehicleTitle(vehicle)}</Link>
              </h3>
              {vehicle.trim && <p className="mt-0.5 break-words text-sm text-muted-foreground">{vehicle.trim}</p>}
            </div>
            <p className="shrink-0 text-right"><span className="font-display block text-xl font-bold tabular-nums sm:text-2xl">{formatPrice(vehicle.price)}</span><span className="text-xs font-medium text-muted-foreground">CAD</span></p>
          </div>
          <ul className="flex flex-wrap gap-2 text-xs font-medium text-muted-foreground">
            <li className="inline-flex min-h-7 items-center gap-1.5 rounded-lg bg-muted px-2.5 tabular-nums"><Gauge aria-hidden className="size-3.5 shrink-0" />{formatMileage(vehicle.mileage)}</li>
            <li className="inline-flex min-h-7 min-w-0 max-w-full items-center gap-1.5 rounded-lg bg-muted px-2.5"><MapPin aria-hidden className="size-3.5 shrink-0" /><span className="truncate">{locationNames.get(vehicle.dealershipId)}</span></li>
          </ul>
          <span aria-hidden className="mt-auto inline-flex items-center gap-1.5 border-t pt-4 text-sm font-semibold text-primary">{copy.view}<ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" /></span>
        </div>
      </article>)}</div> : <div className="flex flex-col items-center rounded-[1.375rem] bg-card px-6 py-16 text-center shadow-xs ring-1 ring-border">
        <span aria-hidden className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground"><CarFront className="size-6" /></span>
        <h3 className="font-display mt-5 text-xl font-semibold">{copy.empty}</h3><p className="mt-2 max-w-md text-muted-foreground">{copy.emptyHint}</p>
        {(filters.dealershipId || active.length > 0) && <Link href={`${listHref({ dealershipId: undefined, q: undefined, make: undefined, maxPrice: undefined })}#vehicles`} className={cn("mt-6 inline-flex min-h-11 items-center rounded-xl bg-ink px-5 text-sm font-semibold text-ink-foreground hover:bg-ink/90", focus)}>{copy.showAll}</Link>}
      </div>}
      {result.pageCount > 1 && <nav aria-label={copy.inventory} className="flex flex-wrap items-center justify-center gap-3 pt-2">
        {result.page > 1 && <Link href={`${listHref({ page: result.page - 1 })}#vehicles`} className={cn("inline-flex min-h-11 items-center rounded-xl border bg-card px-5 text-sm font-semibold hover:bg-muted", focus)}>{copy.previous}</Link>}
        <span className="px-2 text-sm font-medium tabular-nums text-muted-foreground">{copy.page(result.page, result.pageCount)}</span>
        {result.page < result.pageCount && <Link href={`${listHref({ page: result.page + 1 })}#vehicles`} className={cn("inline-flex min-h-11 items-center rounded-xl border bg-card px-5 text-sm font-semibold hover:bg-muted", focus)}>{copy.next}</Link>}
      </nav>}
    </section>

    {dealerships.length > 0 && <section aria-labelledby="public-locations" className="page-gutter border-t bg-background py-12 sm:py-16">
      <h2 id="public-locations" className="font-display text-2xl font-bold sm:text-3xl">{copy.locations}</h2>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{dealerships.map((entry) => <li key={entry.id} className="flex min-w-0 flex-col gap-5 rounded-[1.375rem] bg-surface p-5 sm:p-6">
        <div className="flex gap-4">
          <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-primary"><MapPin className="size-5" /></span>
          <div className="min-w-0">
            <p className="font-display break-words text-lg font-semibold">{entry.name}</p>
            <p className="mt-1 break-words text-sm leading-6 text-muted-foreground">{entry.address}</p>
            <a href={tel(entry.phone)} className={cn("mt-1 inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-medium hover:underline", focus)}><Phone aria-hidden className="size-4 text-muted-foreground" />{entry.phone}</a>
          </div>
        </div>
        <Link href={`${listHref({ dealershipId: entry.id, q: undefined, make: undefined, maxPrice: undefined })}#vehicles`} className={cn("mt-auto flex min-h-11 items-center justify-between gap-2 rounded-xl bg-card px-4 text-sm font-semibold shadow-xs transition-colors hover:bg-muted", focus)}>
          <span className="tabular-nums text-muted-foreground">{copy.vehiclesAt(counts[entry.id] ?? 0)}</span><span className="inline-flex items-center gap-1 text-primary">{copy.seeVehicles}<ArrowRight aria-hidden className="size-4" /></span>
        </Link>
      </li>)}</ul>
    </section>}
  </>;
}
