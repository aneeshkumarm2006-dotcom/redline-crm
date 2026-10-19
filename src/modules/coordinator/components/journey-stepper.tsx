import { CalendarCheck, Check, DatabaseZap, Inbox, MailCheck, Minus, UserCheck, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JourneyState, JourneyStep, JourneyStepKey } from "../journey";
import { coordinatorCopy as copy } from "../copy";

export const stepIcons: Record<JourneyStepKey, LucideIcon> = { inquiry: Inbox, email: MailCheck, assigned: UserCheck, booked: CalendarCheck, crm: DatabaseZap };
const stateIcons: Partial<Record<JourneyState, LucideIcon>> = { done: Check, failed: X, skipped: Minus };
/** Marker and connector colours per state; text labels always accompany them. */
export const stateTone: Record<JourneyState, { marker: string; line: string; dot: string }> = {
  done: { marker: "border-success bg-success text-white", line: "bg-success", dot: "bg-success" },
  failed: { marker: "border-danger bg-danger text-white", line: "bg-border", dot: "bg-danger" },
  skipped: { marker: "border-border bg-muted text-muted-foreground", line: "bg-border", dot: "bg-muted-foreground/40" },
  pending: { marker: "border-dashed border-muted-foreground/50 bg-card text-muted-foreground", line: "bg-border", dot: "bg-border" },
};

export function stepLabel(key: JourneyStepKey, assignee: string | null) {
  return key === "assigned" && assignee ? copy.assignedTo(assignee) : copy.steps[key];
}

/** Stepper tones on the dark ink band; text labels always accompany the colours. */
const inkTone: Record<JourneyState, { marker: string; line: string; label: string }> = {
  done: { marker: "border-success bg-success text-white", line: "bg-success", label: "text-ink-foreground" },
  failed: { marker: "border-primary bg-primary text-primary-foreground", line: "bg-white/15", label: "text-ink-foreground" },
  skipped: { marker: "border-white/15 bg-white/10 text-ink-muted", line: "bg-white/15", label: "text-ink-muted" },
  pending: { marker: "border-dashed border-white/30 bg-ink-2 text-ink-muted", line: "bg-white/15", label: "text-ink-muted" },
};

/**
 * Full journey for one lead, drawn for the dark ink band: rows on phones, five columns joined by horizontal
 * connectors on wide screens. Each step shows its state, when it happened and who did it (customer,
 * automatic, or a named staff member).
 */
export function JourneyStepper({ steps, names, assignee, timeZone }: {
  steps: JourneyStep[]; names: { id: string; name: string }[]; assignee: string | null; timeZone: string;
}) {
  const time = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone });
  const actor = (step: JourneyStep) => step.by === "staff" ? names.find((entry) => entry.id === step.actorId)?.name ?? copy.unknownStaff
    : step.by ? copy.by[step.by] : null;
  return <ol aria-label={copy.journey} className="grid divide-y divide-white/[0.08] lg:grid-cols-5 lg:gap-4 lg:divide-y-0">
    {steps.map((step, index) => {
      const Icon = stateIcons[step.state] ?? stepIcons[step.key];
      const tone = inkTone[step.state];
      const last = index === steps.length - 1;
      const by = actor(step);
      return <li key={step.key} className="relative flex gap-3.5 py-3.5 first:pt-0 last:pb-0 lg:flex-col lg:gap-3 lg:py-0">
        {/* Horizontal connector to the next step on wide screens. */}
        {!last && <span aria-hidden className={cn("absolute top-[1.1875rem] right-[-1rem] left-12 hidden h-0.5 rounded-full lg:block", tone.line)} />}
        <span className={cn("relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border-2", tone.marker, step.state === "done" && "ring-4 ring-success/20")}>
          <Icon aria-hidden className="size-4" strokeWidth={2.5} />
        </span>
        <div className="min-w-0 pt-0.5 lg:pt-0">
          <p className="break-words text-sm font-semibold text-ink-foreground">{stepLabel(step.key, assignee)}</p>
          <p className={cn("mt-0.5 text-xs font-medium", tone.label)}>
            {copy.states[step.state]}{step.at && <span className="text-ink-muted"> · <time dateTime={step.at} className="tabular-nums">{time.format(new Date(step.at))}</time></span>}
          </p>
          {by && <p className="text-xs text-ink-muted">{by}</p>}
          {step.note && <p className="mt-1.5 break-words text-xs text-ink-muted">{step.note}</p>}
        </div>
      </li>;
    })}
  </ol>;
}

/** Five-segment mini journey for feed rows and cards; the full status is in the accessible label. */
export function JourneyDots({ steps, className }: { steps: Pick<JourneyStep, "key" | "state">[]; className?: string }) {
  const description = steps.map((step) => copy.stepSummary(copy.steps[step.key], copy.states[step.state])).join(", ");
  return <span role="img" aria-label={description} title={description} className={cn("flex w-full max-w-40 gap-1", className)}>
    {steps.map((step) => <span key={step.key} className={cn("h-1.5 flex-1 rounded-full", stateTone[step.state].dot)} />)}
  </span>;
}
