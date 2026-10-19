import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PersonChip } from "@/components/shared/avatar";
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
  return <>
    <Button asChild variant="ghost" className="min-h-11 self-start"><Link href="/crm/team">← {copy.back}</Link></Button>
    <header><h1 className="text-3xl font-semibold tracking-tight">{copy.title}</h1><p className="mt-2 text-sm text-muted-foreground">{copy.intro}</p></header>
    <div className="flex flex-wrap items-end justify-between gap-3">
      <form action="/crm/team/commissions" className="flex flex-wrap items-end gap-2">
        <label className="space-y-2"><span className="block text-sm font-medium">{copy.month}</span>
          <select name="month" defaultValue={report.month.key} className="min-h-11 min-w-48 rounded-md border bg-background px-3 text-base">
            {report.choices.map((choice) => <option key={choice.key} value={choice.key}>{choice.label}</option>)}
          </select></label>
        <Button type="submit" variant="outline" className="min-h-11">{copy.show}</Button>
      </form>
      <div className="flex flex-wrap gap-2">
        {/* Plain links: the route handler answers with a CSV attachment. */}
        <Button asChild className="min-h-11"><a href={exportHref(false)} download><Download aria-hidden className="size-4" />{copy.exportSummary}</a></Button>
        <Button asChild variant="outline" className="min-h-11"><a href={exportHref(true)} download><Download aria-hidden className="size-4" />{copy.exportDetail}</a></Button>
      </div>
    </div>
    <section aria-label={`${copy.title}: ${report.month.label}`} className="overflow-hidden rounded-xl border bg-card">
      <h2 className="border-b px-4 py-3 font-semibold">{report.month.label}</h2>
      {/* Phones get stacked rows; wider screens a table. */}
      <ul className="divide-y sm:hidden">{report.rows.map((row) => <li key={row.salespersonId || "former"} className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="min-w-0"><PersonChip name={row.name} detail={`${location(row.dealershipId)} · ${copy.sales(row.units)}`} /></span>
        <span className="shrink-0 text-right"><span className="block font-semibold tabular-nums">{money(row.commission)}</span><span className="block text-xs text-muted-foreground tabular-nums">{money(row.revenue)}</span></span>
      </li>)}
        <li className="flex items-center justify-between gap-3 bg-muted px-4 py-3 font-semibold"><span>{copy.total} · {copy.sales(report.totals.units)}</span><span className="tabular-nums">{money(report.totals.commission)}</span></li>
      </ul>
      <table className="hidden w-full text-sm sm:table">
        <thead className="bg-muted/50 text-xs text-muted-foreground"><tr>
          <th scope="col" className="px-4 py-2 text-left font-medium">{copy.salesperson}</th><th scope="col" className="px-4 py-2 text-left font-medium">{copy.location}</th>
          <th scope="col" className="px-4 py-2 text-right font-medium">{copy.units}</th><th scope="col" className="px-4 py-2 text-right font-medium">{copy.revenue}</th>
          <th scope="col" className="px-4 py-2 text-right font-medium">{copy.commission}</th>
        </tr></thead>
        <tbody className="divide-y">{report.rows.map((row) => <tr key={row.salespersonId || "former"}>
          <th scope="row" className="px-4 py-3 text-left font-normal">{row.salespersonId ? <Link href={`/crm/team/${row.salespersonId}`} className="hover:underline"><PersonChip name={row.name} /></Link> : <PersonChip name={row.name} />}</th>
          <td className="px-4 py-3">{location(row.dealershipId)}</td>
          <td className="px-4 py-3 text-right tabular-nums">{row.units}</td>
          <td className="px-4 py-3 text-right tabular-nums">{money(row.revenue)}</td>
          <td className="px-4 py-3 text-right font-semibold tabular-nums">{money(row.commission)}</td>
        </tr>)}</tbody>
        <tfoot className="bg-muted font-semibold"><tr>
          <th scope="row" colSpan={2} className="px-4 py-3 text-left">{copy.total}</th>
          <td className="px-4 py-3 text-right tabular-nums">{report.totals.units}</td>
          <td className="px-4 py-3 text-right tabular-nums">{money(report.totals.revenue)}</td>
          <td className="px-4 py-3 text-right tabular-nums">{money(report.totals.commission)}</td>
        </tr></tfoot>
      </table>
      {!report.totals.units && <p className="border-t px-4 py-3 text-sm text-muted-foreground">{copy.empty}</p>}
    </section>
  </>;
}
