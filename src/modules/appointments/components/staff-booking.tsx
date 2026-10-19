"use client";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { brandTheme } from "@/components/shared/app-shell/theme";
import { cn } from "@/lib/utils";
import type { StaffBookingOptions } from "../service";
import { bookForLeadAction, getStaffBookingOptionsAction } from "../actions";
import { staffBookingCopy as copy } from "../copy";

type Loaded = StaffBookingOptions | "loading" | "error";

/**
 * Staff books a visit for the customer (on the phone, at the desk). Free times for the lead's salesperson load
 * when the sheet opens; the server re-checks the slot, so a stale list only costs a retry.
 */
export function StaffBookingControl({ leadId, name, primaryColor }: { leadId: string; name: string; primaryColor: string }) {
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Loaded>("loading");
  const [date, setDate] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  function load() {
    setOptions("loading"); setError(""); setStartsAt(null);
    getStaffBookingOptionsAction(leadId).then((result) => setOptions(result ?? "error"), () => setOptions("error"));
  }
  function change(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (next) load();
  }
  const days = typeof options === "object" && options.state === "open" ? options.days : [];
  const day = days.find((entry) => entry.date === date) ?? days[0];
  const slot = day?.slots.find((entry) => entry.startsAt === startsAt) ?? null;
  function confirm() {
    if (!slot) return;
    setError("");
    startTransition(async () => {
      const result = await bookForLeadAction({ leadId, startsAt: slot.startsAt }).catch(() => ({ ok: false as const, message: copy.error }));
      if (!result.ok) { setError(result.message); toast.error(result.message); load(); return; }
      if (result.warning) toast.warning(result.warning); else toast.success(copy.booked(result.when));
      setOpen(false);
      router.refresh();
    });
  }
  return <Sheet open={open} onOpenChange={change}>
    <SheetTrigger asChild><Button variant="outline" className="min-h-12 justify-start gap-3 rounded-xl bg-card shadow-xs"><CalendarPlus aria-hidden className="size-5" />{copy.book}</Button></SheetTrigger>
    <SheetContent side="bottom" showCloseButton={false} style={brandTheme(primaryColor)} className="max-h-[90dvh] gap-5 overflow-y-auto rounded-t-[1.25rem] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-lg sm:p-6">
      <SheetHeader className="p-0 pr-16">
        <SheetTitle className="text-lg font-semibold tracking-tight">{copy.title}</SheetTitle>
        <SheetDescription>{typeof options === "object" && options.state === "open" ? `${name} · ${copy.hint(options.salespersonName)}` : name}</SheetDescription>
      </SheetHeader>
      <SheetClose asChild><Button variant="ghost" disabled={pending} className="absolute right-2 top-2 min-h-11 min-w-11">{copy.close}</Button></SheetClose>
      {options === "loading" && <p role="status" className="text-sm text-muted-foreground">{copy.loading}</p>}
      {options === "error" && <div className="space-y-3"><p role="alert" className="text-sm text-destructive">{copy.loadError}</p><Button variant="outline" className="min-h-11" onClick={load}>{copy.retry}</Button></div>}
      {typeof options === "object" && options.state === "booked" && <p className="text-sm">{copy.existing(options.when)}</p>}
      {typeof options === "object" && options.state === "unassigned" && <p className="text-sm text-muted-foreground">{copy.unassigned}</p>}
      {typeof options === "object" && options.state === "open" && (!day ? <p className="text-sm text-muted-foreground">{copy.noSlots}</p> : <div className="space-y-5" aria-busy={pending}>
        <div role="group" aria-labelledby={`${id}-day`} className="min-w-0 space-y-2">
          <h3 id={`${id}-day`} className="eyebrow">{copy.day}</h3>
          <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
            {days.map((entry) => <Button key={entry.date} type="button" variant={entry.date === day.date ? "default" : "outline"} aria-pressed={entry.date === day.date} disabled={pending}
              onClick={() => { setDate(entry.date); setStartsAt(null); }} className={cn("min-h-11 shrink-0 snap-start rounded-xl px-4", entry.date !== day.date && "bg-card shadow-xs")}>{entry.label}</Button>)}
          </div>
        </div>
        <div role="group" aria-labelledby={`${id}-time`} className="space-y-2">
          <div><h3 id={`${id}-time`} className="eyebrow">{copy.time}</h3><p className="mt-0.5 text-xs text-muted-foreground">{copy.zone(options.zone)}</p></div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {day.slots.map((entry) => <Button key={entry.startsAt} type="button" variant={entry.startsAt === slot?.startsAt ? "default" : "outline"} aria-pressed={entry.startsAt === slot?.startsAt}
              disabled={pending} onClick={() => setStartsAt(entry.startsAt)} className={cn("min-h-11 rounded-xl px-2 tabular-nums", entry.startsAt !== slot?.startsAt && "bg-card shadow-xs")}>{entry.label}</Button>)}
          </div>
        </div>
        <div className="sticky bottom-0 space-y-2 rounded-2xl border bg-card p-4 shadow-md">
          <p className="eyebrow">{copy.selected}</p>
          <p className="font-display text-base font-semibold tabular-nums" aria-live="polite">{slot?.when ?? "—"}</p>
          <Button type="button" onClick={confirm} disabled={!slot || pending} className="min-h-11 w-full">{pending ? copy.pending : copy.confirm}</Button>
        </div>
      </div>)}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </SheetContent>
  </Sheet>;
}
