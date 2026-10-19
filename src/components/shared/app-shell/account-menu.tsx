"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, X } from "lucide-react";
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
      <Button variant="ghost" className="h-auto min-h-11 min-w-11 gap-2 px-2" aria-label={shellCopy.account}>
        <Avatar name={user.name} />
        <span className="min-w-0 text-left">
          <span className="hidden max-w-48 truncate text-sm sm:block">{user.name}</span>
          <span className="block text-xs text-muted-foreground">{authCopy.roles[user.role]}</span>
        </span>
        <ChevronDown aria-hidden="true" className="hidden size-4 sm:block" />
      </Button>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content align="end" sideOffset={8} collisionPadding={16} aria-label={shellCopy.account}
        style={brandTheme(primaryColor)}
        className="z-50 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border bg-popover p-4 text-popover-foreground shadow-lg outline-none">
        <div className="flex items-start gap-2">
          <Avatar name={user.name} size="lg" className="mt-1" />
          <div className="min-w-0 flex-1 py-2">
            <p className="break-words font-semibold">{user.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{authCopy.roles[user.role]}</p>
          </div>
          <Popover.Close asChild>
            <Button variant="ghost" size="icon" className="size-11" aria-label={shellCopy.closeAccount}>
              <X aria-hidden="true" className="size-4" />
            </Button>
          </Popover.Close>
        </div>
        <p className="mb-4 break-all text-sm text-muted-foreground">{user.email}</p>
        <div className="space-y-2 border-t pt-4">
          {user.role === "owner" && <Popover.Close asChild>
            <Button asChild variant="secondary" className="min-h-11 w-full">
              <Link href="/crm/team">{authCopy.team}</Link>
            </Button>
          </Popover.Close>}
          <LogoutButton />
        </div>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}
