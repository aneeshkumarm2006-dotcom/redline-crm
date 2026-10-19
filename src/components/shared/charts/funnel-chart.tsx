import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatValue, themeSeriesColor, type ValueFormat } from "./format";
import type { Segment } from "./types";
import { chartCopy } from "./copy";

/**
 * Ordered stages as horizontal bars from one baseline, each with its share of the first stage.
 * Plain HTML (no SVG) so labels never clip on a 375px screen; steps link to their boards.
 */
export function FunnelChart({ title, steps, format, conversionLabel = chartCopy.ofFirstStep }: {
  title: string; steps: Segment[]; format?: ValueFormat; conversionLabel?: (percent: number) => string;
}) {
  const first = steps[0]?.value ?? 0;
  const max = Math.max(1, ...steps.map((step) => step.value));
  return <ol aria-label={title} className="space-y-2.5">
    {steps.map((step, index) => {
      const percent = first > 0 ? Math.round((step.value / first) * 100) : 0;
      const row = <>
        <span className="flex items-baseline justify-between gap-3 text-sm">
          <span className="truncate font-medium">{step.label}</span>
          <span className="shrink-0 tabular-nums"><span className="font-semibold">{formatValue(step.value, format)}</span>
            {index > 0 && <span className="ml-2 text-xs text-muted-foreground">{conversionLabel(percent)}</span>}</span>
        </span>
        <span className="mt-1 block h-2.5 overflow-hidden rounded-full bg-muted">
          <span className="block h-full rounded-full" style={{ width: `${Math.max(2, (step.value / max) * 100)}%`, backgroundColor: step.color ?? themeSeriesColor(index) }} />
        </span>
      </>;
      return <li key={step.key}>
        {step.href ? <Link href={step.href} className={cn("block rounded-md p-1 -m-1 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring")}>{row}</Link> : row}
      </li>;
    })}
  </ol>;
}
