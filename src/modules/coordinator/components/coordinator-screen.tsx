import Link from "next/link";
import { Phone, Timer, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { KpiRow, StatCard } from "@/components/shared/stats/stat-card";
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
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-3xl font-semibold tracking-tight">{copy.title}</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">{copy.intro}</p></div>
      <nav aria-label={copy.periodLabel} className="inline-flex rounded-lg border bg-card p-0.5">
        {coordinatorPeriods.map((entry) => <Link key={entry} href={entry === "week" ? "/crm/coordinator" : `/crm/coordinator?period=${entry}`} aria-current={period === entry ? "page" : undefined} scroll={false}
          className={cn("inline-flex min-h-10 items-center rounded-md px-3 text-sm font-medium", period === entry ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>{copy.periods[entry]}</Link>)}
      </nav>
    </header>

    <section aria-labelledby="coordinator-flow" className="space-y-3">
      <div><h2 id="coordinator-flow" className="text-lg font-semibold">{copy.flow}</h2><p className="text-sm text-muted-foreground">{copy.flowHint(periodLabel)}</p></div>
      {data.total ? <FlowDiagram steps={flow} total={data.total} /> : <p className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">{copy.noInquiries}</p>}
    </section>

    <KpiRow label={copy.timing} className="xl:grid-cols-4">
      <StatCard label={copy.firstContact} icon={Timer} value={timing.firstContact === null ? "—" : formatDuration(timing.firstContact)}
        hint={timing.firstContact === null ? copy.noTiming : copy.timingHint(timing.firstContactCount)} />
      <StatCard label={copy.toBooking} icon={Timer} value={timing.booking === null ? "—" : formatDuration(timing.booking)}
        hint={timing.booking === null ? copy.noTiming : copy.timingHint(timing.bookingCount)} />
      <StatCard label={copy.unassigned} icon={UserX} value={queues.unassigned.length} href="#queue-unassigned" />
      <StatCard label={copy.notContacted(queues.hours)} icon={Phone} value={queues.uncontacted.length} href="#queue-uncontacted" />
    </KpiRow>

    <section aria-label={copy.queues} className="grid gap-4 xl:grid-cols-2">
      <Queue id="queue-unassigned" title={copy.unassigned} hint={copy.unassignedHint} empty={copy.unassignedEmpty} leads={queues.unassigned} data={data} now={now} action="assign" />
      <Queue id="queue-uncontacted" title={copy.notContacted(queues.hours)} hint={copy.notContactedHint} empty={copy.notContactedEmpty} leads={queues.uncontacted} data={data} now={now} action="contact" />
    </section>

    <LiveFeed key={new Date(now).toISOString()} initial={data.feed} initialAt={new Date(now).toISOString()} timeZone={settings.booking.timeZone} />
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
  return <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 space-y-3 rounded-xl border bg-card p-4">
    <div>
      <h2 id={`${id}-title`} className="flex items-center gap-2 text-lg font-semibold">{title}<span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">{leads.length}</span></h2>
      <p className="text-sm text-muted-foreground">{hint}</p>
    </div>
    {!leads.length ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{empty}</p> : <ul className="divide-y">
      {leads.map((lead) => {
        const car = vehicle(lead.vehicleId);
        const ref = { id: lead.id, name: lead.name, stage: lead.stage, assignedTo: lead.assignedTo };
        const next = nextOpenStage(settings, lead.stage);
        return <li key={lead.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
          <Link href={`/crm/leads/${lead.id}`} className="min-w-0 flex-1 rounded focus-visible:outline-2 focus-visible:outline-ring">
            <span className="block break-words text-sm font-semibold hover:underline">{lead.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{car ? `${car.year} ${car.make} ${car.model} · ${car.stockNo}` : copy.unknownVehicle}{location(lead.dealershipId) && ` · ${location(lead.dealershipId)}`}</span>
            <span className="block text-xs text-muted-foreground">{copy.waiting(formatDuration(now - Date.parse(lead.createdAt)))}{action === "contact" && ` · ${assignee(lead.assignedTo)}`}</span>
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
