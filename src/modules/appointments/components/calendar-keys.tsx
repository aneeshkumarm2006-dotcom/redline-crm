"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { appointmentsCopy as copy } from "../copy";

type Views = { month: string; week: string; day: string; list: string };

/**
 * Keyboard shortcuts: ←/→ (or J/K) move a period, T jumps to today, M/W/D/L switch view. Ignored while typing,
 * with a modifier held, or while a sheet or dialog is open.
 */
export function CalendarKeys({ prev, next, today, views }: { prev?: string; next?: string; today?: string; views: Views }) {
  const router = useRouter();
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true], [role=listbox], [role=menu]") || document.querySelector("[role=dialog]")) return;
      const key = event.key.toLowerCase();
      const href = { arrowleft: prev, j: prev, arrowright: next, k: next, t: today, m: views.month, w: views.week, d: views.day, l: views.list }[key];
      if (!href) return;
      event.preventDefault();
      router.push(href);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, prev, next, today, views.month, views.week, views.day, views.list]);
  return null;
}

/** Native date input that jumps the current view to the chosen day. `base` is the view's URL without a date. */
export function DateJump({ date, base }: { date: string; base: string }) {
  const router = useRouter();
  return <label className="relative inline-flex min-h-11 items-center">
    <span className="sr-only">{copy.jumpTo}</span>
    <input type="date" value={date} onChange={(event) => { if (event.target.value) router.push(`${base}${base.includes("?") ? "&" : "?"}date=${event.target.value}`); }}
      className="min-h-11 rounded-xl border border-input bg-card px-3 text-sm font-medium tabular-nums shadow-xs hover:border-foreground/25 focus-visible:outline-2 focus-visible:outline-ring" />
  </label>;
}
