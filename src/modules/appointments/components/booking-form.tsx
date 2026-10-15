"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BookingResult } from "../schema";
import { bookAppointment } from "../actions";
import { bookingCopy as copy } from "../copy";

type Day = { date: string; label: string; slots: { startsAt: string; label: string; when: string }[] };

export function BookingForm({ token, days, zone }: { token: string; days: Day[]; zone: string }) {
  const id = useId();
  const router = useRouter();
  const busy = useRef(false);
  const success = useRef<HTMLHeadingElement>(null);
  const [date, setDate] = useState(days[0]?.date);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<BookingResult | null>(null);
  useEffect(() => { if (result?.ok) success.current?.focus(); }, [result]);

  // A refresh after a conflict can remove the selected day or slot.
  const day = days.find((entry) => entry.date === date) ?? days[0];
  const slot = day?.slots.find((entry) => entry.startsAt === startsAt) ?? null;

  async function confirm() {
    if (!slot || busy.current) return;
    busy.current = true; setPending(true); setResult(null);
    try {
      const outcome = await bookAppointment({ token, startsAt: slot.startsAt });
      setResult(outcome);
      if (!outcome.ok) { setStartsAt(null); router.refresh(); }
    } catch { setResult({ ok: false, message: copy.error }); }
    finally { busy.current = false; setPending(false); }
  }

  if (result?.ok) return <section role="status" className="space-y-3 rounded-2xl border bg-card p-6">
    <CheckCircle2 className="size-9 text-primary" aria-hidden="true" />
    <h2 ref={success} tabIndex={-1} className="text-xl font-semibold outline-none">{copy.bookedTitle}</h2>
    <p className="text-lg font-medium">{result.when}</p>
    <p className="text-sm text-muted-foreground">{copy.emailed} {copy.change}</p>
  </section>;

  if (!day) return <p className="rounded-2xl border bg-card p-6">{copy.noSlots}</p>;

  return <section className="space-y-6 rounded-2xl border bg-card p-5 sm:p-6" aria-busy={pending}>
    <div role="group" aria-labelledby={`${id}-day`} className="min-w-0 space-y-3">
      <h2 id={`${id}-day`} className="font-semibold">{copy.day}</h2>
      <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
        {days.map((entry) => <Button key={entry.date} type="button" variant={entry.date === day.date ? "default" : "outline"}
          aria-pressed={entry.date === day.date} disabled={pending}
          onClick={() => { setDate(entry.date); setStartsAt(null); }} className="min-h-12 shrink-0 snap-start px-4">{entry.label}</Button>)}
      </div>
    </div>
    <div role="group" aria-labelledby={`${id}-time`} className="space-y-3">
      <div><h2 id={`${id}-time`} className="font-semibold">{copy.time}</h2><p className="text-sm text-muted-foreground">{copy.zone(zone)}</p></div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {day.slots.map((entry) => <Button key={entry.startsAt} type="button" variant={entry.startsAt === slot?.startsAt ? "default" : "outline"}
          aria-pressed={entry.startsAt === slot?.startsAt} disabled={pending}
          onClick={() => setStartsAt(entry.startsAt)} className="min-h-11 px-2">{entry.label}</Button>)}
      </div>
    </div>
    {result && !result.ok && <p role="alert" className="text-sm text-destructive">{result.message}</p>}
    {/* Once a time is chosen, the confirm panel sticks to the bottom on phones so it stays in reach. */}
    <div className={cn("space-y-3 rounded-xl bg-muted/40 p-4", slot
      ? "sticky bottom-3 z-10 border bg-card shadow-lg sm:static sm:border-0 sm:bg-muted/40 sm:shadow-none"
      : "opacity-60")}>
      <p className="text-sm text-muted-foreground">{copy.selected}</p>
      <p className="font-medium" aria-live="polite">{slot?.when ?? "—"}</p>
      <Button type="button" onClick={confirm} disabled={!slot || pending} className="min-h-11 w-full">{pending ? copy.pending : copy.confirm}</Button>
    </div>
  </section>;
}
