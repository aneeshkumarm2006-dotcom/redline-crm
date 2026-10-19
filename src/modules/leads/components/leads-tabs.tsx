import Link from "next/link";
import { cn } from "@/lib/utils";
import { leadsCopy as copy } from "../copy";

/** Segmented-control item classes shared by the leads and appointments toolbars. */
export const segmentClass = (active: boolean) => cn("inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  active ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground");
export const segmentGroup = "inline-flex gap-1 rounded-xl bg-muted p-1";

/** Leads and appointments share the Leads tab; a segmented control switches between them. */
export function LeadsTabs({ active }: { active: "leads" | "appointments" }) {
  const items = [["leads", "/crm/leads"], ["appointments", "/crm/leads/appointments"]] as const;
  return <nav aria-label={copy.title} className={cn(segmentGroup, "grid grid-cols-2 sm:inline-grid")}>
    {items.map(([key, href]) => <Link key={key} href={href} aria-current={active === key ? "page" : undefined} className={cn(segmentClass(active === key), "min-h-10 px-5")}>
      {copy.tabs[key]}
    </Link>)}
  </nav>;
}
