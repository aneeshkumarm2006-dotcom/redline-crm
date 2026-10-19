"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { brandTheme } from "@/components/shared/app-shell/theme";
import { cn } from "@/lib/utils";
import { customerTemplateKeys, type CustomerTemplateKey } from "../schema";
import { sendLeadEmailAction } from "../actions";
import { coordinatorCopy as copy } from "../copy";

/** Pick a customer template and send it; the attempt is logged on the lead (Emails tab) and in the Email log. */
export function SendEmailControl({ leadId, name, email, hasAppointment, primaryColor }: {
  leadId: string; name: string; email: string; hasAppointment: boolean; primaryColor: string;
}) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<CustomerTemplateKey>("follow_up");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const available = (key: CustomerTemplateKey) => key !== "appointment_reminder" || hasAppointment;
  function send() {
    setError("");
    startTransition(async () => {
      const result = await sendLeadEmailAction({ id: leadId, templateKey: choice }).catch(() => ({ ok: false as const, message: copy.error }));
      if (!result.ok) { setError(result.message); toast.error(result.message); router.refresh(); return; }
      toast.success(copy.sent);
      setOpen(false);
      router.refresh();
    });
  }
  return <Sheet open={open} onOpenChange={(value) => { if (!pending) { setOpen(value); setError(""); } }}>
    <SheetTrigger asChild><Button variant="outline" className="min-h-12 justify-start gap-3 rounded-xl bg-card shadow-xs"><Send aria-hidden className="size-5" />{copy.sendEmail}</Button></SheetTrigger>
    <SheetContent side="bottom" showCloseButton={false} style={brandTheme(primaryColor)} className="max-h-[85dvh] gap-5 overflow-y-auto rounded-t-[1.25rem] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-lg sm:p-6">
      <SheetHeader className="p-0 pr-16"><SheetTitle className="text-lg font-semibold tracking-tight">{copy.sendEmailTitle}</SheetTitle><SheetDescription>{`${name} · ${email}`}</SheetDescription></SheetHeader>
      <SheetClose asChild><Button variant="ghost" disabled={pending} className="absolute right-2 top-2 min-h-11 min-w-11">{copy.close}</Button></SheetClose>
      <fieldset className="grid gap-2" disabled={pending}>
        <legend className="mb-2 text-sm text-muted-foreground">{copy.sendEmailHint}</legend>
        {customerTemplateKeys.map((key) => <label key={key} className={cn("flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border bg-card p-3.5 shadow-xs transition-[border-color,background-color,box-shadow] duration-150 hover:border-foreground/15 has-checked:border-primary has-checked:bg-brand-soft has-checked:ring-1 has-checked:ring-primary has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
          !available(key) && "cursor-not-allowed opacity-60")}>
          <input type="radio" name="template" value={key} checked={choice === key} disabled={!available(key)} onChange={() => setChoice(key)} className="mt-0.5 size-5 accent-primary" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{copy.templates[key].label}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{available(key) ? copy.templates[key].hint : copy.needsAppointment}</span>
          </span>
        </label>)}
      </fieldset>
      <Button type="button" onClick={send} disabled={pending || !available(choice)} className="min-h-11 w-full">{pending ? copy.sending : copy.send}</Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </SheetContent>
  </Sheet>;
}
