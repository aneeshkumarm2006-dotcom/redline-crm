"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, CarFront, CheckCircle2, Mail, Phone, RotateCcw, User, UserX, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { brandTheme } from "@/components/shared/app-shell/theme";
import { getRescheduleOptionsAction, rescheduleAppointmentAction, setAppointmentStatusAction } from "../actions";
import { appointmentActionCopy as copy, appointmentsCopy } from "../copy";
import type { DescribedAppointment } from "./appointments-screen";
import { SlotChooser } from "./slot-chooser";
import { statusTone } from "./calendar-tone";

type Options = NonNullable<Awaited<ReturnType<typeof getRescheduleOptionsAction>>>;
type Mode = "details" | "cancel" | "reschedule";

/**
 * Wraps an appointment chip in a button that opens its details: customer contact, vehicle and salesperson, plus
 * complete / no-show / cancel / reschedule (or restore). Every view renders its chips through this.
 */
export function AppointmentTrigger({ appointment, zone, primaryColor, className, style, children }: {
  appointment: DescribedAppointment; zone: string; primaryColor: string; className?: string; style?: React.CSSProperties; children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("details");
  const [options, setOptions] = useState<Options | "loading" | "error">("loading");
  const [loads, setLoads] = useState(0);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const when = new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: zone }).format(new Date(appointment.startsAt));
  const time = new Intl.DateTimeFormat("en-CA", { timeStyle: "short", timeZone: zone }).formatRange(new Date(appointment.startsAt), new Date(appointment.endsAt));
  const booked = appointment.status === "booked";

  function change(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (next) { setMode("details"); setError(""); }
  }
  function loadSlots() {
    setMode("reschedule"); setOptions("loading"); setError(""); setLoads((count) => count + 1);
    getRescheduleOptionsAction(appointment.id).then((result) => setOptions(result ?? "error"), () => setOptions("error"));
  }
  function run(action: () => Promise<{ ok: boolean; message: string }>, retry?: () => void) {
    setError("");
    startTransition(async () => {
      const result = await action().catch(() => ({ ok: false, message: copy.error }));
      if (!result.ok) { setError(result.message); toast.error(result.message); retry?.(); return; }
      toast.success(result.message);
      setOpen(false);
      router.refresh();
    });
  }
  const status = (next: string) => run(() => setAppointmentStatusAction({ id: appointment.id, status: next }));

  const row = (Icon: typeof User, label: string, value: React.ReactNode) => <div className="flex min-w-0 items-start gap-3">
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted"><Icon aria-hidden className="size-4" /></span>
    <span className="min-w-0"><span className="block text-xs text-muted-foreground">{label}</span><span className="block break-words text-sm font-medium">{value}</span></span>
  </div>;

  return <>
    <button type="button" onClick={() => change(true)} style={style} className={cn("text-left", className)} aria-haspopup="dialog">{children}</button>
    <Sheet open={open} onOpenChange={change}>
      <SheetContent showCloseButton={false} style={brandTheme(primaryColor)} className="w-full gap-5 overflow-y-auto p-5 sm:max-w-md sm:p-6">
        <SheetHeader className="p-0 pr-16">
          <p className="eyebrow">{mode === "reschedule" ? copy.rescheduleTitle : copy.details}</p>
          <SheetTitle className="text-xl font-semibold tracking-tight">{appointment.leadName}</SheetTitle>
          <SheetDescription className="tabular-nums">{when} · {time}</SheetDescription>
        </SheetHeader>
        <SheetClose asChild><Button variant="ghost" disabled={pending} className="absolute right-2 top-2 min-h-11 min-w-11">{copy.close}</Button></SheetClose>

        {mode === "reschedule" ? <div className="space-y-4">
          <Button variant="outline" className="min-h-10" disabled={pending} onClick={() => setMode("details")}>{copy.back}</Button>
          {options === "loading" && <p role="status" className="text-sm text-muted-foreground">{copy.loading}</p>}
          {options === "error" && <div className="space-y-3"><p role="alert" className="text-sm text-destructive">{copy.loadError}</p><Button variant="outline" className="min-h-11" onClick={loadSlots}>{copy.retry}</Button></div>}
          {typeof options === "object" && <>
            <p className="text-sm text-muted-foreground">{copy.rescheduleHint(options.salespersonName)}</p>
            <SlotChooser key={loads} days={options.days} zone={options.zone} pending={pending} confirmLabel={copy.moveHere} pendingLabel={copy.moving}
              onConfirm={(startsAt) => run(() => rescheduleAppointmentAction({ id: appointment.id, startsAt }), loadSlots)} />
          </>}
        </div> : <>
          <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", statusTone(appointment.status).chip)}>
            <span aria-hidden className={cn("size-2 rounded-full", statusTone(appointment.status).dot)} />{appointmentsCopy.status[appointment.status] ?? appointment.status}</span>
          <div className="space-y-3">
            {row(CalendarClock, copy.when, `${when}, ${time}`)}
            {row(CarFront, copy.vehicle, appointment.vehicleName)}
            {row(User, copy.salesperson, appointment.salespersonName)}
            {appointment.leadPhone && row(Phone, copy.phone, <a href={`tel:${appointment.leadPhone}`} className="underline-offset-4 hover:underline">{appointment.leadPhone}</a>)}
            {appointment.leadEmail && row(Mail, copy.email, <a href={`mailto:${appointment.leadEmail}`} className="underline-offset-4 hover:underline">{appointment.leadEmail}</a>)}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {appointment.leadVisible && <Button asChild variant="outline" className="col-span-2 min-h-11"><Link href={`/crm/leads/${appointment.leadId}`}>{copy.openLead}</Link></Button>}
            {appointment.leadPhone && <Button asChild variant="outline" className="min-h-11 gap-2"><a href={`tel:${appointment.leadPhone}`}><Phone aria-hidden className="size-4" />{copy.call}</a></Button>}
            {appointment.leadEmail && <Button asChild variant="outline" className="min-h-11 gap-2"><a href={`mailto:${appointment.leadEmail}`}><Mail aria-hidden className="size-4" />{copy.sendEmail}</a></Button>}
          </div>
          {mode === "cancel" ? <div role="alertdialog" aria-label={copy.confirmCancel} className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
            <p className="font-semibold">{copy.confirmCancel}</p>
            <p className="text-sm text-muted-foreground">{copy.confirmCancelHint}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" className="min-h-11" disabled={pending} onClick={() => status("cancelled")}>{pending ? copy.saving : copy.yesCancel}</Button>
              <Button variant="outline" className="min-h-11" disabled={pending} onClick={() => setMode("details")}>{copy.keep}</Button>
            </div>
          </div> : <div className="space-y-2 border-t pt-4">
            {booked ? <>
              <Button className="min-h-11 w-full gap-2" disabled={pending} onClick={() => status("completed")}><CheckCircle2 aria-hidden className="size-4" />{copy.complete}</Button>
              <Button variant="outline" className="min-h-11 w-full gap-2" disabled={pending} onClick={loadSlots}><CalendarClock aria-hidden className="size-4" />{copy.reschedule}</Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="min-h-11 gap-2" disabled={pending} onClick={() => status("no_show")}><UserX aria-hidden className="size-4" />{copy.noShow}</Button>
                <Button variant="outline" className="min-h-11 gap-2 text-destructive hover:text-destructive" disabled={pending} onClick={() => setMode("cancel")}><XCircle aria-hidden className="size-4" />{copy.cancel}</Button>
              </div>
            </> : <Button variant="outline" className="min-h-11 w-full gap-2" disabled={pending} onClick={() => status("booked")}><RotateCcw aria-hidden className="size-4" />{copy.restore}</Button>}
          </div>}
        </>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </SheetContent>
    </Sheet>
  </>;
}
