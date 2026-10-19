import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, ChevronRight, Gauge, Landmark, MapPin, Phone, Repeat, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { listPublicDealerships } from "@/modules/dealerships/service";
import { getSettings } from "@/modules/settings/service";
import { StatusBadgeView } from "@/components/shared/status-badge-view";
import { InquiryForm } from "@/modules/leads/components/inquiry-form";
import { getPublicVehicle } from "../service";
import { formatMileage, formatPrice, vehicleTitle } from "../copy";
import { publicInventoryCopy as copy } from "../public-copy";
import { PublicBadgePill } from "./public-badge";
import { PublicGallery } from "./public-gallery";
import { PublicStickyCta } from "./public-sticky-cta";

const trustIcons: Record<(typeof copy.trust)[number]["key"], LucideIcon> = { inspected: BadgeCheck, financing: Landmark, trade: Repeat };
const FORM_ID = "inquire";
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export async function PublicVehicleScreen({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Live stock: render at request time rather than prerendering database reads.
  await connection();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const vehicle = await getPublicVehicle(id);
  if (!vehicle) notFound();
  const [dealerships, settings] = await Promise.all([listPublicDealerships(), getSettings()]);
  const dealership = dealerships.find((entry) => entry.id === vehicle.dealershipId);
  if (!dealership) notFound();
  const title = vehicleTitle(vehicle);
  const testDrive = query.intent === "test-drive";
  const path = `/inventory/${vehicle.id}`;
  const phoneHref = `tel:${dealership.phone.replace(/[^\d+]/g, "")}`;
  const specs: [string, string, boolean][] = [
    [copy.year, String(vehicle.year), false], [copy.make, vehicle.make, false], [copy.model, vehicle.model, false],
    ...(vehicle.trim ? [[copy.trim, vehicle.trim, false] as [string, string, boolean]] : []),
    [copy.mileage, formatMileage(vehicle.mileage), false], [copy.stock, vehicle.stockNo, true], [copy.vin, vehicle.vin, true],
    [copy.dealershipLabel, dealership.name, false],
  ];
  return <div className="page-gutter pt-4 pb-28 sm:pt-6 lg:pb-16">
    <nav aria-label={copy.breadcrumb}>
      <ol className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
        <li className="shrink-0"><Link href="/inventory" className={cn("inline-flex min-h-11 items-center gap-1.5 rounded-lg pr-1 font-medium transition-colors hover:text-foreground", focus)}>
          <ArrowLeft aria-hidden className="size-4" />{copy.inventoryCrumb}</Link></li>
        <li aria-hidden className="shrink-0"><ChevronRight className="size-4" /></li>
        <li aria-current="page" className="min-w-0 truncate font-medium text-foreground">{title}</li>
      </ol>
    </nav>
    <div className="mt-2 grid items-start gap-8 lg:grid-cols-12 lg:grid-rows-[auto_1fr] xl:gap-x-10">
      <div className="relative min-w-0 lg:col-span-7 lg:row-start-1 xl:col-span-8">
        <PublicGallery photos={vehicle.photos} title={title} />
        <div className="pointer-events-none absolute top-4 left-4 flex flex-wrap items-start gap-2 pr-4">
          <StatusBadgeView kind="vehicle" status={vehicle.status} settings={settings} className="min-h-7 border-transparent bg-background/95 px-3 text-foreground shadow-md backdrop-blur" />
          {vehicle.badge && <PublicBadgePill badge={vehicle.badge} className="min-h-7 px-3" />}
        </div>
      </div>
      <aside aria-labelledby="vehicle-title" className="min-w-0 lg:sticky lg:top-6 lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1 xl:col-span-4 xl:col-start-9">
        <div className="rounded-[1.75rem] border bg-card p-5 shadow-lg sm:p-7">
          <p className="font-mono text-xs break-all text-muted-foreground">{copy.stockShort} {vehicle.stockNo} · {copy.vin} {vehicle.vin}</p>
          <h1 id="vehicle-title" className="font-display mt-3 break-words text-2xl font-bold sm:text-3xl">{title}</h1>
          {vehicle.trim && <p className="mt-1 break-words text-muted-foreground">{vehicle.trim}</p>}
          <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
            <div><p className="eyebrow">{copy.price}</p><p className="font-display mt-1 text-4xl font-extrabold tabular-nums">{formatPrice(vehicle.price)}</p></div>
            <p className="inline-flex min-h-7 items-center gap-1.5 rounded-lg bg-muted px-2.5 text-xs font-medium tabular-nums text-muted-foreground"><Gauge aria-hidden className="size-3.5" />{formatMileage(vehicle.mileage)}</p>
          </div>
          <div className="mt-6 flex items-center gap-3 rounded-2xl bg-surface p-3.5">
            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-primary"><MapPin className="size-[1.125rem]" /></span>
            <div className="min-w-0"><p className="truncate text-sm font-semibold">{dealership.name}</p><p className="truncate text-xs text-muted-foreground">{dealership.address}</p></div>
          </div>
          <div className="mt-6 border-t pt-6">
            <InquiryForm key={`${vehicle.id}-${testDrive ? "test-drive" : "inquiry"}`} id={FORM_ID} vehicleId={vehicle.id}
              {...(testDrive ? { title: copy.testDriveTitle, intro: copy.testDriveIntro, defaultMessage: copy.testDriveMessage } : {})} />
          </div>
          <a href={phoneHref} className={cn("mt-3 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-ink px-5 text-[0.9375rem] font-semibold text-ink-foreground transition-colors hover:bg-ink/90", focus)}>
            <Phone aria-hidden className="size-4" />{copy.call(dealership.phone)}</a>
        </div>
      </aside>
      <div className="min-w-0 space-y-10 lg:col-span-7 lg:row-start-2 xl:col-span-8">
        <section aria-labelledby="key-specs">
          <h2 id="key-specs" className="font-display text-2xl font-bold">{copy.keySpecs}</h2>
          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">{specs.map(([label, value, mono]) => <div key={label} className="min-w-0 rounded-2xl bg-muted p-4">
            <dt className="eyebrow">{label}</dt>
            <dd className={cn("mt-1.5 break-words text-sm font-semibold", mono && "font-mono text-[0.8125rem] break-all")}>{value}</dd>
          </div>)}</dl>
        </section>
        <ul aria-label={copy.trustLabel} className="grid gap-3 sm:grid-cols-3">{copy.trust.map((item) => {
          const Icon = trustIcons[item.key];
          return <li key={item.key} className="flex gap-4 rounded-2xl bg-card p-5 shadow-xs ring-1 ring-border sm:flex-col sm:gap-3">
            <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-primary"><Icon className="size-5" /></span>
            <span className="min-w-0"><span className="block text-sm font-semibold">{item.title}</span><span className="mt-1 block text-sm leading-6 text-muted-foreground">{item.text}</span></span>
          </li>;
        })}</ul>
        <section aria-labelledby="visit-dealership" className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-xs ring-1 ring-border sm:flex-row sm:items-center sm:p-6">
          <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground/70"><MapPin className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="visit-dealership" className="eyebrow">{copy.location}</h2>
            <p className="font-display mt-1 break-words text-lg font-semibold">{dealership.name}</p>
            <p className="break-words text-sm text-muted-foreground">{dealership.address}</p>
          </div>
          <a href={phoneHref} className={cn("inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border bg-card px-4 text-sm font-semibold transition-colors hover:bg-muted", focus)}><Phone aria-hidden className="size-4" />{copy.call(dealership.phone)}</a>
        </section>
      </div>
    </div>
    <PublicStickyCta price={formatPrice(vehicle.price)} testDriveHref={`${path}?intent=test-drive#${FORM_ID}`} inquireHref={`${path}#${FORM_ID}`} targetId={FORM_ID} />
  </div>;
}
