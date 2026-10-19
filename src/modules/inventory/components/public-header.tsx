"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/shared/app-shell/brand";
import { cn } from "@/lib/utils";
import type { Settings } from "@/modules/settings/schema";

/** Routes whose page opens with the ink hero band, under which the header floats transparently. */
const heroRoutes = new Set(["/inventory"]);

/**
 * Showroom header: a light bar, or transparent over the hero on routes that have one. Decided by route rather than
 * a CSS `:has()` check, because the router keeps previously visited pages mounted (hidden) and their hero would
 * still match after navigating to a vehicle page.
 */
export function PublicHeader({ brand, staffLabel }: { brand: Settings["brand"]; staffLabel: string }) {
  const overlay = heroRoutes.has(usePathname());
  const staffLink = "inline-flex min-h-11 items-center rounded-xl px-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
  return <header className={cn("z-20", overlay ? "absolute inset-x-0 top-0 text-ink-foreground" : "sticky top-0 border-b bg-card/90 backdrop-blur-xl backdrop-saturate-150")}>
    <div className="page-gutter flex flex-wrap items-center justify-between gap-3 py-3 sm:py-4">
      <Link href="/inventory" className={cn("min-w-0 max-w-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring", overlay ? "text-white" : "text-foreground")}><Brand brand={brand} /></Link>
      <Link href="/login" className={cn(staffLink, overlay ? "text-ink-foreground hover:bg-white/10 hover:text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>{staffLabel}</Link>
    </div>
  </header>;
}
