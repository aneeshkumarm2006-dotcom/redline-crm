import Link from "next/link";
import { cn } from "@/lib/utils";
import { automationsCopy as copy } from "../copy";

/** Recipes and the Email log share the Automations section; a segmented control switches between them. */
export function AutomationsTabs({ active }: { active: "recipes" | "emails" }) {
  const items = [["recipes", "/crm/automations"], ["emails", "/crm/automations/emails"]] as const;
  return <nav aria-label={copy.tabsLabel} className="grid w-full grid-cols-2 gap-1 rounded-xl bg-muted p-1 sm:inline-grid sm:w-auto">
    {items.map(([key, href]) => <Link key={key} href={href} aria-current={active === key ? "page" : undefined}
      className={cn("flex min-h-9 items-center justify-center rounded-lg px-3.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11",
        active === key ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground")}>
      {copy.tabs[key]}
    </Link>)}
  </nav>;
}
