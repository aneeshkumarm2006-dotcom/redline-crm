"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Mail, Users, X } from "lucide-react";
import { Popover } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/shared/avatar";
import { LogoutButton } from "@/modules/auth/components/logout-button";
import { authCopy } from "@/modules/auth/copy";
import type { User } from "@/modules/users/schema";
import { shellCopy } from "./copy";
import { brandTheme } from "./theme";

export function AccountMenu({ user, primaryColor }: { user: User; primaryColor: string }) {
  const pathname = usePathname();
  // Remount the popover on navigation so it never obscures the destination.
  return <Popover.Root key={pathname}>
    <Popover.Trigger asChild>
      <Button variant="ghost" className="group h-auto min-h-11 min-w-11 gap-2.5 rounded-xl border border-transparent px-2 transition-[background-color,border-color,box-shadow] duration-150 hover:border-border hover:bg-card hover:shadow-xs data-[state=open]:border-border data-[state=open]:bg-card data-[state=open]:shadow-xs sm:pr-2.5" aria-label={shellCopy.account}>
        <Avatar name={user.name} />
        <span className="min-w-0 text-left">
          <span className="hidden max-w-48 truncate text-sm font-semibold leading-5 sm:block">{user.name}</span>
          <span className="hidden text-xs leading-4 text-muted-foreground sm:block">{authCopy.roles[user.role]}</span>
        </span>
        <ChevronDown aria-hidden="true" className="hidden size-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 sm:block" />
      </Button>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content align="end" sideOffset={8} collisionPadding={16} aria-label={shellCopy.account}
        style={brandTheme(primaryColor)}
        className="z-50 w-80 max-w-[calc(100vw-2rem)] overflow-clip rounded-2xl border bg-popover text-popover-foreground shadow-xl outline-none">
        <div className="flex items-start gap-3 border-b bg-muted/40 p-4">
          <Avatar name={user.name} size="lg" className="mt-0.5 size-12 text-base shadow-sm" />
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="break-words font-semibold tracking-tight">{user.name}</p>
            <span className="mt-1.5 inline-flex min-h-6 items-center gap-1.5 rounded-full bg-brand-soft px-2.5 text-xs font-semibold text-primary">
              <span aria-hidden className="size-1.5 rounded-full bg-primary" />{authCopy.roles[user.role]}
            </span>
          </div>
          <Popover.Close asChild>
            <Button variant="ghost" size="icon" className="-mt-1 -mr-1 size-11 rounded-xl" aria-label={shellCopy.closeAccount}>
              <X aria-hidden="true" className="size-4" />
            </Button>
          </Popover.Close>
        </div>
        <div className="space-y-3 p-4">
          <p className="flex min-w-0 items-start gap-2 text-sm text-muted-foreground"><Mail aria-hidden className="mt-0.5 size-4 shrink-0" /><span className="min-w-0 break-all">{user.email}</span></p>
          {user.role === "owner" && <Popover.Close asChild>
            <Button asChild variant="secondary" className="min-h-11 w-full justify-start gap-2.5 rounded-xl">
              <Link href="/crm/team"><Users aria-hidden className="size-4" />{authCopy.team}</Link>
            </Button>
          </Popover.Close>}
          <div className="border-t pt-3"><LogoutButton /></div>
        </div>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}
