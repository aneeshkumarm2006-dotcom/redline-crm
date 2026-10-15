import Link from "next/link";
import { leadsCopy as copy } from "../copy";

/** Leads and appointments share the Leads tab; a segmented control switches between them. */
export function LeadsTabs({ active }: { active: "leads" | "appointments" }) {
  const items = [["leads", "/crm/leads"], ["appointments", "/crm/leads/appointments"]] as const;
  return <nav aria-label={copy.title} className="grid grid-cols-2 gap-1 rounded-xl border bg-card p-1 sm:inline-grid">
    {items.map(([key, href]) => <Link key={key} href={href} aria-current={active === key ? "page" : undefined}
      className={`flex min-h-11 items-center justify-center rounded-lg px-5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
        active === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
      {copy.tabs[key]}
    </Link>)}
  </nav>;
}
