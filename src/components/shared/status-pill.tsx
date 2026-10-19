import { cn } from "@/lib/utils";
import { readableForeground } from "@/lib/color";
import type { StatusDefinition } from "@/modules/settings/schema";

export type PillOption = Pick<StatusDefinition, "key" | "label" | "color">;

const NEUTRAL = "#94A3B8";

/** Resolve a key against settings options; unknown keys keep their raw key with neutral styling. */
export function resolvePill(options: readonly PillOption[], key: string | null | undefined): PillOption | null {
  if (!key) return null;
  return options.find((option) => option.key === key) ?? { key, label: key, color: NEUTRAL };
}

/**
 * Monday-style pill: a solid settings colour that fills its cell, with readable text.
 * `fill` stretches it to the whole board cell; otherwise it sizes to its label.
 */
export function StatusPill({ option, fill = false, emptyLabel, className }: { option: PillOption | null; fill?: boolean; emptyLabel?: string; className?: string }) {
  const base = cn("inline-flex min-w-0 items-center justify-center truncate px-2.5 text-center text-xs font-semibold", fill ? "h-full min-h-9 w-full rounded-none" : "min-h-6 rounded-full", className);
  if (!option) return <span className={cn(base, "bg-muted text-muted-foreground")}>{emptyLabel ?? "—"}</span>;
  return <span className={base} style={{ backgroundColor: option.color, color: readableForeground(option.color) }} title={option.label}>
    {option.label}
  </span>;
}
