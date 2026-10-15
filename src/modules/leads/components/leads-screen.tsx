import { requestNow } from "@/lib/clock";
import Link from "next/link";
import { ChevronRight, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadgeView } from "@/components/shared/status-badge-view";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterDisclosure } from "@/components/shared/filter-disclosure";
import { requirePageUser } from "@/modules/auth/page-guards";
import { listDealerships } from "@/modules/dealerships/service";
import { getVehicleSummaries } from "@/modules/inventory/service";
import { getSettings } from "@/modules/settings/service";
import { getStaffNames, listSalespeople } from "@/modules/users/service";
import { listLeads } from "../service";
import { leadFilterSchema } from "../schema";
import { leadsCopy as copy, leadAge } from "../copy";
import { LeadsTabs } from "./leads-tabs";

export type LeadsSearch = Promise<Record<string, string | string[] | undefined>>;
export async function LeadsScreen({ searchParams }: { searchParams: LeadsSearch }) {
  const user = await requirePageUser();
  const owner = user.role === "owner";
  const params = await searchParams;
  // Salespeople are always scoped to their own leads; location/assignee filters are owner-only.
  const keys = owner ? ["q", "stage", "dealershipId", "assignedTo", "page"] : ["q", "stage", "page"];
  const raw = Object.fromEntries(keys.flatMap((key) => typeof params[key] === "string" && params[key] ? [[key, params[key]]] : []));
  const parsed = leadFilterSchema.safeParse(raw);
  const filters = parsed.success ? parsed.data : leadFilterSchema.parse({});
  const [result, settings, dealerships, salespeople] = await Promise.all([listLeads(filters), getSettings(), listDealerships(), owner ? listSalespeople() : []]);
  const [vehicles, staff] = await Promise.all([
    getVehicleSummaries([...new Set(result.leads.map((lead) => lead.vehicleId))]),
    owner ? salespeople : getStaffNames([user.id]),
  ]);
  const now = requestNow();
  const vehicle = (id: string) => vehicles.find((entry) => entry.id === id);
  const vehicleName = (id: string) => { const item = vehicle(id); return item ? `${item.year} ${item.make} ${item.model}` : copy.unknownVehicle; };
  const staffName = (id: string | null) => id ? staff.find((entry) => entry.id === id)?.name ?? copy.unknownStaff : copy.unassigned;
  const location = (id: string) => dealerships.find((entry) => entry.id === id)?.name ?? copy.unknownDealership;
  const href = (page: number) => {
    const query = new URLSearchParams(Object.entries({ ...filters, page: String(page) }).filter(([, value]) => value !== undefined && value !== "") as [string, string][]);
    return `/crm/leads?${query}`;
  };
  const stages = [...settings.leadStages].sort((a, b) => a.order - b.order);
  const selectClass = "min-h-11 w-full min-w-0 rounded-md border bg-background px-3 text-base";
  const filtered = Boolean(filters.q || filters.stage || filters.dealershipId || filters.assignedTo);
  return <>
    <header className="space-y-4">
      <div><h1 className="text-3xl font-semibold tracking-tight">{copy.title}</h1><p className="mt-2 text-sm text-muted-foreground">{owner ? copy.intro : copy.introMine}</p></div>
      <LeadsTabs active="leads" />
    </header>
    <FilterDisclosure label={copy.filters} active={[filters.q, filters.stage, filters.dealershipId, filters.assignedTo].filter(Boolean).length}>
    <form action="/crm/leads" className={`grid gap-3 sm:grid-cols-2 ${owner ? "xl:grid-cols-[2fr_1fr_1fr_1fr_auto]" : "xl:grid-cols-[2fr_1fr_auto]"}`}>
      <label className="min-w-0 space-y-2"><span className="text-sm font-medium">{copy.search}</span><Input type="search" name="q" defaultValue={filters.q} placeholder={copy.searchPlaceholder} maxLength={120} className="min-h-11 text-base" /></label>
      <label className="min-w-0 space-y-2"><span className="text-sm font-medium">{copy.stage}</span><select name="stage" defaultValue={filters.stage ?? ""} className={selectClass}><option value="">{copy.allStages}</option>{stages.map((stage) => <option key={stage.key} value={stage.key}>{stage.label}</option>)}</select></label>
      {owner && <>
        <label className="min-w-0 space-y-2"><span className="text-sm font-medium">{copy.dealership}</span><select name="dealershipId" defaultValue={filters.dealershipId ?? ""} className={selectClass}><option value="">{copy.allDealerships}</option>{dealerships.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="min-w-0 space-y-2"><span className="text-sm font-medium">{copy.assignee}</span><select name="assignedTo" defaultValue={filters.assignedTo ?? ""} className={selectClass}><option value="">{copy.allAssignees}</option><option value="unassigned">{copy.unassigned}</option>{salespeople.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      </>}
      <Button type="submit" className="min-h-11 self-end">{copy.apply}</Button>
    </form>
    </FilterDisclosure>
    <div className="flex min-h-11 flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted-foreground">{copy.results(result.total)}</p>{filtered && <Button asChild variant="ghost" className="min-h-11"><Link href="/crm/leads">{copy.clear}</Link></Button>}</div>
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
    {result.pageCount > 1 && <nav aria-label={copy.title} className="flex flex-wrap items-center justify-between gap-3">{result.page > 1 ? <Button asChild variant="outline" className="min-h-11"><Link href={href(result.page - 1)}>{copy.previous}</Link></Button> : <span />}<span className="text-sm">{copy.page(result.page, result.pageCount)}</span>{result.page < result.pageCount ? <Button asChild variant="outline" className="min-h-11"><Link href={href(result.page + 1)}>{copy.next}</Link></Button> : <span />}</nav>}
  </>;
}
