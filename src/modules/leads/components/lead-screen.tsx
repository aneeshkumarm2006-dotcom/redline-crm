import { requestNow } from "@/lib/clock";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bot, CalendarClock, History, Mail, Phone, PhoneCall, StickyNote } from "lucide-react";
import { getConversation } from "@/modules/assistant/service";
import { ConversationPanel } from "@/modules/assistant/components/conversation-panel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StatusBadgeView } from "@/components/shared/status-badge-view";
import { StatusPill, resolvePill } from "@/components/shared/status-pill";
import { PageHeader } from "@/components/shared/page-header";
import { requirePageUser } from "@/modules/auth/page-guards";
import { listLeadAppointments } from "@/modules/appointments/service";
import { appointmentsCopy } from "@/modules/appointments/copy";
import { StaffBookingControl } from "@/modules/appointments/components/staff-booking";
import { EmailList } from "@/modules/automations/components/email-list";
import { getLeadJourney } from "@/modules/coordinator/service";
import { JourneyStepper } from "@/modules/coordinator/components/journey-stepper";
import { SendEmailControl } from "@/modules/coordinator/components/send-email-control";
import { coordinatorCopy } from "@/modules/coordinator/copy";
import { listDealerships } from "@/modules/dealerships/service";
import { getVehicle } from "@/modules/inventory/service";
import { VehiclePhoto } from "@/modules/inventory/components/vehicle-photo";
import { formatPrice, formatTimestamp, vehicleTitle } from "@/modules/inventory/copy";
import { getSettings } from "@/modules/settings/service";
import { getStaffNames, listSalespeople } from "@/modules/users/service";
import { firstStageKey, getLead, listLeadEmails, nextOpenStage } from "../service";
import { leadsCopy as copy, leadAge } from "../copy";
import { LogCallControl, NoteForm, ReassignControl, StageControl } from "./lead-controls";

const tabs = ["overview", "conversation", "emails", "activity"] as const;
type Tab = (typeof tabs)[number];

export async function LeadScreen({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePageUser();
  const owner = user.role === "owner";
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const tab: Tab = tabs.find((entry) => entry === query.tab) ?? "overview";
  const lead = await getLead(id);
  if (!lead) notFound();
  const [settings, dealerships, vehicle, appointments, salespeople, journey, emails, conversation] = await Promise.all([
    getSettings(), listDealerships(), getVehicle(lead.vehicleId), listLeadAppointments(lead.id), owner ? listSalespeople() : [],
    getLeadJourney(lead.id), listLeadEmails(lead.id), getConversation(lead.id),
  ]);
  const drafts = conversation?.messages.filter((entry) => entry.status === "draft").length ?? 0;
  const actorIds = [...lead.activity.map((entry) => entry.actorId), lead.assignedTo, ...appointments.map((entry) => entry.salespersonId)];
  const names = await getStaffNames([...new Set(actorIds.filter((value): value is string => Boolean(value)))]);
  const staffName = (staffId: string) => names.find((entry) => entry.id === staffId)?.name ?? copy.unknownStaff;
  // Null actors are the customer (inquiry, online booking) or an automation (assignment, CRM stage update).
  const actor = (entry: (typeof lead.activity)[number]) => entry.actorId ? staffName(entry.actorId)
    : entry.type === "lead.created" || entry.type === "appointment.booked" || entry.type === "customer_email" ? copy.customerActor
    : entry.type === "assistant" ? copy.assistantActor(settings.assistant.name) : copy.systemActor;
  const zone = settings.booking.timeZone;
  const eligible = salespeople.filter((person) => person.active && person.dealershipId === lead.dealershipId);
  const ref = { id: lead.id, name: lead.name, stage: lead.stage, assignedTo: lead.assignedTo };
  const now = requestNow();
  const upcoming = appointments.filter((entry) => entry.status === "booked");
  // Log call offers "Move to <next stage>" only while the lead is still in the first stage.
  const next = lead.stage === firstStageKey(settings) ? nextOpenStage(settings, lead.stage) : null;
  const source = resolvePill(settings.leadSources, lead.source);
  const primary = settings.brand.primaryColor;
  const tabHref = (entry: Tab) => entry === "overview" ? `/crm/leads/${lead.id}` : `/crm/leads/${lead.id}?tab=${entry}`;
  const panel = "min-w-0 rounded-2xl border bg-card p-5 shadow-xs sm:p-6";
  const touched = (type: string) => type === "note" || type === "call" || type === "email" || type === "customer_email" || type === "assistant";
  const activityIcon = (type: string) => type === "note" ? StickyNote : type === "call" ? PhoneCall : type === "email" || type === "customer_email" ? Mail : type === "assistant" ? Bot : History;
  return <>
    <PageHeader eyebrow={<Link href="/crm/leads" className="-my-2 inline-flex min-h-11 items-center gap-1.5 rounded-md hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
      <ArrowLeft aria-hidden className="size-3.5" />{copy.back}</Link>}
      title={lead.name}
      description={<span className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        {source && <StatusPill option={source} className="min-h-7 px-3" />}
        <span>{copy.received} {leadAge(lead.createdAt, now)} · <span className="tabular-nums">{formatTimestamp(lead.createdAt, zone)}</span></span>
      </span>}
      actions={<>
        <StageControl lead={ref} settings={settings} />
        {owner && <ReassignControl lead={ref} salespeople={eligible.map(({ id, name }) => ({ id, name }))} primaryColor={primary} label={lead.assignedTo ? copy.reassign : coordinatorCopy.assign} />}
      </>}>
      <section aria-label={copy.quickActions} className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Button asChild className="min-h-12 justify-start gap-3 rounded-xl"><a href={`tel:${lead.phone.replace(/[^+\d]/g, "")}`}><Phone aria-hidden className="size-5" /><span className="min-w-0 truncate">{copy.call} {lead.phone}</span></a></Button>
        <LogCallControl lead={ref} nextStage={next} primaryColor={primary} />
        <SendEmailControl leadId={lead.id} name={lead.name} email={lead.email} hasAppointment={upcoming.some((entry) => Date.parse(entry.endsAt) > now)} primaryColor={primary} />
        <StaffBookingControl leadId={lead.id} name={lead.name} primaryColor={primary} />
      </section>
    </PageHeader>
    {journey && <section aria-labelledby="lead-journey" className="rounded-[1.25rem] bg-ink p-5 text-ink-foreground shadow-md sm:p-6">
      <div className="mb-6 lg:mb-7">
        <h2 id="lead-journey" className="text-lg font-semibold tracking-tight">{coordinatorCopy.journey}</h2>
        <p className="mt-0.5 text-sm text-ink-muted">{coordinatorCopy.journeyHint}</p>
      </div>
      <JourneyStepper steps={journey.steps} names={journey.names} assignee={journey.assignee} timeZone={zone} />
    </section>}
    <div className="space-y-5">
      <nav aria-label={copy.tabsLabel} className="scrollbar-thin -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="inline-flex min-w-max gap-1 rounded-xl bg-muted p-1">{tabs.map((entry) => <li key={entry}>
          <Link href={tabHref(entry)} aria-current={tab === entry ? "page" : undefined} scroll={false}
            className={cn("inline-flex min-h-10 items-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              tab === entry ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground")}>
            {copy.detailTabs[entry]}
            {entry === "emails" && <span className={cn("rounded-full px-1.5 text-xs font-semibold tabular-nums", tab === entry ? "bg-muted text-foreground" : "bg-card text-muted-foreground")}>{emails.length}</span>}
            {entry === "conversation" && drafts > 0 && <span className="rounded-full bg-primary px-1.5 text-xs font-semibold tabular-nums text-primary-foreground">{drafts}</span>}
          </Link>
        </li>)}</ul>
      </nav>
      {tab === "overview" && <div className="grid gap-4 sm:gap-5 xl:grid-cols-12">
        <section aria-labelledby="lead-details" className={cn(panel, "xl:col-span-7")}>
          <h2 id="lead-details" className="text-[0.9375rem] font-semibold tracking-tight">{copy.details}</h2>
          <dl className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2">{[
            [copy.assignee, lead.assignedTo ? staffName(lead.assignedTo) : copy.unassigned],
            [copy.dealership, dealerships.find((item) => item.id === lead.dealershipId)?.name ?? copy.unknownDealership],
            [copy.source, lead.utmSource ? copy.sourceVia(source?.label ?? lead.source, lead.utmSource) : source?.label ?? lead.source],
            [copy.received, formatTimestamp(lead.createdAt, zone)],
            [copy.emailField, lead.email],
            [copy.phone, lead.phone],
          ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="eyebrow">{label}</dt><dd className="mt-1.5 break-words text-sm font-medium">{value}</dd></div>)}</dl>
          <div className="mt-6 rounded-xl bg-muted/60 p-4">
            <h3 className="eyebrow">{copy.message}</h3>
            <p className="mt-1.5 whitespace-pre-line break-words text-sm leading-6">{lead.message || copy.noMessage}</p>
          </div>
          <Button asChild variant="outline" className="mt-5 min-h-11 gap-2"><a href={`mailto:${lead.email}`}><Mail aria-hidden className="size-4" />{copy.email}</a></Button>
        </section>
        <div className="grid min-w-0 content-start gap-4 sm:gap-5 xl:col-span-5">
          <section aria-labelledby="lead-vehicle" className={panel}>
            <h2 id="lead-vehicle" className="text-[0.9375rem] font-semibold tracking-tight">{copy.vehicleCard}</h2>
            {vehicle ? <Link href={`/crm/inventory/${vehicle.id}`} className="group mt-4 flex min-w-0 gap-4 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              <div className="w-28 shrink-0 overflow-hidden rounded-xl sm:w-36"><VehiclePhoto src={vehicle.photos[0]} alt={vehicleTitle(vehicle)} /></div>
              <div className="min-w-0 space-y-1">
                <p className="font-mono text-xs text-muted-foreground">{vehicle.stockNo}</p>
                <p className="break-words font-semibold group-hover:underline">{vehicleTitle(vehicle)}</p>
                <p className="text-sm text-muted-foreground">{vehicle.trim}</p>
                <p className="font-display text-lg font-semibold tabular-nums">{formatPrice(vehicle.price)}</p>
                <StatusBadgeView kind="vehicle" status={vehicle.status} settings={settings} />
              </div>
            </Link> : <p className="mt-3 text-sm text-muted-foreground">{copy.unknownVehicle}</p>}
          </section>
          <section aria-labelledby="lead-appointment" className={panel}>
            <h2 id="lead-appointment" className="text-[0.9375rem] font-semibold tracking-tight">{copy.appointment}</h2>
            {!upcoming.length ? <p className="mt-3 text-sm text-muted-foreground">{copy.noAppointment}</p> : <ul className="mt-2 divide-y">{upcoming.map((entry) => <li key={entry.id} className="flex items-center gap-3.5 py-3 last:pb-0">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-primary"><CalendarClock aria-hidden className="size-5" /></span>
              <div className="min-w-0"><p className="font-semibold tabular-nums">{formatTimestamp(entry.startsAt, zone)}</p><p className="text-sm text-muted-foreground">{appointmentsCopy.with(staffName(entry.salespersonId))}</p></div>
            </li>)}</ul>}
          </section>
        </div>
      </div>}
      {tab === "conversation" && conversation && <ConversationPanel leadId={lead.id} view={conversation} timeZone={zone} email={lead.email} />}
      {tab === "emails" && <section aria-labelledby="lead-emails" className="space-y-4">
        <h2 id="lead-emails" className="text-lg font-semibold tracking-tight">{copy.emailsTitle}</h2>
        <EmailList emails={emails} timeZone={zone} brand={settings.brand} copy={{ label: copy.emailsTitle, empty: copy.noEmails, sent: copy.emailSent, failed: copy.emailFailed,
          preview: copy.preview, to: copy.emailTo, previewTitle: copy.previewTitle }} />
      </section>}
      {tab === "activity" && <div className="grid gap-4 sm:gap-5 xl:grid-cols-12">
        <section className={cn(panel, "self-start xl:col-span-5")}><NoteForm leadId={lead.id} /></section>
        <section aria-labelledby="lead-activity" className={cn(panel, "xl:col-span-7")}>
          <h2 id="lead-activity" className="text-[0.9375rem] font-semibold tracking-tight">{copy.activity}</h2>
          {!lead.activity.length ? <p className="mt-3 text-sm text-muted-foreground">{copy.noActivity}</p> : <ol className="mt-2 divide-y">
            {lead.activity.toSorted((a, b) => b.occurredAt.localeCompare(a.occurredAt)).map((entry, index) => {
              const Icon = activityIcon(entry.type);
              return <li key={entry.eventId ?? index} className="flex gap-3.5 py-3.5 last:pb-0">
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", touched(entry.type) ? "bg-brand-soft text-primary" : "bg-muted text-muted-foreground")}><Icon aria-hidden className="size-4" /></span>
                <div className="min-w-0 pt-0.5">
                  <p className="whitespace-pre-line break-words text-sm font-medium">{entry.message}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{actor(entry)} · <span className="tabular-nums">{formatTimestamp(entry.occurredAt, zone)}</span></p>
                </div>
              </li>;
            })}
          </ol>}
        </section>
      </div>}
    </div>
  </>;
}
