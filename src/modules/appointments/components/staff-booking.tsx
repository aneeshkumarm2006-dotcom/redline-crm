"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { brandTheme } from "@/components/shared/app-shell/theme";
import type { StaffBookingOptions } from "../service";
import { bookForLeadAction, getStaffBookingOptionsAction } from "../actions";
import { staffBookingCopy as copy } from "../copy";
import { SlotChooser } from "./slot-chooser";

type Loaded = StaffBookingOptions | "loading" | "error";

/** Loads a lead's free times and books one; `onBooked` runs after a successful booking. Shared by the lead screen and the calendar. */
export function useStaffBooking(onBooked: () => void) {
  const router = useRouter();
  const [options, setOptions] = useState<Loaded>("loading");
  const [loads, setLoads] = useState(0);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  function load(leadId: string) {
    setOptions("loading"); setError(""); setLoads((count) => count + 1);
    getStaffBookingOptionsAction(leadId).then((result) => setOptions(result ?? "error"), () => setOptions("error"));
  }
  function confirm(leadId: string, startsAt: string) {
    setError("");
    startTransition(async () => {
      const result = await bookForLeadAction({ leadId, startsAt }).catch(() => ({ ok: false as const, message: copy.error }));
      if (!result.ok) { setError(result.message); toast.error(result.message); load(leadId); return; }
      if (result.warning) toast.warning(result.warning); else toast.success(copy.booked(result.when));
      onBooked();
      router.refresh();
    });
  }
  return { options, loads, error, pending, load, confirm };
}

/** The loaded booking state for one lead: existing booking, unassigned, or the slot chooser. */
export function StaffBookingBody({ leadId, booking }: { leadId: string; booking: ReturnType<typeof useStaffBooking> }) {
  const { options, loads, error, pending, load, confirm } = booking;
  return <>
    {options === "loading" && <p role="status" className="text-sm text-muted-foreground">{copy.loading}</p>}
    {options === "error" && <div className="space-y-3"><p role="alert" className="text-sm text-destructive">{copy.loadError}</p><Button variant="outline" className="min-h-11" onClick={() => load(leadId)}>{copy.retry}</Button></div>}
    {typeof options === "object" && options.state === "booked" && <p className="text-sm">{copy.existing(options.when)}</p>}
    {typeof options === "object" && options.state === "unassigned" && <p className="text-sm text-muted-foreground">{copy.unassigned}</p>}
    {typeof options === "object" && options.state === "open" && <SlotChooser key={loads} days={options.days} zone={options.zone} pending={pending} onConfirm={(startsAt) => confirm(leadId, startsAt)} />}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </>;
}

/**
 * Staff books a visit for the customer (on the phone, at the desk). Free times for the lead's salesperson load
 * when the sheet opens; the server re-checks the slot, so a stale list only costs a retry.
 */
export function StaffBookingControl({ leadId, name, primaryColor }: { leadId: string; name: string; primaryColor: string }) {
  const [open, setOpen] = useState(false);
  const booking = useStaffBooking(() => setOpen(false));
  function change(next: boolean) {
    if (booking.pending) return;
    setOpen(next);
    if (next) booking.load(leadId);
  }
  const options = booking.options;
  return <Sheet open={open} onOpenChange={change}>
    <SheetTrigger asChild><Button variant="outline" className="min-h-12 justify-start gap-3 rounded-xl bg-card shadow-xs"><CalendarPlus aria-hidden className="size-5" />{copy.book}</Button></SheetTrigger>
    <SheetContent side="bottom" showCloseButton={false} style={brandTheme(primaryColor)} className="max-h-[90dvh] gap-5 overflow-y-auto rounded-t-[1.25rem] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-lg sm:p-6">
      <SheetHeader className="p-0 pr-16">
        <SheetTitle className="text-lg font-semibold tracking-tight">{copy.title}</SheetTitle>
        <SheetDescription>{typeof options === "object" && options.state === "open" ? `${name} · ${copy.hint(options.salespersonName)}` : name}</SheetDescription>
      </SheetHeader>
      <SheetClose asChild><Button variant="ghost" disabled={booking.pending} className="absolute right-2 top-2 min-h-11 min-w-11">{copy.close}</Button></SheetClose>
      <StaffBookingBody leadId={leadId} booking={booking} />
    </SheetContent>
  </Sheet>;
}
