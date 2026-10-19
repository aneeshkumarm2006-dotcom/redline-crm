"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CarFront, ChevronRight, Ellipsis, LayoutDashboard, Route, Settings, Users, UsersRound, Wrench, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Role } from "@/modules/users/schema";
import { shellCopy, shellNavigation, type ShellSection } from "./copy";
import { brandTheme } from "./theme";

const sectionIcons: Record<ShellSection, typeof Bell> = {
  dashboard: LayoutDashboard, inventory: CarFront, leads: UsersRound, team: Users,
  coordinator: Route, automations: Zap, garages: Wrench, alerts: Bell, settings: Settings,
};

function isActive(pathname: string, key: ShellSection) {
  const href = shellCopy.sections[key].href;
  return pathname === href || (key !== "dashboard" && pathname.startsWith(href + "/"));
}

/** Desktop sidebar: dark surface, primary links first, then the "More" tools. */
export function SidebarNavigation({ role }: { role: Role }) {
  const pathname = usePathname();
  const { primary, more } = shellNavigation[role];
  const link = (key: ShellSection) => {
    const active = isActive(pathname, key);
    const Icon = sectionIcons[key];
    return <li key={key}>
      <Link href={shellCopy.sections[key].href} aria-current={active ? "page" : undefined}
        className={cn("group flex min-h-10 items-center gap-3 rounded-xl px-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring",
          active ? "bg-white/[0.08] text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]" : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground")}>
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors", active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-muted group-hover:text-sidebar-foreground")}>
          <Icon aria-hidden className="size-4" />
        </span>
        <span className="truncate">{shellCopy.sections[key].label}</span>
      </Link>
    </li>;
  };
  return <nav aria-label={shellCopy.navigation} className="space-y-7">
    <ul className="space-y-1">{primary.map(link)}</ul>
    {more.length > 0 && <div>
      <p className="mb-2 px-2 text-[0.6875rem] font-semibold tracking-[0.08em] text-sidebar-muted/80 uppercase">{shellCopy.more}</p>
      <ul className="space-y-1">{more.map(link)}</ul>
    </div>}
  </nav>;
}

/** Mobile bottom bar: up to five slots; extra sections open from "More" in a bottom sheet. */
export function BottomNavigation({ role, primaryColor }: { role: Role; primaryColor: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { primary, more } = shellNavigation[role];
  const moreActive = more.some((key) => isActive(pathname, key));
  const slot = "flex min-h-12 min-w-11 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[0.6875rem] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
  const tone = (active: boolean) => active ? "text-primary" : "text-muted-foreground hover:text-foreground";
  return <nav aria-label={shellCopy.navigation} className={cn("grid gap-1", more.length ? "grid-cols-5" : "grid-cols-4")}>
    {primary.map((key) => {
      const active = isActive(pathname, key);
      const Icon = sectionIcons[key];
      return <Link key={key} href={shellCopy.sections[key].href} aria-current={active ? "page" : undefined} className={cn(slot, tone(active))}>
        <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", active && "bg-brand-soft")}><Icon aria-hidden className="size-5" /></span>
        <span className="max-w-full truncate">{shellCopy.sections[key].label}</span>
      </Link>;
    })}
    {more.length > 0 && <Sheet open={open} onOpenChange={setOpen}>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} className={cn(slot, tone(moreActive))}>
        <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", moreActive && "bg-brand-soft")}><Ellipsis aria-hidden className="size-5" /></span>
        <span>{shellCopy.more}</span>
      </button>
      <SheetContent side="bottom" style={brandTheme(primaryColor)} className="rounded-t-2xl px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader className="px-2 pb-0"><SheetTitle>{shellCopy.moreTitle}</SheetTitle><SheetDescription>{shellCopy.moreHint}</SheetDescription></SheetHeader>
        <ul className="grid gap-1">
          {more.map((key) => {
            const active = isActive(pathname, key);
            const Icon = sectionIcons[key];
            const description = key in shellCopy.descriptions ? shellCopy.descriptions[key as keyof typeof shellCopy.descriptions] : undefined;
            return <li key={key}>
              <Link href={shellCopy.sections[key].href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
                className={cn("flex min-h-14 items-center gap-3 rounded-xl px-2 py-2 focus-visible:outline-2 focus-visible:outline-ring", active ? "bg-brand-soft" : "hover:bg-muted")}>
                <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}><Icon aria-hidden className="size-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{shellCopy.sections[key].label}</span>
                  {description && <span className="block text-xs text-muted-foreground">{description}</span>}
                </span>
                <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>;
          })}
        </ul>
      </SheetContent>
    </Sheet>}
  </nav>;
}
