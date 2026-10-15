import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusBadgeView } from "@/components/shared/status-badge-view";
import { requirePageUser } from "@/modules/auth/page-guards";
import { listDealerships } from "@/modules/dealerships/service";
import { listVehicleLeads } from "@/modules/leads/service";
import { getSettings } from "@/modules/settings/service";
import { getVehicle } from "../service";
import { inventoryCopy as copy, formatDate, formatTimestamp, formatPrice, formatMileage, vehicleTitle } from "../copy";
import { VehiclePhoto } from "./vehicle-photo";
import { VehicleControls } from "./vehicle-controls";
import { VehicleForm } from "./vehicle-form";
import { getStaffNames } from "@/modules/users/service";

export async function VehicleScreen({ params, edit = false }: { params: Promise<{ id: string }>; edit?: boolean }) {
  const user = await requirePageUser(...(edit ? ["owner" as const] : []));
  const { id } = await params;
  const vehicle = await getVehicle(id);
  if (!vehicle) notFound();
  const [settings, dealerships] = await Promise.all([getSettings(), listDealerships()]);
  if (edit) return <><h1 className="text-3xl font-semibold">{copy.edit}</h1><p className="text-sm text-muted-foreground">{copy.formHint}</p><VehicleForm vehicle={vehicle} settings={settings} dealerships={dealerships} today="" /></>;
  const [leads, names] = await Promise.all([listVehicleLeads(id), getStaffNames([...new Set([...vehicle.priceHistory, ...vehicle.statusHistory].map((entry) => entry.changedBy))])]);
  const actor = (id: string) => names.find((entry) => entry.id === id)?.name ?? copy.unknownActor;
  const statusLabel = (key: string) => settings.vehicleStatuses.find((status) => status.key === key)?.label ?? key;
  return <>
    <Button asChild variant="ghost" className="min-h-11 self-start"><Link href="/crm/inventory">← {copy.back}</Link></Button>
    <header className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="text-sm text-muted-foreground">{vehicle.stockNo}</p><h1 className="mt-1 break-words text-3xl font-semibold tracking-tight">{vehicleTitle(vehicle)}</h1><p className="mt-2 text-muted-foreground">{vehicle.trim}</p></div>{user.role === "owner" && <Button asChild variant="outline" className="min-h-11"><Link href={`/crm/inventory/${id}/edit`}>{copy.edit}</Link></Button>}</header>
    <div className="flex flex-wrap items-center gap-3"><span className="mr-auto text-3xl font-semibold">{formatPrice(vehicle.price)}</span>{user.role === "owner" ? <><VehicleControls vehicle={vehicle} settings={settings} /><VehicleControls vehicle={vehicle} settings={settings} price /></> : <StatusBadgeView kind="vehicle" status={vehicle.status} settings={settings} />}</div>
    <section aria-label={copy.photos} className="grid gap-3 sm:grid-cols-2">{(vehicle.photos.length ? vehicle.photos : [undefined]).map((src, index) => <VehiclePhoto key={`${src}-${index}`} src={src} alt={`${vehicleTitle(vehicle)} · ${index + 1}`} />)}</section>
    <section className="rounded-xl border bg-card p-5"><h2 className="text-lg font-semibold">{copy.specs}</h2><dl className="mt-4 grid gap-4 sm:grid-cols-2">{[
      [copy.fields.vin, vehicle.vin], [copy.fields.stockNo, vehicle.stockNo], [copy.fields.year, vehicle.year], [copy.fields.make, vehicle.make], [copy.fields.model, vehicle.model], [copy.fields.trim, vehicle.trim || "—"],
      [copy.fields.mileage, formatMileage(vehicle.mileage)], [copy.dealership, dealerships.find((item) => item.id === vehicle.dealershipId)?.name ?? copy.unknownDealership], [copy.fields.dateInStock, formatDate(vehicle.dateInStock)],
    ].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{value}</dd></div>)}</dl></section>
    <section className="rounded-xl border bg-card p-5"><h2 className="text-lg font-semibold">{copy.leads}</h2>{!leads.length ? <p className="mt-3 text-sm text-muted-foreground">{copy.noLeads}</p> : <ul className="mt-4 divide-y">{leads.map((lead) => <li key={lead.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="font-medium">{lead.name}</p><p className="break-all text-sm text-muted-foreground">{lead.email}</p><p className="text-sm text-muted-foreground">{lead.phone}</p></div><StatusBadgeView kind="lead" status={lead.stage} settings={settings} /></li>)}</ul>}</section>
    <div className="grid gap-4 xl:grid-cols-2">{(["price", "status"] as const).map((kind) => <section key={kind} className="min-w-0 rounded-xl border bg-card p-5"><h2 className="text-lg font-semibold">{kind === "price" ? copy.priceHistory : copy.statusHistory}</h2>
      {!(kind === "price" ? vehicle.priceHistory : vehicle.statusHistory).length && <p className="mt-3 text-sm text-muted-foreground">{copy.noHistory}</p>}
      <ol className="mt-4 space-y-4">{(kind === "price" ? vehicle.priceHistory : vehicle.statusHistory).toReversed().map((entry, index) => <li key={index} className="border-l-2 pl-3"><p className="break-words text-sm font-medium">{"price" in entry ? `${formatPrice(entry.previousPrice)} → ${formatPrice(entry.price)}` : `${statusLabel(entry.previousStatus)} → ${statusLabel(entry.status)}`}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{actor(entry.changedBy)} · {formatTimestamp(entry.changedAt, settings.booking.timeZone)}</p></li>)}</ol>
    </section>)}</div>
  </>;
}

export async function NewVehicleScreen() {
  await requirePageUser("owner");
  const [settings, dealerships] = await Promise.all([getSettings(), listDealerships()]);
  return <><h1 className="text-3xl font-semibold">{copy.add}</h1><p className="text-sm text-muted-foreground">{copy.formHint}</p><VehicleForm settings={settings} dealerships={dealerships} today={new Date().toISOString().slice(0, 10)} /></>;
}
