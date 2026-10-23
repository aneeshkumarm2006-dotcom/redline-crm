"use client";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { staffBookingCopy as copy } from "../copy";

export type SlotDayOption = { date: string; label: string; slots: { startsAt: string; label: string; when: string }[] };

/**
 * Day chips, that day's free times and a sticky confirm panel. Shared by staff booking on the lead, the calendar's
 * new-appointment sheet and rescheduling. The server re-checks the slot, so a stale list only costs a retry.
 */
export function SlotChooser({ days, zone, pending, confirmLabel = copy.confirm, pendingLabel = copy.pending, onConfirm }: {
  days: SlotDayOption[]; zone: string; pending: boolean; confirmLabel?: string; pendingLabel?: string; onConfirm: (startsAt: string) => void;
}) {
  const id = useId();
  const [date, setDate] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const day = days.find((entry) => entry.date === date) ?? days[0];
  const slot = day?.slots.find((entry) => entry.startsAt === startsAt) ?? null;
  if (!day) return <p className="text-sm text-muted-foreground">{copy.noSlots}</p>;
  return <div className="space-y-5" aria-busy={pending}>
    <div role="group" aria-labelledby={`${id}-day`} className="min-w-0 space-y-2">
      <h3 id={`${id}-day`} className="eyebrow">{copy.day}</h3>
      <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
        {days.map((entry) => <Button key={entry.date} type="button" variant={entry.date === day.date ? "default" : "outline"} aria-pressed={entry.date === day.date} disabled={pending}
          onClick={() => { setDate(entry.date); setStartsAt(null); }} className={cn("min-h-11 shrink-0 snap-start rounded-xl px-4", entry.date !== day.date && "bg-card shadow-xs")}>{entry.label}</Button>)}
      </div>
    </div>
    <div role="group" aria-labelledby={`${id}-time`} className="space-y-2">
      <div><h3 id={`${id}-time`} className="eyebrow">{copy.time}</h3><p className="mt-0.5 text-xs text-muted-foreground">{copy.zone(zone)}</p></div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {day.slots.map((entry) => <Button key={entry.startsAt} type="button" variant={entry.startsAt === slot?.startsAt ? "default" : "outline"} aria-pressed={entry.startsAt === slot?.startsAt}
          disabled={pending} onClick={() => setStartsAt(entry.startsAt)} className={cn("min-h-11 rounded-xl px-2 tabular-nums", entry.startsAt !== slot?.startsAt && "bg-card shadow-xs")}>{entry.label}</Button>)}
      </div>
    </div>
    <div className="sticky bottom-0 space-y-2 rounded-2xl border bg-card p-4 shadow-md">
      <p className="eyebrow">{copy.selected}</p>
      <p className="font-display text-base font-semibold tabular-nums" aria-live="polite">{slot?.when ?? "—"}</p>
      <Button type="button" onClick={() => slot && onConfirm(slot.startsAt)} disabled={!slot || pending} className="min-h-11 w-full">{pending ? pendingLabel : confirmLabel}</Button>
    </div>
  </div>;
}
