import { cn } from "@/lib/utils";

/** Segmented-control item classes shared by the leads and calendar view toolbars. */
export const segmentClass = (active: boolean) => cn("inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  active ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground");
export const segmentGroup = "inline-flex gap-1 rounded-xl bg-muted p-1";
