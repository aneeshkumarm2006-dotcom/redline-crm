"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MapPin, Phone, Plus, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { StatusPill } from "@/components/shared/status-pill";
import { brandTheme } from "@/components/shared/app-shell/theme";
import type { Garage } from "../schema";
import { saveGarageAction } from "../actions";
import { garagesCopy } from "../copy";

const copy = garagesCopy.admin;
type RepairType = { key: string; label: string; color: string };

/** Add or edit one garage in a bottom sheet: contact details, specialties (repair types) and whether it is offered. */
function GarageSheet({ garage, repairTypes, primaryColor }: { garage?: Garage; repairTypes: RepairType[]; primaryColor: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  function submit(form: FormData) {
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const data = { ...(garage ? { id: garage.id } : {}), name: text("name"), address: text("address"), phone: text("phone"),
      specialties: form.getAll("specialties").map(String), active: garage ? form.get("active") === "on" : true };
    setError("");
    startTransition(async () => {
      try {
        const result = await saveGarageAction(data);
        if (!result.ok) { setError(result.message); return; }
        toast.success(garage ? copy.saved : copy.created);
        setOpen(false);
        router.refresh();
      } catch { setError(copy.failed); }
    });
  }
  return <Sheet open={open} onOpenChange={(value) => { if (!pending) { setOpen(value); setError(""); } }}>
    <SheetTrigger asChild>{garage
      ? <Button variant="outline" className="min-h-11">{copy.edit}</Button>
      : <Button className="min-h-11 gap-2"><Plus aria-hidden className="size-4" />{copy.add}</Button>}</SheetTrigger>
    <SheetContent side="bottom" showCloseButton={false} style={brandTheme(primaryColor)} className="max-h-[90dvh] gap-5 overflow-y-auto rounded-t-[1.25rem] bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-lg sm:p-6">
      <SheetHeader className="gap-1 p-0"><SheetTitle className="font-display text-xl tracking-tight">{garage ? copy.editTitle : copy.addTitle}</SheetTitle><SheetDescription>{copy.hint}</SheetDescription></SheetHeader>
      <form action={submit} className="space-y-4">
        {([["name", copy.name, garage?.name, 120, "text"], ["address", copy.address, garage?.address, 500, "text"], ["phone", copy.phone, garage?.phone, 40, "tel"]] as const)
          .map(([name, label, value, max, type]) => <label key={name} className="block space-y-2"><span className="text-sm font-medium">{label}</span>
            <Input name={name} type={type} defaultValue={value} required maxLength={max} minLength={name === "phone" ? 7 : 1} className="min-h-11 text-base md:text-sm" /></label>)}
        <fieldset className="space-y-2"><legend className="text-sm font-medium">{copy.specialties}</legend>
          <div className="flex flex-wrap gap-2">{repairTypes.map((type) => <label key={type.key} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm font-medium transition-colors duration-150 hover:border-foreground/25 has-[:checked]:border-primary/40 has-[:checked]:bg-brand-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring">
            <input type="checkbox" name="specialties" value={type.key} defaultChecked={garage?.specialties.includes(type.key)} className="size-5 accent-primary" />{type.label}
          </label>)}</div>
        </fieldset>
        {garage && <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-input bg-card px-3 text-sm font-medium transition-colors duration-150 hover:border-foreground/25 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring">
          <input type="checkbox" name="active" defaultChecked={garage.active} className="size-5 accent-primary" />{copy.active}</label>}
        {error && <p role="alert" className="rounded-lg bg-danger/8 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="flex gap-2 pt-1">
          <SheetClose asChild><Button type="button" variant="outline" className="min-h-11 flex-1" disabled={pending}>{copy.cancel}</Button></SheetClose>
          <Button type="submit" className="min-h-11 flex-1" disabled={pending}>{pending ? copy.saving : copy.save}</Button>
        </div>
      </form>
    </SheetContent>
  </Sheet>;
}

export function GaragesAdmin({ garages, repairTypes, primaryColor }: { garages: Garage[]; repairTypes: RepairType[]; primaryColor: string }) {
  return <section aria-labelledby="garages-admin" className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><h2 id="garages-admin" className="text-lg font-semibold tracking-tight">{copy.title}</h2><p className="mt-0.5 max-w-prose text-sm text-muted-foreground">{copy.hint}</p></div>
      <GarageSheet repairTypes={repairTypes} primaryColor={primaryColor} />
    </div>
    {!garages.length ? <p className="flex items-center gap-3 rounded-2xl border border-dashed bg-card p-5 text-sm text-muted-foreground"><span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-primary"><Warehouse className="size-5" /></span>{copy.empty}</p>
      : <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{garages.map((garage) => <li key={garage.id} className="min-w-0 space-y-4 rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><p className="break-words text-[0.9375rem] font-semibold tracking-tight">{garage.name}{!garage.active && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 align-middle text-xs font-medium text-muted-foreground">{copy.inactive}</span>}</p>
            <p className="mt-2 flex gap-1.5 break-words text-sm text-muted-foreground"><MapPin aria-hidden className="mt-0.5 size-4 shrink-0" />{garage.address}</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground tabular-nums"><Phone aria-hidden className="size-4 shrink-0" />{garage.phone}</p></div>
          <GarageSheet garage={garage} repairTypes={repairTypes} primaryColor={primaryColor} />
        </div>
        {garage.specialties.length > 0 && <ul aria-label={copy.specialties} className="flex flex-wrap gap-1.5 border-t pt-4">{garage.specialties.map((key) => {
          const type = repairTypes.find((entry) => entry.key === key) ?? { key, label: key, color: "#94A3B8" };
          return <li key={key}><StatusPill option={type} /></li>;
        })}</ul>}
      </li>)}</ul>}
  </section>;
}
