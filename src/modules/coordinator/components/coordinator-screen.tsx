import Link from "next/link";
import { CheckCircle2, Clock, Phone, Timer, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { KpiRow, StatCard } from "@/components/shared/stats/stat-card";
import { PageHeader } from "@/components/shared/page-header";
import { Avatar } from "@/components/shared/avatar";
import { requestNow } from "@/lib/clock";
import { requirePageUser } from "@/modules/auth/page-guards";
import { LogCallControl, ReassignControl } from "@/modules/leads/components/lead-controls";
import { nextOpenStage } from "@/modules/leads/service";
import type { StaffLead } from "@/modules/leads/schema";
import { getCoordinatorOverview } from "../service";
import { coordinatorPeriods } from "../schema";
import { coordinatorCopy as copy, formatDuration } from "../copy";
import { FlowDiagram } from "./flow-diagram";
import { LiveFeed } from "./live-feed";

type Overview = Awaited<ReturnType<typeof getCoordinatorOverview>>;

/** Owner overview of the lead workflow: flow with drop-off, response times, work queues and the live feed. */
export async function CoordinatorScreen({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageUser("owner");
  const query = await searchParams;
  const now = requestNow();
  const data = await getCoordinatorOverview({ period: typeof query.period === "string" ? query.period : undefined }, now);
  const { settings, period, flow, timing, queues } = data;
  const periodLabel = copy.periods[period];
  return <>
    <PageHeader title={copy.title} description={copy.intro}>
      <nav aria-label={copy.periodLabel} className="inline-flex gap-1 rounded-xl bg-muted p-1">
        {coordinatorPeriods.map((entry) => <Link key={entry} href={entry === "week" ? "/crm/coordinator" : `/crm/coordinator?period=${entry}`} aria-current={period === entry ? "page" : undefined} scroll={false}
          className={cn("inline-flex min-h-10 items-center rounded-lg px-3.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            period === entry ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground")}>{copy.periods[entry]}</Link>)}
      </nav>
    </PageHeader>

    <section aria-labelledby="coordinator-flow" className="rounded-[1.25rem] bg-ink p-5 text-ink-foreground shadow-md sm:p-6">
      <div className="mb-5"><h2 id="coordinator-flow" className="text-lg font-semibold tracking-tight">{copy.flow}</h2><p className="mt-0.5 text-sm text-ink-muted">{copy.flowHint(periodLabel)}</p></div>
      {data.total ? <FlowDiagram steps={flow} total={data.total} /> : <p className="rounded-2xl border border-white/[0.07] bg-white/[0.05] p-5 text-sm text-ink-muted">{copy.noInquiries}</p>}
    </section>

    <KpiRow label={copy.timing} className="md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-4">
      <StatCard label={copy.firstContact} icon={Timer} value={timing.firstContact === null ? "—" : formatDuration(timing.firstContact)}
        hint={timing.firstContact === null ? copy.noTiming : copy.timingHint(timing.firstContactCount)} />
      <StatCard label={copy.toBooking} icon={Timer} value={timing.booking === null ? "—" : formatDuration(timing.booking)}
        hint={timing.booking === null ? copy.noTiming : copy.timingHint(timing.bookingCount)} />
      <StatCard label={copy.unassigned} icon={UserX} value={queues.unassigned.length} href="#queue-unassigned" />
      <StatCard label={copy.notContacted(queues.hours)} icon={Phone} value={queues.uncontacted.length} href="#queue-uncontacted" />
    </KpiRow>

    <div className="grid gap-4 sm:gap-5 xl:grid-cols-12">
      <section aria-label={copy.queues} className="grid min-w-0 content-start gap-4 sm:gap-5 xl:col-span-7">
        <Queue id="queue-unassigned" title={copy.unassigned} hint={copy.unassignedHint} empty={copy.unassignedEmpty} leads={queues.unassigned} data={data} now={now} action="assign" />
        <Queue id="queue-uncontacted" title={copy.notContacted(queues.hours)} hint={copy.notContactedHint} empty={copy.notContactedEmpty} leads={queues.uncontacted} data={data} now={now} action="contact" />
      </section>
      <div className="min-w-0 xl:col-span-5">
        <LiveFeed key={new Date(now).toISOString()} initial={data.feed} initialAt={new Date(now).toISOString()} timeZone={settings.booking.timeZone} />
      </div>
    </div>
  </>;
}

/** A work queue with one-tap actions: assign to a salesperson at the lead's location, or call and log it. */
function Queue({ id, title, hint, empty, leads, data, now, action }: {
  id: string; title: string; hint: string; empty: string; leads: StaffLead[]; data: Overview; now: number; action: "assign" | "contact";
}) {
  const { settings, queues, salespeople, dealerships } = data;
  const vehicle = (vehicleId: string) => queues.vehicles.find((entry) => entry.id === vehicleId);
  const location = (dealershipId: string) => dealerships.find((entry) => entry.id === dealershipId)?.name;
  const assignee = (staffId: string | null) => staffId ? queues.assignees.find((entry) => entry.id === staffId)?.name ?? copy.unknownStaff : copy.unassignedLead;
  return <section id={id} aria-labelledby={`${id}-title`} className="min-w-0 scroll-mt-24 rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
    <div>
      <h2 id={`${id}-title`} className="flex items-center gap-2.5 text-[0.9375rem] font-semibold tracking-tight">{title}
        <span className={cn("inline-flex min-w-7 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", leads.length ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{leads.length}</span></h2>
      <p className="mt-1 text-[0.8125rem] text-muted-foreground">{hint}</p>
    </div>
    {!leads.length ? <p className="mt-4 flex min-h-14 items-center gap-3 rounded-xl bg-muted/60 px-4 text-sm text-muted-foreground"><CheckCircle2 aria-hidden className="size-5 shrink-0 text-success" />{empty}</p> : <ul className="mt-3 divide-y">
      {leads.map((lead) => {
        const car = vehicle(lead.vehicleId);
        const ref = { id: lead.id, name: lead.name, stage: lead.stage, assignedTo: lead.assignedTo };
        const next = nextOpenStage(settings, lead.stage);
        return <li key={lead.id} className="flex flex-col gap-3 py-3.5 last:pb-0 sm:flex-row sm:items-center">
          <Link href={`/crm/leads/${lead.id}`} className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            <Avatar name={lead.name} />
            <span className="min-w-0 flex-1">
            <span className="block break-words text-sm font-semibold group-hover:underline">{lead.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{car ? `${car.year} ${car.make} ${car.model} · ${car.stockNo}` : copy.unknownVehicle}{location(lead.dealershipId) && ` · ${location(lead.dealershipId)}`}</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1 font-medium text-foreground"><Clock aria-hidden className="size-3 text-warning" />{copy.waiting(formatDuration(now - Date.parse(lead.createdAt)))}</span>{action === "contact" && <span>· {assignee(lead.assignedTo)}</span>}</span>
            </span>
          </Link>
          <div className="flex shrink-0 flex-wrap gap-2">
            {action === "assign"
              ? <ReassignControl lead={ref} label={copy.assign} primaryColor={settings.brand.primaryColor}
                  salespeople={salespeople.filter((person) => person.dealershipId === lead.dealershipId).map(({ id: personId, name }) => ({ id: personId, name }))} />
              : <>
                <Button asChild variant="outline" className="min-h-11 gap-2"><a href={`tel:${lead.phone.replace(/[^+\d]/g, "")}`} aria-label={`${copy.call} ${lead.name}`}><Phone aria-hidden className="size-4" />{copy.call}</a></Button>
                <LogCallControl lead={ref} nextStage={next} primaryColor={settings.brand.primaryColor} compact />
              </>}
          </div>
        </li>;
      })}
    </ul>}
  </section>;
}
