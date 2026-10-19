import { requestNow } from "@/lib/clock";
import Link from "next/link";
import { ChevronRight, Download, Kanban, List, Plus, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadgeView } from "@/components/shared/status-badge-view";
import { resolvePill } from "@/components/shared/status-pill";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterDisclosure } from "@/components/shared/filter-disclosure";
import { requirePageUser } from "@/modules/auth/page-guards";
import { listStaffAppointments } from "@/modules/appointments/service";
import { listDealerships } from "@/modules/dealerships/service";
import { getVehicleSummaries } from "@/modules/inventory/service";
import { getSettings } from "@/modules/settings/service";
import type { Settings } from "@/modules/settings/schema";
import { getStaffNames, listSalespeople } from "@/modules/users/service";
import { listLeads, listPipelineLeads } from "../service";
import { leadFilterSchema, leadViews, type LeadFilters, type LeadView, type StaffLead } from "../schema";
import { leadsCopy as copy, leadAge } from "../copy";
import { LeadsTabs } from "./leads-tabs";
import { PipelineCard, type PipelineCardData } from "./pipeline-card";
import { PipelineDndProvider, PipelineDropColumn } from "./pipeline-dnd";
import { listMyViews } from "@/modules/views/service";
import { SavedViews } from "@/modules/views/components/saved-views";

/** Closed columns (won/lost) only show their newest cards; the list view has the rest. */
const CLOSED_COLUMN_CARDS = 20;

export type LeadsSearch = Promise<Record<string, string | string[] | undefined>>;
export async function LeadsScreen({ searchParams }: { searchParams: LeadsSearch }) {
  const user = await requirePageUser();
  const owner = user.role === "owner";
  const params = await searchParams;
  const view: LeadView = leadViews.find((entry) => entry === params.view) ?? "board";
  // Salespeople are always scoped to their own leads; location/assignee filters are owner-only.
  const keys = owner ? ["q", "stage", "dealershipId", "assignedTo", "source", "page"] : ["q", "stage", "source", "page"];
  const raw = Object.fromEntries(keys.flatMap((key) => typeof params[key] === "string" && params[key] ? [[key, params[key]]] : []));
  const parsed = leadFilterSchema.safeParse(raw);
  const filters = parsed.success ? parsed.data : leadFilterSchema.parse({});
  const [settings, dealerships, salespeople, views] = await Promise.all([getSettings(), listDealerships(), owner ? listSalespeople() : [], listMyViews("leads")]);
  const stages = [...settings.leadStages].sort((a, b) => a.order - b.order);
  const selectClass = "min-h-11 w-full min-w-0 rounded-md border bg-background px-3 text-base";
  // The board shows every stage, so the stage filter only applies to the list.
  const active = [filters.q, view === "list" && filters.stage, filters.dealershipId, filters.assignedTo, filters.source].filter(Boolean).length;
  const query = (overrides: Partial<Record<keyof LeadFilters | "view", string | undefined>>) => {
    const values = { ...filters, page: undefined, view: view === "list" ? "list" : undefined, ...overrides };
    if ((values.view ?? "board") === "board") values.stage = undefined;
    const search = new URLSearchParams(Object.entries(values).filter(([key, value]) => value !== undefined && value !== "" && !(key === "page" && value === "1")) as [string, string][]);
    return search.size ? `/crm/leads?${search}` : "/crm/leads";
  };
  // Same filters as the screen; the board shows every stage, so its export does too.
  const exportQuery = new URLSearchParams(Object.entries({ ...filters, page: undefined, stage: view === "list" ? filters.stage : undefined })
    .filter(([, value]) => value !== undefined && value !== "") as [string, string][]);
  const exportHref = exportQuery.size ? `/crm/leads/export?${exportQuery}` : "/crm/leads/export";
  return <>
    <header className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-3xl font-semibold tracking-tight">{copy.title}</h1><p className="mt-2 text-sm text-muted-foreground">{owner ? copy.intro : copy.introMine}</p></div>
        <Button asChild className="min-h-11 gap-2"><Link href="/crm/leads/new"><Plus aria-hidden className="size-4" />{copy.newLead}</Link></Button>
      </div>
      <LeadsTabs active="leads" />
    </header>
    <SavedViews board="leads" views={views} currentQuery={new URLSearchParams({ ...raw, ...(view === "list" ? { view } : {}) }).toString()} primaryColor={settings.brand.primaryColor} />
    <FilterDisclosure label={copy.filters} active={active}>
      <form action="/crm/leads" className={cn("grid gap-3 sm:grid-cols-2", owner ? "xl:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]" : "xl:grid-cols-[2fr_1fr_1fr_auto]")}>
        {view === "list" && <input type="hidden" name="view" value="list" />}
        <label className="min-w-0 space-y-2"><span className="text-sm font-medium">{copy.search}</span><Input type="search" name="q" defaultValue={filters.q} placeholder={copy.searchPlaceholder} maxLength={120} className="min-h-11 text-base" /></label>
        {view === "list" && <label className="min-w-0 space-y-2"><span className="text-sm font-medium">{copy.stage}</span><select name="stage" defaultValue={filters.stage ?? ""} className={selectClass}><option value="">{copy.allStages}</option>{stages.map((stage) => <option key={stage.key} value={stage.key}>{stage.label}</option>)}</select></label>}
        <label className="min-w-0 space-y-2"><span className="text-sm font-medium">{copy.source}</span><select name="source" defaultValue={filters.source ?? ""} className={selectClass}><option value="">{copy.allSources}</option>{settings.leadSources.map((source) => <option key={source.key} value={source.key}>{source.label}</option>)}</select></label>
        {owner && <>
          <label className="min-w-0 space-y-2"><span className="text-sm font-medium">{copy.dealership}</span><select name="dealershipId" defaultValue={filters.dealershipId ?? ""} className={selectClass}><option value="">{copy.allDealerships}</option>{dealerships.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="min-w-0 space-y-2"><span className="text-sm font-medium">{copy.assignee}</span><select name="assignedTo" defaultValue={filters.assignedTo ?? ""} className={selectClass}><option value="">{copy.allAssignees}</option><option value="unassigned">{copy.unassigned}</option>{salespeople.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        </>}
        <Button type="submit" className="min-h-11 self-end">{copy.apply}</Button>
      </form>
    </FilterDisclosure>
    <div className="flex min-h-11 flex-wrap items-center justify-between gap-2">
      <nav aria-label={copy.viewLabel} className="inline-flex rounded-lg border bg-card p-0.5">
        {leadViews.map((entry) => {
          const Icon = entry === "board" ? Kanban : List;
          return <Link key={entry} href={query({ view: entry === "list" ? "list" : undefined })} aria-current={view === entry ? "page" : undefined}
            className={cn("inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-medium", view === entry ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
            <Icon aria-hidden className="size-4" />{copy.views[entry]}
          </Link>;
        })}
      </nav>
      <div className="flex flex-wrap items-center gap-2">
        {active > 0 && <Button asChild variant="ghost" className="min-h-11"><Link href={view === "list" ? "/crm/leads?view=list" : "/crm/leads"}>{copy.clear}</Link></Button>}
        <Button asChild variant="outline" className="min-h-11 gap-2"><a href={exportHref} download><Download aria-hidden className="size-4" />{copy.exportCsv}</a></Button>
      </div>
    </div>
    {view === "board"
      ? <PipelineView filters={filters} settings={settings} owner={owner} userId={user.id} filtered={active > 0} listHref={(stage) => query({ view: "list", stage })} />
      : <ListView filters={filters} settings={settings} owner={owner} userId={user.id} filtered={active > 0} salespeople={salespeople} dealerships={dealerships} pageHref={(page) => query({ page: String(page) })} />}
  </>;
}

async function staffNamesFor(owner: boolean, userId: string, salespeople?: { id: string; name: string }[]) {
  return owner ? salespeople ?? await listSalespeople() : getStaffNames([userId]);
}

/** Kanban: one column per stage in settings order; columns swipe sideways on phones. */
async function PipelineView({ filters, settings, owner, userId, filtered, listHref }: {
  filters: LeadFilters; settings: Settings; owner: boolean; userId: string; filtered: boolean; listHref: (stage: string) => string;
}) {
  const now = requestNow();
  const result = await listPipelineLeads(filters);
  const [vehicles, staff, appointments] = await Promise.all([
    getVehicleSummaries([...new Set(result.leads.map((lead) => lead.vehicleId))]),
    staffNamesFor(owner, userId),
    listStaffAppointments(new Date(now).toISOString(), 500),
  ]);
  if (!result.leads.length) return <EmptyState icon={UsersRound} title={filtered || owner ? copy.empty : copy.emptyMine} description={filtered || owner ? copy.emptyHint : copy.emptyMineHint} />;
  const when = new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: settings.booking.timeZone });
  const next = new Map<string, string>();
  for (const entry of appointments) if (!next.has(entry.leadId)) next.set(entry.leadId, entry.startsAt);
  const closed = new Set([settings.wonStageKey, settings.lostStageKey]);
  const card = (lead: StaffLead): PipelineCardData => {
    const vehicle = vehicles.find((entry) => entry.id === lead.vehicleId);
    const appointment = next.get(lead.id);
    return { id: lead.id, name: lead.name, stage: lead.stage, assignedTo: lead.assignedTo,
      assignee: lead.assignedTo ? staff.find((entry) => entry.id === lead.assignedTo)?.name ?? copy.unknownStaff : null,
      vehicle: vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : copy.unknownVehicle, stockNo: vehicle?.stockNo ?? null,
      source: resolvePill(settings.leadSources, lead.source), age: leadAge(lead.createdAt, now), nextAppointment: appointment ? when.format(new Date(appointment)) : null };
  };
  const known = new Set(settings.leadStages.map((stage) => stage.key));
  // Leads in a retired stage still show, in a neutral column at the end.
  const columns = [...[...settings.leadStages].sort((a, b) => a.order - b.order),
    ...[...new Set(result.leads.map((lead) => lead.stage).filter((key) => !known.has(key)))].map((key) => ({ key, label: key, color: "#94A3B8" }))]
    .map((stage) => ({ ...stage, leads: result.leads.filter((lead) => lead.stage === stage.key) }));
  const cardSettings = { leadStages: settings.leadStages, vehicleStatuses: settings.vehicleStatuses, brand: settings.brand };
  return <section aria-label={copy.pipeline} className="space-y-3">
    {result.truncated && <p role="status" className="rounded-xl border bg-card p-3 text-sm text-muted-foreground">{copy.truncated(result.leads.length, result.total)}</p>}
    <nav aria-label={copy.jumpTo} className="scrollbar-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
      {columns.map((column) => <a key={column.key} href={`#stage-${column.key}`}
        className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border bg-card px-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-ring">
        <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: column.color }} />{column.label}<span className="tabular-nums text-muted-foreground">{column.leads.length}</span>
      </a>)}
    </nav>
    <p className="hidden text-xs text-muted-foreground lg:block">{copy.dragHint}</p>
    <PipelineDndProvider><div className="scrollbar-thin -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 lg:mx-0 lg:snap-none lg:px-0">
      {columns.map((column) => {
        const shown = closed.has(column.key) ? column.leads.slice(0, CLOSED_COLUMN_CARDS) : column.leads;
        const hidden = column.leads.length - shown.length;
        return <PipelineDropColumn key={column.key} stage={column} id={`stage-${column.key}`} aria-labelledby={`stage-${column.key}-title`}
          className="flex w-[85vw] max-w-80 shrink-0 snap-center scroll-mx-4 flex-col rounded-xl border-t-4 bg-muted/50 p-2 lg:w-auto lg:max-w-none lg:min-w-60 lg:flex-1"
          style={{ borderTopColor: column.color }}>
          <h2 id={`stage-${column.key}-title`} className="flex items-center justify-between gap-2 px-1 pt-1 pb-2 text-sm font-semibold">
            <span className="truncate">{column.label}</span>
            <span className="rounded-full bg-card px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">{column.leads.length}</span>
          </h2>
          {!shown.length ? <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">{copy.emptyColumn}</p>
            : <ul className="space-y-2">{shown.map((lead) => <li key={lead.id}><PipelineCard lead={card(lead)} settings={cardSettings} /></li>)}</ul>}
          {hidden > 0 && <Link href={listHref(column.key)} className="mt-2 flex min-h-11 items-center justify-center rounded-lg text-sm font-medium text-muted-foreground hover:bg-card hover:text-foreground">{copy.moreInColumn(hidden)}</Link>}
        </PipelineDropColumn>;
      })}
    </div></PipelineDndProvider>
  </section>;
}

/** The v1 table/cards list, paginated, with the stage filter. */
async function ListView({ filters, settings, owner, userId, filtered, salespeople, dealerships, pageHref }: {
  filters: LeadFilters; settings: Settings; owner: boolean; userId: string; filtered: boolean;
  salespeople: { id: string; name: string }[]; dealerships: { id: string; name: string }[]; pageHref: (page: number) => string;
}) {
  const result = await listLeads(filters);
  const [vehicles, staff] = await Promise.all([
    getVehicleSummaries([...new Set(result.leads.map((lead) => lead.vehicleId))]),
    staffNamesFor(owner, userId, salespeople),
  ]);
  const now = requestNow();
  const vehicle = (id: string) => vehicles.find((entry) => entry.id === id);
  const vehicleName = (id: string) => { const item = vehicle(id); return item ? `${item.year} ${item.make} ${item.model}` : copy.unknownVehicle; };
  const staffName = (id: string | null) => id ? staff.find((entry) => entry.id === id)?.name ?? copy.unknownStaff : copy.unassigned;
  const location = (id: string) => dealerships.find((entry) => entry.id === id)?.name ?? copy.unknownDealership;
  return <>
    <p className="text-sm text-muted-foreground">{copy.results(result.total)}</p>
    {result.leads.length === 0 ? <EmptyState icon={UsersRound} title={filtered || owner ? copy.empty : copy.emptyMine} description={filtered || owner ? copy.emptyHint : copy.emptyMineHint} /> : <>
      <ul className="grid gap-3 lg:hidden">{result.leads.map((lead) => <li key={lead.id}>
        <Link href={`/crm/leads/${lead.id}`} data-lead={lead.id} className="flex min-w-0 items-center gap-3 rounded-2xl border bg-card p-4 shadow-xs transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2"><p className="min-w-0 break-words font-semibold">{lead.name}</p><span className="shrink-0 text-xs text-muted-foreground">{leadAge(lead.createdAt, now)}</span></div>
            <p className="break-words text-sm text-muted-foreground">{vehicleName(lead.vehicleId)}{vehicle(lead.vehicleId) && ` · ${vehicle(lead.vehicleId)!.stockNo}`}</p>
            <div className="flex flex-wrap items-center gap-2"><StatusBadgeView kind="lead" status={lead.stage} settings={settings} />{owner && <span className="text-xs text-muted-foreground">{staffName(lead.assignedTo)} · {location(lead.dealershipId)}</span>}</div>
          </div>
          <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
        </Link>
      </li>)}</ul>
      <div className="hidden min-w-0 rounded-xl border bg-card lg:block"><table className="w-full table-fixed text-left text-sm"><thead className="border-b bg-muted/40"><tr>
        {[copy.customer, copy.vehicle, copy.stage, ...(owner ? [copy.assignee] : []), copy.received].map((label, index) => <th key={label} className={`p-4 font-medium ${index < 2 ? "w-[26%]" : ""}`}>{label}</th>)}
      </tr></thead><tbody>{result.leads.map((lead) => <tr key={lead.id} data-lead={lead.id} className="border-b last:border-0 hover:bg-muted/30">
        <td className="p-4"><Link href={`/crm/leads/${lead.id}`} className="flex min-h-11 flex-col justify-center break-words font-medium hover:underline">{lead.name}<span className="break-all text-xs font-normal text-muted-foreground">{lead.phone}</span></Link></td>
        <td className="break-words p-4">{vehicleName(lead.vehicleId)}<span className="block text-xs text-muted-foreground">{vehicle(lead.vehicleId)?.stockNo}{owner && ` · ${location(lead.dealershipId)}`}</span></td>
        <td className="p-4"><StatusBadgeView kind="lead" status={lead.stage} settings={settings} /></td>
        {owner && <td className="break-words p-4 text-muted-foreground">{staffName(lead.assignedTo)}</td>}
        <td className="p-4 text-muted-foreground">{leadAge(lead.createdAt, now)}</td>
      </tr>)}</tbody></table></div>
    </>}
    {result.pageCount > 1 && <nav aria-label={copy.title} className="flex flex-wrap items-center justify-between gap-3">{result.page > 1 ? <Button asChild variant="outline" className="min-h-11"><Link href={pageHref(result.page - 1)}>{copy.previous}</Link></Button> : <span />}<span className="text-sm">{copy.page(result.page, result.pageCount)}</span>{result.page < result.pageCount ? <Button asChild variant="outline" className="min-h-11"><Link href={pageHref(result.page + 1)}>{copy.next}</Link></Button> : <span />}</nav>}
  </>;
}
