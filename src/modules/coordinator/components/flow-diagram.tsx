import { ArrowDown, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JourneyStepKey } from "../journey";
import { coordinatorCopy as copy } from "../copy";
import { stepIcons } from "./journey-stepper";

type FlowStep = { key: JourneyStepKey; done: number; failed: number };

/**
 * The five journey steps as connected tiles (a row on wide screens, a column on phones), drawn for the dark ink
 * band. Each tile shows how many of the period's inquiries reached it; each connector shows how many dropped off
 * before the next step. Plain HTML, so labels never clip at 375px.
 */
export function FlowDiagram({ steps, total }: { steps: FlowStep[]; total: number }) {
  const percent = (value: number) => total ? Math.round((value / total) * 100) : 0;
  return <ol aria-label={copy.flow} className="flex flex-col gap-1 lg:flex-row lg:items-stretch lg:gap-0">
    {steps.map((step, index) => {
      const Icon = stepIcons[step.key];
      const previous = index > 0 ? steps[index - 1].done : null;
      const dropped = previous === null ? 0 : Math.max(0, previous - step.done);
      return <li key={step.key} className="flex flex-col lg:flex-1 lg:flex-row lg:items-center">
        {previous !== null && <div aria-hidden={dropped === 0} className="flex items-center gap-2 py-1.5 pl-6 lg:flex-col lg:justify-center lg:px-2 lg:py-0">
          <ArrowDown aria-hidden className="size-4 text-ink-muted lg:hidden" />
          <ArrowRight aria-hidden className="hidden size-4 text-ink-muted lg:block" />
          <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium tabular-nums lg:text-center", dropped ? "text-ink-foreground" : "text-ink-muted")}>
            {dropped > 0 && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-primary" />}{dropped ? copy.dropOff(dropped) : copy.noDropOff}
          </span>
        </div>}
        <div className="flex min-w-0 flex-1 items-center gap-3.5 rounded-2xl border border-white/[0.07] bg-white/[0.05] p-4 lg:flex-col lg:items-start lg:gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-ink-foreground"><Icon aria-hidden className="size-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-ink-muted">{copy.steps[step.key]}</span>
            <span className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-[1.75rem] leading-none font-semibold tabular-nums text-ink-foreground">{step.done}</span>
              {index > 0 && <span className="text-xs text-ink-muted">{copy.ofInquiries(percent(step.done))}</span>}
            </span>
            {step.failed > 0 && <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">{copy.states.failed}: {step.failed}</span>}
          </span>
          <span aria-hidden className="block h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-white/10 lg:w-full">
            <span className="block h-full rounded-full bg-success" style={{ width: `${percent(step.done)}%` }} />
          </span>
        </div>
      </li>;
    })}
  </ol>;
}
