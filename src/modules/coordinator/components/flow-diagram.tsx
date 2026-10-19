import { ArrowDown, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JourneyStepKey } from "../journey";
import { coordinatorCopy as copy } from "../copy";
import { stepIcons } from "./journey-stepper";

type FlowStep = { key: JourneyStepKey; done: number; failed: number };

/**
 * The five journey steps as connected boxes (a row on wide screens, a column on phones). Each box shows how
 * many of the period's inquiries reached it; each connector shows how many dropped off before the next step.
 * Plain HTML, so labels never clip at 375px.
 */
export function FlowDiagram({ steps, total }: { steps: FlowStep[]; total: number }) {
  const percent = (value: number) => total ? Math.round((value / total) * 100) : 0;
  return <ol aria-label={copy.flow} className="flex flex-col gap-1 lg:flex-row lg:items-stretch lg:gap-0">
    {steps.map((step, index) => {
      const Icon = stepIcons[step.key];
      const previous = index > 0 ? steps[index - 1].done : null;
      const dropped = previous === null ? 0 : Math.max(0, previous - step.done);
      return <li key={step.key} className="flex flex-col lg:flex-1 lg:flex-row lg:items-center">
        {previous !== null && <div aria-hidden={dropped === 0} className="flex items-center gap-2 py-1 pl-5 lg:flex-col lg:justify-center lg:px-1 lg:py-0">
          <ArrowDown aria-hidden className="size-4 text-muted-foreground lg:hidden" />
          <ArrowRight aria-hidden className="hidden size-4 text-muted-foreground lg:block" />
          <span className={cn("text-xs font-medium tabular-nums lg:text-center", dropped ? "text-danger" : "text-muted-foreground")}>{dropped ? copy.dropOff(dropped) : copy.noDropOff}</span>
        </div>}
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border bg-card p-3 lg:flex-col lg:items-start lg:gap-2">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-primary"><Icon aria-hidden className="size-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{copy.steps[step.key]}</span>
            <span className="mt-0.5 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums">{step.done}</span>
              {index > 0 && <span className="text-xs text-muted-foreground">{copy.ofInquiries(percent(step.done))}</span>}
            </span>
            {step.failed > 0 && <span className="block text-xs font-medium text-danger">{copy.states.failed}: {step.failed}</span>}
          </span>
          <span aria-hidden className="block h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-muted lg:w-full">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${percent(step.done)}%` }} />
          </span>
        </div>
      </li>;
    })}
  </ol>;
}
