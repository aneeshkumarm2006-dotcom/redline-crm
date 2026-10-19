"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** `yyyy-mm-dd` calendar dates. Arithmetic runs in UTC so the dealership's local dates never shift with the viewer's zone. */
const parse = (date: string) => { const [y, m, d] = date.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const key = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000);
const monthStart = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
const addMonths = (date: Date, months: number) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));

const monthLabel = new Intl.DateTimeFormat("en-CA", { month: "long", year: "numeric", timeZone: "UTC" });
const dayLabel = new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Month calendar for choosing one of the `available` dates. Only available days are enabled; arrow keys move between
 * days (Home/End jump to the week's edges, PageUp/PageDown change month), and months outside the available range
 * cannot be opened.
 */
export function Calendar({ available, value, onChange, disabled = false, label, today }: {
  available: string[]; value?: string; onChange: (date: string) => void; disabled?: boolean; label: string; today?: string;
}) {
  const open = useMemo(() => new Set(available), [available]);
  const first = available[0] ? monthStart(parse(available[0])) : monthStart(new Date());
  const last = available.at(-1) ? monthStart(parse(available.at(-1)!)) : first;
  const [month, setMonth] = useState(value ? monthStart(parse(value)) : first);
  const [focus, setFocus] = useState(value ?? available[0]);
  const grid = useRef<HTMLDivElement>(null);

  // Roving tab stop: the focused day if it is in this month, else this month's first available day.
  const inThisMonth = (date: string) => monthStart(parse(date)).getTime() === month.getTime();
  const tabStop = focus && open.has(focus) && inThisMonth(focus) ? focus : available.find(inThisMonth);
  const startOffset = month.getUTCDay();
  const days = Array.from({ length: 42 }, (_, index) => addDays(month, index - startOffset));
  const canBack = month > first;
  const canForward = month < last;

  function move(from: string, by: number) {
    // Step to the nearest available day in that direction, up to two months away.
    let next = addDays(parse(from), by);
    for (let step = 0; step < 62 && !open.has(key(next)); step++) next = addDays(next, Math.sign(by) || 1);
    if (!open.has(key(next))) return;
    const target = key(next);
    setFocus(target);
    setMonth(monthStart(next));
    requestAnimationFrame(() => grid.current?.querySelector<HTMLButtonElement>(`[data-date="${target}"]`)?.focus());
  }
  function onKeyDown(event: React.KeyboardEvent, date: string) {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, PageUp: -28, PageDown: 28 };
    if (event.key in steps) { event.preventDefault(); move(date, steps[event.key]); }
    else if (event.key === "Home") { event.preventDefault(); move(date, -parse(date).getUTCDay() || -1); }
    else if (event.key === "End") { event.preventDefault(); move(date, 6 - parse(date).getUTCDay() || 1); }
  }

  const nav = "flex size-10 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-ring";
  return <div className="select-none">
    <div className="mb-3 flex items-center justify-between gap-2">
      <p className="font-display text-base font-semibold" aria-live="polite">{monthLabel.format(month)}</p>
      <div className="flex gap-1">
        <button type="button" className={nav} onClick={() => setMonth(addMonths(month, -1))} disabled={!canBack || disabled} aria-label="Previous month"><ChevronLeft aria-hidden className="size-5" /></button>
        <button type="button" className={nav} onClick={() => setMonth(addMonths(month, 1))} disabled={!canForward || disabled} aria-label="Next month"><ChevronRight aria-hidden className="size-5" /></button>
      </div>
    </div>
    <div role="grid" aria-label={label} ref={grid} className="grid grid-cols-7 gap-1">
      {weekdays.map((day) => <div key={day} role="columnheader" className="pb-1 text-center text-[0.6875rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{day}</div>)}
      {days.map((date) => {
        const id = key(date);
        const inMonth = date.getUTCMonth() === month.getUTCMonth();
        const isOpen = open.has(id) && inMonth;
        const selected = id === value;
        return <button key={id} type="button" role="gridcell" data-date={id} disabled={!isOpen || disabled}
          aria-selected={selected} aria-label={`${dayLabel.format(date)}${isOpen ? "" : ", unavailable"}`}
          tabIndex={isOpen && id === tabStop ? 0 : -1}
          onClick={() => { setFocus(id); onChange(id); }} onKeyDown={(event) => onKeyDown(event, id)}
          className={cn("relative flex aspect-square min-h-11 flex-col items-center justify-center rounded-xl text-sm font-semibold tabular-nums transition-[background-color,color,box-shadow,transform] duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
            !inMonth && "invisible",
            selected ? "bg-primary text-primary-foreground shadow-[0_6px_16px_-6px_color-mix(in_oklab,var(--primary)_70%,transparent)]"
              : isOpen ? "bg-card text-foreground ring-1 ring-border hover:-translate-y-px hover:ring-foreground/25 active:scale-95"
              : "text-muted-foreground/45")}>
          {date.getUTCDate()}
          {id === today && !selected && <span aria-hidden className="absolute bottom-1.5 size-1 rounded-full bg-primary" />}
        </button>;
      })}
    </div>
  </div>;
}
