import { requestNow } from "@/lib/clock";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadgeView } from "@/components/shared/status-badge-view";
import { requirePageUser } from "@/modules/auth/page-guards";
import { listLeadAppointments } from "@/modules/appointments/service";
import { appointmentsCopy } from "@/modules/appointments/copy";
import { listDealerships } from "@/modules/dealerships/service";
import { getVehicle } from "@/modules/inventory/service";
import { VehiclePhoto } from "@/modules/inventory/components/vehicle-photo";
import { formatPrice, formatTimestamp, vehicleTitle } from "@/modules/inventory/copy";
import { getSettings } from "@/modules/settings/service";
import { getStaffNames, listSalespeople } from "@/modules/users/service";
import { getLead } from "../service";
import { leadsCopy as copy, leadAge } from "../copy";
import { NoteForm, ReassignControl, StageControl } from "./lead-controls";

export async function LeadScreen({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const owner = user.role === "owner";
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) notFound();
  const [settings, dealerships, vehicle, appointments, salespeople] = await Promise.all([
    getSettings(), listDealerships(), getVehicle(lead.vehicleId), listLeadAppointments(lead.id), owner ? listSalespeople() : [],
  ]);
  const actorIds = [...lead.activity.map((entry) => entry.actorId), lead.assignedTo, ...appointments.map((entry) => entry.salespersonId)];
  const names = await getStaffNames([...new Set(actorIds.filter((value): value is string => Boolean(value)))]);
  const staffName = (staffId: string) => names.find((entry) => entry.id === staffId)?.name ?? copy.unknownStaff;
  // Null actors are the customer (inquiry, online booking) or automatic assignment.
  const actor = (entry: (typeof lead.activity)[number]) => entry.actorId ? staffName(entry.actorId) : entry.type === "lead.assigned" ? copy.systemActor : copy.customerActor;
  const zone = settings.booking.timeZone;
  const eligible = salespeople.filter((person) => person.active && person.dealershipId === lead.dealershipId);
  const ref = { id: lead.id, name: lead.name, stage: lead.stage, assignedTo: lead.assignedTo };
  const upcoming = appointments.filter((entry) => entry.status === "booked");
  const now = requestNow();
  return <>
    <Button asChild variant="ghost" className="min-h-11 self-start"><Link href="/crm/leads">← {copy.back}</Link></Button>
    <header className="space-y-3">
      <div className="min-w-0"><p className="text-sm text-muted-foreground">{copy.received} {leadAge(lead.createdAt, now)} · {formatTimestamp(lead.createdAt, zone)}</p>
        <h1 className="mt-1 break-words text-3xl font-semibold tracking-tight">{lead.name}</h1></div>
      <div className="flex flex-wrap gap-2">
        <StageControl lead={ref} settings={settings} />
        {owner && <ReassignControl lead={ref} salespeople={eligible.map(({ id, name }) => ({ id, name }))} primaryColor={settings.brand.primaryColor} />}
      </div>
    </header>
    <div className="grid gap-2 sm:grid-cols-2">
      <Button asChild className="min-h-12 justify-start gap-3"><a href={`tel:${lead.phone.replace(/[^+\d]/g, "")}`}><Phone aria-hidden className="size-5" /><span className="min-w-0 truncate">{copy.call} {lead.phone}</span></a></Button>
      <Button asChild variant="outline" className="min-h-12 justify-start gap-3"><a href={`mailto:${lead.email}`}><Mail aria-hidden className="size-5" /><span className="min-w-0 truncate">{lead.email}</span></a></Button>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="min-w-0 rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">{copy.details}</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">{[
          [copy.assignee, lead.assignedTo ? staffName(lead.assignedTo) : copy.unassigned],
          [copy.dealership, dealerships.find((item) => item.id === lead.dealershipId)?.name ?? copy.unknownDealership],
          [copy.source, copy.sources[lead.source] ?? lead.source],
          [copy.received, formatTimestamp(lead.createdAt, zone)],
        ].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{value}</dd></div>)}</dl>
        <h3 className="mt-5 text-xs text-muted-foreground">{copy.message}</h3>
        <p className="mt-1 whitespace-pre-line break-words text-sm">{lead.message || copy.noMessage}</p>
      </section>
      <section className="min-w-0 rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">{copy.vehicleCard}</h2>
        {vehicle ? <Link href={`/crm/inventory/${vehicle.id}`} className="mt-4 flex min-w-0 gap-4 rounded-xl focus-visible:outline-2 focus-visible:outline-ring">
          <div className="w-28 shrink-0 sm:w-36"><VehiclePhoto src={vehicle.photos[0]} alt={vehicleTitle(vehicle)} /></div>
          <div className="min-w-0 space-y-1">
            <p className="text-xs text-muted-foreground">{vehicle.stockNo}</p>
            <p className="break-words font-semibold hover:underline">{vehicleTitle(vehicle)}</p>
            <p className="text-sm text-muted-foreground">{vehicle.trim}</p>
            <p className="font-semibold tabular-nums">{formatPrice(vehicle.price)}</p>
            <StatusBadgeView kind="vehicle" status={vehicle.status} settings={settings} />
          </div>
        </Link> : <p className="mt-3 text-sm text-muted-foreground">{copy.unknownVehicle}</p>}
      </section>
    </div>
    <section className="rounded-xl border bg-card p-5">
      <h2 className="text-lg font-semibold">{copy.appointment}</h2>
      {!upcoming.length ? <p className="mt-3 text-sm text-muted-foreground">{copy.noAppointment}</p> : <ul className="mt-4 space-y-3">{upcoming.map((entry) => <li key={entry.id} className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarClock aria-hidden className="size-5" /></span>
        <div className="min-w-0"><p className="font-medium">{formatTimestamp(entry.startsAt, zone)}</p><p className="text-sm text-muted-foreground">{appointmentsCopy.with(staffName(entry.salespersonId))}</p></div>
      </li>)}</ul>}
    </section>
    <section className="rounded-xl border bg-card p-5"><NoteForm leadId={lead.id} /></section>
    <section className="rounded-xl border bg-card p-5">
      <h2 className="text-lg font-semibold">{copy.activity}</h2>
      {!lead.activity.length ? <p className="mt-3 text-sm text-muted-foreground">{copy.noActivity}</p> : <ol className="mt-4 space-y-4">
        {lead.activity.toSorted((a, b) => b.occurredAt.localeCompare(a.occurredAt)).map((entry, index) => <li key={entry.eventId ?? index} className={`border-l-2 pl-3 ${entry.type === "note" ? "border-primary" : ""}`}>
          <p className="whitespace-pre-line break-words text-sm font-medium">{entry.message}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{actor(entry)} · {formatTimestamp(entry.occurredAt, zone)}</p>
        </li>)}
      </ol>}
    </section>
  </>;
}
