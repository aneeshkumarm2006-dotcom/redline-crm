import Link from "next/link";
import { ArrowLeft, BadgeDollarSign, CarFront, Download, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownField } from "@/components/ui/dropdown-field";
import { PersonChip } from "@/components/shared/avatar";
import { PageHeader } from "@/components/shared/page-header";
import { KpiRow, StatCard } from "@/components/shared/stats/stat-card";
import { requestNow } from "@/lib/clock";
import { requirePageUser } from "@/modules/auth/page-guards";
import { getCommissionReport } from "../service";
import { salesCopy } from "../copy";

const copy = salesCopy.report;
const money = (value: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(value);

/** Owner commission report: one row per salesperson for a month, with a total and CSV exports. */
export async function CommissionReportScreen({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageUser("owner");
  const { month: requested } = await searchParams;
  const report = await getCommissionReport(typeof requested === "string" ? requested : undefined, requestNow());
  const location = (id: string | null) => report.dealerships.find((entry) => entry.id === id)?.name ?? salesCopy.unknownLocation;
  const exportHref = (detail: boolean) => `/crm/team/commissions/export?month=${report.month.key}${detail ? "&detail=1" : ""}`;
  const th = "px-4 py-3 text-xs font-semibold text-muted-foreground first:pl-5 last:pr-5";
  const td = "px-4 py-3.5 first:pl-5 last:pr-5";
  return <>
    <PageHeader
      eyebrow={<Link href="/crm/team" className="-my-3 inline-flex min-h-11 items-center gap-1.5 rounded-md transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"><ArrowLeft aria-hidden className="size-3.5" />{copy.back}</Link>}
      title={copy.title} description={copy.intro}
      actions={<>
        {/* Plain links: the route handler answers with a CSV attachment. */}
        <Button asChild variant="outline" className="min-h-11"><a href={exportHref(true)} download><Download aria-hidden className="size-4" />{copy.exportDetail}</a></Button>
        <Button asChild className="min-h-11"><a href={exportHref(false)} download><Download aria-hidden className="size-4" />{copy.exportSummary}</a></Button>
      </>}>
      <form action="/crm/team/commissions" className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 space-y-1.5"><span className="block text-sm font-medium">{copy.month}</span>
          <DropdownField name="month" defaultValue={report.month.key} icon="calendar" className="min-w-56"
            options={report.choices.map((choice) => ({ value: choice.key, label: choice.label }))} /></label>
        <Button type="submit" variant="outline" className="min-h-11">{copy.show}</Button>
      </form>
    </PageHeader>

    <KpiRow label={report.month.label} className="md:grid-cols-3 2xl:grid-cols-3">
      <StatCard label={copy.units} icon={CarFront} value={report.totals.units} />
      <StatCard label={copy.revenue} icon={Wallet} value={report.totals.revenue} format="money" />
      <StatCard label={copy.commission} icon={BadgeDollarSign} value={report.totals.commission} format="money" className="col-span-2 md:col-span-1" />
    </KpiRow>

    <section aria-label={`${copy.title}: ${report.month.label}`} className="overflow-clip rounded-2xl border bg-card shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
        <h2 className="text-lg font-semibold tracking-tight">{report.month.label}</h2>
        <span className="inline-flex min-h-7 items-center rounded-full bg-muted px-3 text-xs font-semibold tabular-nums text-muted-foreground">{copy.sales(report.totals.units)}</span>
      </div>
      {/* Phones get stacked rows; wider screens a table. */}
      <ul className="divide-y sm:hidden">{report.rows.map((row) => <li key={row.salespersonId || "former"} className="flex items-center justify-between gap-3 px-4 py-3.5">
        <span className="min-w-0"><PersonChip name={row.name} size="md" detail={`${location(row.dealershipId)} · ${copy.sales(row.units)}`} /></span>
        <span className="shrink-0 text-right"><span className="block font-semibold tabular-nums">{money(row.commission)}</span><span className="block text-xs text-muted-foreground tabular-nums">{money(row.revenue)}</span></span>
      </li>)}
        <li className="flex items-center justify-between gap-3 bg-muted/60 px-4 py-3.5 font-semibold"><span>{copy.total} · {copy.sales(report.totals.units)}</span><span className="tabular-nums">{money(report.totals.commission)}</span></li>
      </ul>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40"><tr>
            <th scope="col" className={cn(th, "text-left")}>{copy.salesperson}</th><th scope="col" className={cn(th, "text-left")}>{copy.location}</th>
            <th scope="col" className={cn(th, "text-right")}>{copy.units}</th><th scope="col" className={cn(th, "text-right")}>{copy.revenue}</th>
            <th scope="col" className={cn(th, "text-right")}>{copy.commission}</th>
          </tr></thead>
          <tbody className="divide-y">{report.rows.map((row) => <tr key={row.salespersonId || "former"} className="transition-colors hover:bg-muted/40">
            <th scope="row" className={cn(td, "text-left font-normal")}>{row.salespersonId ? <Link href={`/crm/team/${row.salespersonId}`} className="inline-flex min-h-9 items-center rounded-md hover:underline focus-visible:outline-2 focus-visible:outline-ring"><PersonChip name={row.name} size="md" /></Link> : <PersonChip name={row.name} size="md" />}</th>
            <td className={cn(td, "text-muted-foreground")}>{location(row.dealershipId)}</td>
            <td className={cn(td, "text-right tabular-nums")}>{row.units}</td>
            <td className={cn(td, "text-right tabular-nums")}>{money(row.revenue)}</td>
            <td className={cn(td, "text-right font-semibold tabular-nums")}>{money(row.commission)}</td>
          </tr>)}</tbody>
          <tfoot className="border-t bg-muted/60 font-semibold"><tr>
            <th scope="row" colSpan={2} className={cn(td, "text-left")}>{copy.total}</th>
            <td className={cn(td, "text-right tabular-nums")}>{report.totals.units}</td>
            <td className={cn(td, "text-right tabular-nums")}>{money(report.totals.revenue)}</td>
            <td className={cn(td, "font-display text-right text-base tabular-nums")}>{money(report.totals.commission)}</td>
          </tr></tfoot>
        </table>
      </div>
      {!report.totals.units && <p className="border-t px-5 py-4 text-sm text-muted-foreground">{copy.empty}</p>}
    </section>
  </>;
}
