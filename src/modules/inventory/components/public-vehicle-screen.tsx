import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { BadgeCheck, Calendar, CarFront, Gauge, Hash, Landmark, MapPin, Phone, Repeat, ScanLine, Tag, type LucideIcon } from "lucide-react";
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
  const specs: [LucideIcon, string, string][] = [
    [Calendar, copy.year, String(vehicle.year)], [CarFront, copy.make, vehicle.make], [Tag, copy.model, vehicle.model],
    ...(vehicle.trim ? [[Tag, copy.trim, vehicle.trim] as [LucideIcon, string, string]] : []),
    [Gauge, copy.mileage, formatMileage(vehicle.mileage)], [Hash, copy.stock, vehicle.stockNo], [ScanLine, copy.vin, vehicle.vin],
    [MapPin, copy.dealershipLabel, dealership.name],
  ];
  return <div className="space-y-6 pb-24 lg:pb-0">
    <Link href="/inventory" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">← {copy.back}</Link>
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
      <div className="min-w-0 space-y-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2"><StatusBadgeView kind="vehicle" status={vehicle.status} settings={settings} />{vehicle.badge && <PublicBadgePill badge={vehicle.badge} />}</div>
          <h1 className="break-words text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          {vehicle.trim && <p className="break-words text-muted-foreground">{vehicle.trim}</p>}
        </div>
        <PublicGallery photos={vehicle.photos} title={title} />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-sm text-muted-foreground">{copy.price}</p><p className="mt-1 text-3xl font-semibold tabular-nums">{formatPrice(vehicle.price)}</p></div>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Gauge aria-hidden className="size-4" />{formatMileage(vehicle.mileage)}</p>
        </div>
        <ul aria-label={copy.trustLabel} className="grid gap-3 sm:grid-cols-3">{copy.trust.map((item) => {
          const Icon = trustIcons[item.key];
          return <li key={item.key} className="flex gap-3 rounded-xl border bg-card p-4 sm:flex-col sm:gap-2">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon aria-hidden className="size-5" /></span>
            <span className="min-w-0"><span className="block text-sm font-semibold">{item.title}</span><span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{item.text}</span></span>
          </li>;
        })}</ul>
        <section aria-labelledby="key-specs" className="rounded-xl border p-5">
          <h2 id="key-specs" className="text-lg font-semibold">{copy.keySpecs}</h2>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">{specs.map(([Icon, label, value]) => <div key={label} className="flex min-w-0 gap-2.5">
            <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5 break-words text-sm font-medium">{value}</dd></div>
          </div>)}</dl>
        </section>
        <section className="space-y-2 rounded-xl bg-muted/40 p-5"><h2 className="text-lg font-semibold">{copy.location}</h2>
          <p className="break-words font-medium">{dealership.name}</p><p className="break-words text-sm text-muted-foreground">{dealership.address}</p>
          <a href={`tel:${dealership.phone.replace(/[^\d+]/g, "")}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline"><Phone aria-hidden className="size-4" />{copy.call(dealership.phone)}</a>
        </section>
      </div>
      <div className="min-w-0 lg:sticky lg:top-6">
        <InquiryForm key={`${vehicle.id}-${testDrive ? "test-drive" : "inquiry"}`} id={FORM_ID} vehicleId={vehicle.id}
          {...(testDrive ? { title: copy.testDriveTitle, intro: copy.testDriveIntro, defaultMessage: copy.testDriveMessage } : {})} />
      </div>
    </div>
    <PublicStickyCta price={formatPrice(vehicle.price)} testDriveHref={`${path}?intent=test-drive#${FORM_ID}`} inquireHref={`${path}#${FORM_ID}`} targetId={FORM_ID} />
  </div>;
}
