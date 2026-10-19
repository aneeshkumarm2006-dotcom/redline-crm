import Link from "next/link";
import { MailSearch, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { requirePageUser } from "@/modules/auth/page-guards";
import { getSettings } from "@/modules/settings/service";
import { listEmailLog } from "../service";
import { emailLogCopy as copy } from "../copy";
import { AutomationsTabs } from "./automations-tabs";
import { EmailList } from "./email-list";
import { RunNowButton } from "./run-now-button";

const statuses = ["all", "sent", "failed"] as const;
const text = (value: string | string[] | undefined) => typeof value === "string" ? value : undefined;

/** Owner Email log: every email the system sent or tried to send, searchable, with a sandboxed rendered preview. */
export async function EmailLogScreen({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageUser("owner");
  const query = await searchParams;
  const q = (text(query.q) ?? "").slice(0, 120);
  const status = text(query.status) === "sent" || text(query.status) === "failed" ? text(query.status) as "sent" | "failed" : undefined;
  const requestedPage = Number(text(query.page) ?? 1);
  const [settings, log] = await Promise.all([
    getSettings(), listEmailLog({ q, status, page: Number.isInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10_000) : 1 }),
  ]);
  const href = (next: { status?: string; page?: number }) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    const nextStatus = "status" in next ? next.status : status;
    if (nextStatus && nextStatus !== "all") params.set("status", nextStatus);
    if (next.page && next.page > 1) params.set("page", String(next.page));
    const search = params.toString();
    return `/crm/automations/emails${search ? `?${search}` : ""}`;
  };
  return <>
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0"><h1 className="text-3xl font-semibold tracking-tight">{copy.title}</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">{copy.intro}</p></div>
      <RunNowButton />
    </header>
    <AutomationsTabs active="emails" />

    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <form role="search" action="/crm/automations/emails" className="flex min-w-0 flex-1 gap-2 md:max-w-md">
        <label htmlFor="email-search" className="sr-only">{copy.searchLabel}</label>
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="email-search" name="q" type="search" defaultValue={q} placeholder={copy.search} maxLength={120} className="min-h-11 pl-9" />
        </div>
        {status && <input type="hidden" name="status" value={status} />}
        <Button type="submit" variant="outline" className="min-h-11">{copy.apply}</Button>
      </form>
      <nav aria-label={copy.statusLabel} className="inline-flex self-start rounded-lg border bg-card p-0.5">
        {statuses.map((entry) => {
          const active = (status ?? "all") === entry;
          return <Link key={entry} href={href({ status: entry })} aria-current={active ? "page" : undefined} scroll={false}
            className={cn("inline-flex min-h-10 items-center rounded-md px-3 text-sm font-medium", active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>{copy.statuses[entry]}</Link>;
        })}
      </nav>
    </div>

    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <p>{copy.total(log.total)}</p>
      {(q || status) && <Link href="/crm/automations/emails" className="inline-flex min-h-11 items-center font-medium text-foreground hover:underline">{copy.clear}</Link>}
    </div>

    {!log.emails.length
      ? <EmptyState icon={MailSearch} title={copy.empty} description={copy.emptyHint} />
      : <EmailList emails={log.emails} timeZone={settings.booking.timeZone} copy={copy.list} leadLinkLabel={copy.openLead} />}

    {log.pageCount > 1 && <nav aria-label={copy.pagination} className="flex items-center justify-between gap-2">
      {log.page > 1 ? <Button asChild variant="outline" className="min-h-11"><Link href={href({ page: log.page - 1 })}>{copy.previous}</Link></Button> : <span />}
      <span className="text-sm text-muted-foreground">{copy.page(log.page, log.pageCount)}</span>
      {log.page < log.pageCount ? <Button asChild variant="outline" className="min-h-11"><Link href={href({ page: log.page + 1 })}>{copy.next}</Link></Button> : <span />}
    </nav>}
  </>;
}
