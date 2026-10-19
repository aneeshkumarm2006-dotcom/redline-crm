import Link from "next/link";
import { ChevronDown, MailCheck, MailX } from "lucide-react";
import { cn } from "@/lib/utils";
import { brandEmail, type EmailBrand } from "@/lib/email/layout";
import type { EmailLogEntry } from "../schema";

export type EmailListCopy = {
  label: string; empty: string; sent: string; failed: string; preview: string;
  to: (to: string) => string; previewTitle: (subject: string) => string;
};

/**
 * Logged emails with a rendered preview. Bodies render in a fully sandboxed iframe (no scripts, forms or
 * same-origin access), so stored HTML can never act on the CRM page.
 */
export function EmailList({ emails, timeZone, copy, leadLinkLabel, brand }: {
  emails: EmailLogEntry[]; timeZone: string; copy: EmailListCopy;
  /** Wraps entries logged before branded email existed, so every preview looks like the sent email. */
  brand: EmailBrand;
  /** When set (the Email log), each preview links to the email's lead. */
  leadLinkLabel?: string;
}) {
  const time = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone });
  if (!emails.length) return <p className="rounded-2xl border border-dashed bg-card p-5 text-sm text-muted-foreground">{copy.empty}</p>;
  return <ul aria-label={copy.label} className="divide-y overflow-clip rounded-2xl border bg-card shadow-xs">{emails.map((email) => {
    const failed = email.status === "failed";
    const Icon = failed ? MailX : MailCheck;
    return <li key={email.id} className="min-w-0">
      <details className="group">
        <summary className="flex min-h-16 cursor-pointer list-none items-start gap-3.5 p-4 transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring group-open:bg-muted/30 sm:px-5 [&::-webkit-details-marker]:hidden">
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", failed ? "bg-danger/12 text-danger" : "bg-success/12 text-success")}><Icon aria-hidden className="size-4" /></span>
          <span className="min-w-0 flex-1">
            <span className="block break-words text-sm font-semibold">{email.subject}</span>
            <span className="block break-all text-xs text-muted-foreground">{copy.to(email.to.join(", "))}</span>
            <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
              <span className={cn("inline-flex min-h-5 items-center gap-1.5 rounded-full px-2 font-semibold", failed ? "bg-danger/12 text-danger" : "bg-success/12 text-success")}>
                <span aria-hidden className={cn("size-1.5 rounded-full", failed ? "bg-danger" : "bg-success")} />{failed ? copy.failed : copy.sent}
              </span>
              <time dateTime={email.sentAt} className="tabular-nums">{time.format(new Date(email.sentAt))}</time>
              {failed && email.error && <span>{email.error}</span>}
            </span>
          </span>
          <span className="sr-only">{copy.preview}</span>
          <ChevronDown aria-hidden className="mt-3 size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
        </summary>
        <div className="border-t bg-muted/30 p-3 sm:p-4">
          {leadLinkLabel && email.leadId && <Link href={`/crm/leads/${email.leadId}`} className="mb-2 inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring">{leadLinkLabel}</Link>}
          <iframe title={copy.previewTitle(email.subject)} srcDoc={brandEmail(email.html, { brand, subject: email.subject })} sandbox="" loading="lazy" referrerPolicy="no-referrer"
            className="h-[34rem] w-full rounded-xl border bg-[#F4F6FA] shadow-xs" />
        </div>
      </details>
    </li>;
  })}</ul>;
}
