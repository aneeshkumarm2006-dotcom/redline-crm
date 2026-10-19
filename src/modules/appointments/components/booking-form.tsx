"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Moon, Sun, Sunrise } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BookingResult } from "../schema";
import { bookAppointment } from "../actions";
import { bookingCopy as copy } from "../copy";

type Day = { date: string; label: string; slots: { startsAt: string; label: string; when: string }[] };

/** Morning / afternoon / evening, from the slot's local label (e.g. "9:30 a.m."). */
function period(label: string) {
  const match = /^(\d{1,2}):\d{2}\s*([ap])/i.exec(label);
  if (!match) return "afternoon";
  const hour = Number(match[1]) % 12 + (match[2].toLowerCase() === "p" ? 12 : 0);
  return hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
}
const periods = [
  { key: "morning", label: "Morning", icon: Sunrise }, { key: "afternoon", label: "Afternoon", icon: Sun }, { key: "evening", label: "Evening", icon: Moon },
] as const;

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

  // Flat by design: the booking screen supplies the task card around it.
  if (result?.ok) return <section role="status" className="space-y-3">
    <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-2xl bg-success/10 text-success"><CheckCircle2 className="size-7" /></span>
    <h2 ref={success} tabIndex={-1} className="font-display pt-1 text-2xl font-bold outline-none">{copy.bookedTitle}</h2>
    <p className="font-display text-lg font-semibold">{result.when}</p>
    <p className="text-sm leading-6 text-muted-foreground">{copy.emailed} {copy.change}</p>
  </section>;

  if (!day) return <p className="rounded-2xl bg-surface p-5 leading-6">{copy.noSlots}</p>;

  const choice = (selected: boolean) => cn("h-auto rounded-xl border text-[0.9375rem] font-semibold shadow-none active:scale-[0.98]",
    selected ? "border-primary bg-primary text-primary-foreground shadow-[0_6px_16px_-6px_color-mix(in_oklab,var(--primary)_70%,transparent)] hover:bg-primary/90" : "border-input bg-card text-foreground hover:border-foreground/25 hover:bg-muted");
  const dayHeading = new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${day.date}T00:00:00Z`));
  return <section className="space-y-7" aria-busy={pending}>
    <div className="grid gap-6 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:gap-8">
      <div role="group" aria-labelledby={`${id}-day`} className="min-w-0 space-y-3">
        <h2 id={`${id}-day`} className="font-display text-base font-semibold">{copy.day}</h2>
        <div className="rounded-2xl bg-surface p-3 sm:p-4">
          <Calendar label={copy.day} available={days.map((entry) => entry.date)} value={day.date} today={days[0]?.date} disabled={pending}
            onChange={(next) => { setDate(next); setStartsAt(null); }} />
        </div>
      </div>
      <div role="group" aria-labelledby={`${id}-time`} className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id={`${id}-time`} className="font-display text-base font-semibold">{copy.time} <span className="font-sans text-sm font-medium text-muted-foreground">· {dayHeading}</span></h2>
          <p className="text-xs text-muted-foreground">{copy.zone(zone)}</p>
        </div>
        {periods.map(({ key, label, icon: Icon }) => {
          const slots = day.slots.filter((entry) => period(entry.label) === key);
          if (!slots.length) return null;
          return <div key={key} className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase"><Icon aria-hidden className="size-3.5" />{label}</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4">
              {slots.map((entry) => <Button key={entry.startsAt} type="button" variant="outline"
                aria-pressed={entry.startsAt === slot?.startsAt} disabled={pending}
                onClick={() => setStartsAt(entry.startsAt)} className={cn(choice(entry.startsAt === slot?.startsAt), "min-h-12 px-2 tabular-nums")}>{entry.label}</Button>)}
            </div>
          </div>;
        })}
      </div>
    </div>
    {result && !result.ok && <p role="alert" className="text-sm font-medium text-destructive">{result.message}</p>}
    {/* Once a time is chosen, the confirm panel sticks to the bottom on phones so it stays in reach. */}
    <div className={cn("space-y-3 rounded-2xl bg-surface p-4 sm:p-5", slot
      ? "sticky bottom-3 z-10 bg-card shadow-xl ring-1 ring-border sm:static sm:bg-surface sm:shadow-none sm:ring-0"
      : "opacity-70")}>
      <div><p className="eyebrow">{copy.selected}</p>
        <p className="font-display mt-1 text-lg font-semibold" aria-live="polite">{slot?.when ?? "—"}</p></div>
      <Button type="button" onClick={confirm} disabled={!slot || pending} className="h-14 w-full rounded-2xl text-[0.9375rem]">{pending ? copy.pending : copy.confirm}</Button>
    </div>
  </section>;
}
