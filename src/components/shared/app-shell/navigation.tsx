"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CarFront, LayoutDashboard, UsersRound } from "lucide-react";
import { shellCopy, type ShellSection } from "./copy";

const sectionIcons = { dashboard: LayoutDashboard, leads: UsersRound, inventory: CarFront, alerts: Bell };

export function ShellNavigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  return <nav aria-label={shellCopy.navigation} className={mobile ? "grid grid-cols-4 gap-1" : "space-y-2"}>
    {(Object.entries(shellCopy.sections) as [ShellSection, typeof shellCopy.sections[ShellSection]][]).map(([key, item]) => {
      const active = pathname === item.href || (key !== "dashboard" && pathname.startsWith(item.href + "/"));
      const Icon = sectionIcons[key];
      return <Link key={key} href={item.href} aria-current={active ? "page" : undefined}
        className={`flex min-h-12 min-w-11 items-center rounded-xl font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
          mobile ? "flex-col justify-center gap-1 px-1 py-2 text-xs" : "gap-3 px-4 py-3 text-sm"
        } ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
        <Icon aria-hidden="true" className="size-5 shrink-0" />
        <span>{item.label}</span>
      </Link>;
    })}
  </nav>;
}
