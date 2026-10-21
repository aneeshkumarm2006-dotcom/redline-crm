import Link from "next/link";
import { AlertTriangle, Bot, CheckCircle2, CircleSlash, Inbox, Mail, PauseCircle, PenLine, Send, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { requirePageUser } from "@/modules/auth/page-guards";
import { AutomationsTabs } from "@/modules/automations/components/automations-tabs";
import { formatTimestamp } from "@/modules/inventory/copy";
import { getAssistantOverview, type AssistantOverview } from "../service";
import { assistantCopy as copy } from "../copy";
import { AssistantSettingsForm, CheckInboxButton } from "./assistant-controls";

const panel = "min-w-0 rounded-2xl border bg-card p-5 shadow-xs sm:p-6";
type Row = AssistantOverview["recent"][number];
const leadHref = (leadId: string) => `/crm/leads/${leadId}?tab=conversation`;

function StatusLine({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return <div className="flex min-w-0 items-start gap-3 py-2.5">
    {ok ? <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-success" /> : <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />}
    <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-words text-sm font-medium">{value}</dd></div>
  </div>;
}

function RowList({ rows, zone, empty }: { rows: Row[]; zone: string; empty?: string }) {
  if (!rows.length) return empty ? <p className="mt-3 text-sm text-muted-foreground">{empty}</p> : null;
  return <ul className="mt-2 divide-y">{rows.map((row) => {
    const Icon = row.direction === "inbound" ? Mail : row.author === "staff" ? UserRound : row.status === "draft" ? PenLine : Send;
    const body = <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Icon aria-hidden className="size-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2 text-sm"><span className="font-semibold">{row.leadName ?? row.from}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{formatTimestamp(row.at, zone)}</span>
          {row.direction === "inbound" && copy.statuses[row.status] && <span className="text-xs text-muted-foreground">· {copy.statuses[row.status]}</span>}</span>
        {row.subject && <span className="block truncate text-sm">{row.subject}</span>}
        {(row.note || row.preview) && <span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-muted-foreground">{row.note || row.preview}</span>}
      </span>
    </>;
    return <li key={row.id}>{row.leadId
      ? <Link href={leadHref(row.leadId)} className="flex min-h-14 items-start gap-3 rounded-lg py-3 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring">{body}</Link>
      : <div className="flex items-start gap-3 py-3">{body}</div>}</li>;
  })}</ul>;
}

/** Owner page: assistant status, settings, conversations needing a person, and recent activity. */
export async function AssistantScreen() {
  await requirePageUser("owner");
  const overview = await getAssistantOverview();
  const { status, settings, timeZone: zone } = overview;
  const attention = overview.drafts.length + overview.paused.length + overview.failures.length;
  return <>
    <PageHeader title={copy.pageTitle} description={copy.pageIntro} actions={<CheckInboxButton />}>
      <AutomationsTabs active="assistant" />
    </PageHeader>
    <section aria-label={copy.weekStats} className="grid grid-cols-3 gap-3">
      {[[copy.repliesSent, overview.stats.repliesSent, Bot], [copy.customerEmails, overview.stats.customerEmails, Inbox], [copy.handedOff, overview.stats.handedOff, PauseCircle]].map(([label, value, Icon]) => {
        const Glyph = Icon as typeof Bot;
        return <div key={label as string} className="rounded-2xl border bg-card p-4 shadow-xs">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Glyph aria-hidden className="size-3.5" />{label as string}</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{value as number}</p>
          <p className="text-xs text-muted-foreground">{copy.weekStats}</p>
        </div>;
      })}
    </section>
    <div className="grid gap-4 sm:gap-5 xl:grid-cols-12">
      <div className="grid min-w-0 content-start gap-4 sm:gap-5 xl:col-span-7">
        <section aria-labelledby="assistant-attention" className={panel}>
          <h2 id="assistant-attention" className="text-[0.9375rem] font-semibold tracking-tight">{copy.attention}{attention ? ` (${attention})` : ""}</h2>
          {!attention && <p className="mt-3 text-sm text-muted-foreground">{copy.attentionEmpty}</p>}
          {overview.drafts.length > 0 && <><h3 className="eyebrow mt-5">{copy.drafts}</h3><RowList rows={overview.drafts} zone={zone} /></>}
          {overview.paused.length > 0 && <><h3 className="eyebrow mt-5">{copy.handoffs}</h3><ul className="mt-2 divide-y">{overview.paused.map((entry) =>
            <li key={entry.leadId}><Link href={leadHref(entry.leadId)} className="flex min-h-14 items-start gap-3 rounded-lg py-3 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-warning/12 text-warning"><PauseCircle aria-hidden className="size-4" /></span>
              <span className="min-w-0"><span className="block text-sm font-semibold">{entry.leadName}</span>
                <span className="block text-xs leading-5 text-muted-foreground">{entry.reason || copy.paused}{entry.at ? ` · ${formatTimestamp(entry.at, zone)}` : ""}</span></span>
            </Link></li>)}</ul></>}
          {overview.failures.length > 0 && <><h3 className="eyebrow mt-5">{copy.failures}</h3><RowList rows={overview.failures} zone={zone} /></>}
        </section>
        <section aria-labelledby="assistant-recent" className={panel}>
          <h2 id="assistant-recent" className="text-[0.9375rem] font-semibold tracking-tight">{copy.recent}</h2>
          <RowList rows={overview.recent} zone={zone} empty={copy.recentEmpty} />
        </section>
      </div>
      <div className="grid min-w-0 content-start gap-4 sm:gap-5 xl:col-span-5">
        <section aria-labelledby="assistant-status" className={panel}>
          <h2 id="assistant-status" className="text-[0.9375rem] font-semibold tracking-tight">{copy.status}</h2>
          <dl className="mt-2 divide-y">
            <StatusLine label={copy.apiKey} value={status.apiKey ? `${copy.configured} · ${copy.model} ${status.model}` : copy.missing} ok={status.apiKey} />
            <StatusLine label={copy.inbox} value={status.inbox ?? copy.inboxOff} ok={Boolean(status.inbox)} />
            <StatusLine label={copy.lastPoll} value={status.lastPollAt ? `${formatTimestamp(status.lastPollAt, zone)}${status.lastError ? ` — ${status.lastError}` : ""}` : copy.never}
              ok={Boolean(status.lastPollAt && !status.lastError)} />
            {status.emailProblems.map((problem) => <StatusLine key={problem} label="Email delivery" value={problem} ok={false} />)}
          </dl>
          <details className="mt-4 rounded-xl bg-muted/60 p-4 text-sm">
            <summary className="cursor-pointer font-medium">{copy.setupTitle}</summary>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs leading-5 text-muted-foreground">{copy.setup.map((line) => <li key={line}>{line}</li>)}</ul>
          </details>
        </section>
        <section aria-labelledby="assistant-settings" className={cn(panel)}>
          <h2 id="assistant-settings" className="mb-4 flex items-center gap-2 text-[0.9375rem] font-semibold tracking-tight">
            {settings.enabled ? <Bot aria-hidden className="size-4 text-primary" /> : <CircleSlash aria-hidden className="size-4 text-muted-foreground" />}{copy.settings}
          </h2>
          <AssistantSettingsForm initial={settings} />
        </section>
      </div>
    </div>
  </>;
}
