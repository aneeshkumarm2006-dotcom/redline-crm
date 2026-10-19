import { ChevronDown, SlidersHorizontal } from "lucide-react";

/**
 * Collapsible filter panel so lists start near the top of a phone screen.
 * It opens automatically while filters are applied, so they stay visible and easy to change.
 */
export function FilterDisclosure({ label, active, children }: { label: string; active: number; children: React.ReactNode }) {
  return <details open={active > 0} className="group rounded-2xl border bg-card shadow-xs">
    <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-2xl px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
      <SlidersHorizontal aria-hidden className="size-4 text-muted-foreground" />
      <span className="flex-1">{label}</span>
      {active > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground tabular-nums">{active}</span>}
      <ChevronDown aria-hidden className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
    </summary>
    <div className="border-t p-4">{children}</div>
  </details>;
}
