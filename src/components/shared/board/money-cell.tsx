"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Popover } from "radix-ui";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { boardCopy as copy } from "./copy";
import { formatMoney } from "./format";
import type { BoardMoneyAction } from "./types";

/** Editable money value: tap opens a small editor, Save applies it through the board's server action. */
export function MoneyCell({ itemId, version, columnId, header, subject, value, currency, action, card }: {
  itemId: string; version?: number; columnId: string; header: string; subject: string;
  value: number; currency?: string; action: BoardMoneyAction; card: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(value);
  function save(next: number) {
    setOpen(false);
    if (next === optimistic) return;
    startTransition(async () => {
      setOptimistic(next);
      try {
        const result = await action({ itemId, version, columnId, value: next });
        if (!result.ok) { toast.error(result.message); router.refresh(); return; }
        if (result.warning) toast.warning(result.warning); else toast.success(copy.saved);
      } catch {
        toast.error(copy.networkError);
      }
    });
  }
  return <Popover.Root open={open} onOpenChange={(next) => { if (!pending) setOpen(next); }}>
    <Popover.Trigger disabled={pending} aria-label={`${copy.editValue(header)}: ${subject}. ${formatMoney(optimistic, currency)}`}
      className={cn("group/money flex min-h-11 w-full cursor-pointer items-center gap-1.5 font-medium tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-progress disabled:opacity-70",
        card ? "min-h-8 justify-start rounded-md" : "justify-end px-3 py-1.5 hover:bg-muted")}>
      {formatMoney(optimistic, currency)}
      <Pencil aria-hidden className="size-3 shrink-0 text-muted-foreground opacity-60 group-hover/money:opacity-100" />
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content align="end" sideOffset={4} collisionPadding={12}
        className="z-50 w-64 rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
        <form onSubmit={(event) => {
          event.preventDefault();
          const next = Number(new FormData(event.currentTarget).get("value"));
          if (Number.isFinite(next) && next >= 0) save(Math.round(next * 100) / 100);
        }} className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">{header} · {subject}</span>
            <input name="value" type="number" inputMode="decimal" min="0" max="100000000" step="0.01" required defaultValue={optimistic} autoFocus
              className="min-h-11 w-full rounded-md border bg-background px-3 text-base tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </label>
          <div className="flex justify-end gap-2">
            <Popover.Close className="min-h-11 rounded-md px-3 text-sm hover:bg-muted">{copy.cancel}</Popover.Close>
            <button type="submit" className="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">{copy.save}</button>
          </div>
        </form>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}
