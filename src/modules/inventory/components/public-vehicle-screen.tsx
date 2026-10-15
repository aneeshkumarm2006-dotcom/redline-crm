import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { listPublicDealerships } from "@/modules/dealerships/service";
import { getSettings } from "@/modules/settings/service";
import { StatusBadgeView } from "@/components/shared/status-badge-view";
import { InquiryForm } from "@/modules/leads/components/inquiry-form";
import { getPublicVehicle } from "../service";
import { formatMileage, formatPrice, vehicleTitle } from "../copy";
import { publicInventoryCopy as copy } from "../public-copy";
import { VehiclePhoto } from "./vehicle-photo";

export async function PublicVehicleScreen({ params }: { params: Promise<{ id: string }> }) {
  // Live stock: render at request time rather than prerendering database reads.
  await connection();
  const { id } = await params;
  const vehicle = await getPublicVehicle(id);
  if (!vehicle) notFound();
  const [dealerships, settings] = await Promise.all([listPublicDealerships(), getSettings()]);
  const dealership = dealerships.find((entry) => entry.id === vehicle.dealershipId);
  if (!dealership) notFound();
  const title = vehicleTitle(vehicle);
  return <div className="space-y-6">
    <Link href="/inventory" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">← {copy.back}</Link>
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
      <div className="min-w-0 space-y-6">
        <div className="space-y-3"><StatusBadgeView kind="vehicle" status={vehicle.status} settings={settings} /><h1 className="break-words text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1><p className="break-words text-muted-foreground">{vehicle.trim}</p></div>
        <section aria-label={copy.photos} className="space-y-3"><VehiclePhoto src={vehicle.photos[0]} alt={copy.photo(title, 0)} />
          {vehicle.photos.length > 1 && <div className="grid grid-cols-2 gap-3">{vehicle.photos.slice(1).map((src, index) => <VehiclePhoto key={`${src}-${index}`} src={src} alt={copy.photo(title, index + 1)} />)}</div>}
        </section>
        <div><p className="text-sm text-muted-foreground">{copy.price}</p><p className="mt-1 text-3xl font-semibold">{formatPrice(vehicle.price)}</p></div>
        <section className="rounded-xl border p-5"><h2 className="text-lg font-semibold">{copy.specs}</h2><dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[[copy.mileage, formatMileage(vehicle.mileage)], [copy.stock, vehicle.stockNo], [copy.vin, vehicle.vin], ...(vehicle.trim ? [[copy.trim, vehicle.trim]] : [])].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}
        </dl></section>
        <section className="space-y-2 rounded-xl bg-muted/40 p-5"><h2 className="text-lg font-semibold">{copy.location}</h2><p className="break-words font-medium">{dealership.name}</p><p className="break-words text-sm text-muted-foreground">{dealership.address}</p><p className="text-sm">{dealership.phone}</p></section>
      </div>
      <div className="min-w-0 lg:sticky lg:top-6"><InquiryForm key={vehicle.id} vehicleId={vehicle.id} /></div>
    </div>
  </div>;
}

