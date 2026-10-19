"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { StatusPill, resolvePill, type PillOption } from "../status-pill";
import { boardCopy as copy } from "./copy";
import type { BoardStatusAction } from "./types";

/** Editable status pill: tap opens the settings options, the choice saves immediately. */
export function StatusCell({ itemId, version, columnId, header, subject, value, options, action, fill }: {
  itemId: string; version?: number; columnId: string; header: string; subject: string;
  value: string | null; options: PillOption[]; action: BoardStatusAction; fill: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(value);
  const current = resolvePill(options, optimistic);
  function choose(next: string) {
    if (next === optimistic) return;
    startTransition(async () => {
      setOptimistic(next);
      try {
        const result = await action({ itemId, version, columnId, value: next });
        if (!result.ok && result.href) { toast.info(result.message); router.push(result.href); return; }
        if (!result.ok) { toast.error(result.message); router.refresh(); return; }
        if (result.warning) toast.warning(result.warning); else toast.success(copy.saved);
      } catch {
        toast.error(copy.networkError);
      }
    });
  }
  return <DropdownMenu.Root>
    <DropdownMenu.Trigger disabled={pending} aria-label={`${copy.changeStatus(header)}: ${subject}. ${current?.label ?? copy.none}`}
      className={cn("block min-w-0 cursor-pointer outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-progress disabled:opacity-70",
        fill ? "h-full w-full" : "min-h-11 rounded-full")}>
      <StatusPill option={current} fill={fill} className={fill ? "min-h-11" : "min-h-8 px-3"} />
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content align="center" sideOffset={4} collisionPadding={12}
        className="z-50 min-w-48 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
        <DropdownMenu.Label className="px-2 pt-1 pb-2 text-xs font-medium text-muted-foreground">{header}</DropdownMenu.Label>
        <DropdownMenu.RadioGroup value={optimistic ?? ""} onValueChange={choose} className="grid gap-1">
          {options.map((option) => <DropdownMenu.RadioItem key={option.key} value={option.key}
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg p-1 outline-none data-[highlighted]:bg-muted">
            <StatusPill option={option} className="min-h-8 flex-1 rounded-md" />
            <span className="flex w-5 justify-center">
              <DropdownMenu.ItemIndicator><Check aria-hidden className="size-4" /><span className="sr-only">{copy.current}</span></DropdownMenu.ItemIndicator>
            </span>
          </DropdownMenu.RadioItem>)}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>;
}
