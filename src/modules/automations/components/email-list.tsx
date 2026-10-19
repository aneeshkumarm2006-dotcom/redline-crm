import Link from "next/link";
import { ChevronDown, MailCheck, MailX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmailLogEntry } from "../schema";

export type EmailListCopy = {
  label: string; empty: string; sent: string; failed: string; preview: string;
  to: (to: string) => string; previewTitle: (subject: string) => string;
};

/**
 * Logged emails with a rendered preview. Bodies render in a fully sandboxed iframe (no scripts, forms or
 * same-origin access), so stored HTML can never act on the CRM page.
 */
export function EmailList({ emails, timeZone, copy, leadLinkLabel }: {
  emails: EmailLogEntry[]; timeZone: string; copy: EmailListCopy;
  /** When set (the Email log), each preview links to the email's lead. */
  leadLinkLabel?: string;
}) {
  const time = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone });
  if (!emails.length) return <p className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">{copy.empty}</p>;
  return <ul aria-label={copy.label} className="space-y-3">{emails.map((email) => {
    const failed = email.status === "failed";
    const Icon = failed ? MailX : MailCheck;
    return <li key={email.id} className="min-w-0 rounded-xl border bg-card">
      <details className="group">
        <summary className="flex min-h-16 cursor-pointer list-none items-start gap-3 rounded-xl p-4 focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", failed ? "bg-danger/12 text-danger" : "bg-success/12 text-success")}><Icon aria-hidden className="size-4" /></span>
          <span className="min-w-0 flex-1">
            <span className="block break-words text-sm font-semibold">{email.subject}</span>
            <span className="block break-all text-xs text-muted-foreground">{copy.to(email.to.join(", "))}</span>
            <span className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <span className={cn("font-medium", failed ? "text-danger" : "text-success")}>{failed ? copy.failed : copy.sent}</span>
              <time dateTime={email.sentAt}>{time.format(new Date(email.sentAt))}</time>
              {failed && email.error && <span>{email.error}</span>}
            </span>
          </span>
          <span className="sr-only">{copy.preview}</span>
          <ChevronDown aria-hidden className="mt-2 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t p-3">
          {leadLinkLabel && email.leadId && <Link href={`/crm/leads/${email.leadId}`} className="mb-2 inline-flex min-h-11 items-center text-sm font-medium hover:underline">{leadLinkLabel}</Link>}
          <iframe title={copy.previewTitle(email.subject)} srcDoc={email.html} sandbox="" loading="lazy" referrerPolicy="no-referrer"
            className="h-72 w-full rounded-lg border bg-white" />
        </div>
      </details>
    </li>;
  })}</ul>;
}
