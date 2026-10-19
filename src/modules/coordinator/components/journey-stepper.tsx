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

/**
 * Full journey for one lead: vertical on phones, five columns on wide screens. Each step shows its state,
 * when it happened and who did it (customer, automatic, or a named staff member).
 */
export function JourneyStepper({ steps, names, assignee, timeZone }: {
  steps: JourneyStep[]; names: { id: string; name: string }[]; assignee: string | null; timeZone: string;
}) {
  const time = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone });
  const actor = (step: JourneyStep) => step.by === "staff" ? names.find((entry) => entry.id === step.actorId)?.name ?? copy.unknownStaff
    : step.by ? copy.by[step.by] : null;
  return <ol aria-label={copy.journey} className="grid gap-0 lg:grid-cols-5 lg:gap-3">
    {steps.map((step, index) => {
      const Icon = stateIcons[step.state] ?? stepIcons[step.key];
      const tone = stateTone[step.state];
      const last = index === steps.length - 1;
      const by = actor(step);
      return <li key={step.key} className="relative flex gap-3 pb-5 last:pb-0 lg:flex-col lg:gap-2 lg:pb-0">
        {/* Connector to the next step: down on phones, across on wide screens. */}
        {!last && <span aria-hidden className={cn("absolute top-9 bottom-0 left-[1.0625rem] w-0.5 lg:top-[1.0625rem] lg:right-[-0.75rem] lg:bottom-auto lg:left-11 lg:h-0.5 lg:w-auto", tone.line)} />}
        <span className={cn("relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border-2", tone.marker)}>
          <Icon aria-hidden className="size-4" strokeWidth={2.5} />
        </span>
        <div className="min-w-0 pt-1 lg:pt-0">
          <p className="break-words text-sm font-semibold">{stepLabel(step.key, assignee)}</p>
          <p className={cn("text-xs font-medium", step.state === "done" ? "text-success" : step.state === "failed" ? "text-danger" : "text-muted-foreground")}>
            {copy.states[step.state]}{step.at && <> · <time dateTime={step.at}>{time.format(new Date(step.at))}</time></>}
          </p>
          {by && <p className="text-xs text-muted-foreground">{by}</p>}
          {step.note && <p className="mt-1 break-words text-xs text-muted-foreground">{step.note}</p>}
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
