"use client";
import { useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownField } from "@/components/ui/dropdown-field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { staffLeadFormSchema, type StaffLeadInput, type StaffLeadResult } from "../schema";
import { createStaffLeadAction } from "../actions";
import { leadsCopy as copy } from "../copy";

type Option = { id: string; label: string };
export type NewLeadVehicle = { id: string; label: string; dealershipId: string; dealershipName: string };

/**
 * Staff intake for phone, walk-in and referral customers. Owners pick a salesperson at the car's location
 * (or leave it to round-robin); salespeople keep the leads they enter. A request ID makes resubmits safe.
 */
export function NewLeadForm({ vehicles, sources, salespeople, owner }: {
  vehicles: NewLeadVehicle[]; sources: Option[]; salespeople: (Option & { dealershipId: string | null })[]; owner: boolean;
}) {
  const id = useId();
  const router = useRouter();
  const requestId = useRef<string | null>(null);
  const [vehicleId, setVehicleId] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Extract<StaffLeadResult, { ok: false }> | null>(null);
  const vehicle = vehicles.find((entry) => entry.id === vehicleId);
  const eligible = salespeople.filter((person) => vehicle && person.dealershipId === vehicle.dealershipId);
  const errors = result?.fields;
  const control = "min-h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-base shadow-xs transition-[border-color,box-shadow] duration-150 hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive";
  const panel = "min-w-0 rounded-2xl border bg-card p-5 shadow-xs sm:p-6";
  const legend = "float-left mb-5 w-full text-[0.9375rem] font-semibold tracking-tight";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    requestId.current ??= crypto.randomUUID();
    const parsed = staffLeadFormSchema.safeParse({
      name: fields.get("name"), email: fields.get("email"), phone: fields.get("phone"), message: fields.get("message") ?? "",
      vehicleId: fields.get("vehicleId"), source: fields.get("source"), assignedTo: owner ? (fields.get("assignedTo") || null) : null,
      contacted: fields.get("contacted") === "on", requestId: requestId.current,
    });
    if (!parsed.success) {
      setResult({ ok: false, message: copy.genericError, fields: Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])) as Partial<Record<keyof StaffLeadInput, string>> });
      // A dropdown's named input is hidden, so focus the visible control by its id (inputs carry the same id).
      const name = String(parsed.error.issues[0]?.path[0]);
      const field = document.getElementById(`${id}-${name}`) ?? form.elements.namedItem(name);
      if (field instanceof HTMLElement) field.focus();
      return;
    }
    setPending(true); setResult(null);
    try {
      const outcome = await createStaffLeadAction(parsed.data);
      if (!outcome.ok) { setResult(outcome); return; }
      if (outcome.warning) toast.warning(outcome.warning); else toast.success(copy.created);
      router.push(`/crm/leads/${outcome.id}`);
    } catch { setResult({ ok: false, message: copy.networkError }); }
    finally { setPending(false); }
  }

  const field = (name: keyof StaffLeadInput, label: string, input: React.ReactNode, wide = false) => <div className={cn("min-w-0 space-y-2", wide && "sm:col-span-2")}>
    <label htmlFor={`${id}-${name}`} className="text-sm font-medium">{label}</label>
    {input}
    {errors?.[name] && <p id={`${id}-${name}-error`} className="text-sm font-medium text-destructive">{errors[name]}</p>}
  </div>;
  const described = (name: keyof StaffLeadInput) => ({ id: `${id}-${name}`, name, "aria-invalid": Boolean(errors?.[name]), "aria-describedby": errors?.[name] ? `${id}-${name}-error` : undefined });

  if (!vehicles.length) return <p className="rounded-2xl border border-dashed bg-card p-6 text-sm text-muted-foreground">{copy.noVehicles}</p>;
  return <form onSubmit={submit} className="grid gap-4 sm:gap-5 xl:grid-cols-12" aria-busy={pending} noValidate>
    <fieldset disabled={pending} className={cn(panel, "xl:col-span-7")}>
      <legend className={legend}>{copy.customerSection}</legend>
      <div className="clear-both grid gap-4 sm:grid-cols-2">
        {field("name", copy.name, <Input {...described("name")} autoComplete="off" required maxLength={120} className="min-h-11 text-base" />, true)}
        {field("phone", copy.phone, <Input {...described("phone")} type="tel" autoComplete="off" required minLength={7} maxLength={40} className="min-h-11 text-base" />)}
        {field("email", copy.emailField, <Input {...described("email")} type="email" autoComplete="off" required maxLength={254} className="min-h-11 text-base" />)}
        {field("message", copy.note, <textarea {...described("message")} rows={4} maxLength={4000} className={cn(control, "py-2.5")} />, true)}
      </div>
    </fieldset>
    <fieldset disabled={pending} className={cn(panel, "xl:col-span-5")}>
      <legend className={legend}>{copy.leadSection}</legend>
      <div className="clear-both grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
        {field("vehicleId", copy.vehicleField, <DropdownField {...described("vehicleId")} required value={vehicleId} onValueChange={setVehicleId}
          options={[{ value: "", label: copy.chooseVehicle }, ...vehicles.map((entry) => ({ value: entry.id, label: `${entry.label}${owner ? ` · ${entry.dealershipName}` : ""}` }))]} />, true)}
        {field("source", copy.sourceField, <DropdownField {...described("source")} required defaultValue="" placeholder={copy.chooseSource}
          options={sources.map((entry) => ({ value: entry.id, label: entry.label }))} />)}
        {owner ? field("assignedTo", copy.assigneeField, <DropdownField {...described("assignedTo")} key={vehicle?.dealershipId ?? "none"} defaultValue="" disabled={!vehicle}
          options={[{ value: "", label: copy.autoAssign }, ...eligible.map((person) => ({ value: person.id, label: person.label }))]} />) : <div className="min-w-0 space-y-2"><p className="text-sm font-medium">{copy.assigneeField}</p><p className="flex min-h-11 items-center rounded-lg bg-muted px-3 text-sm text-muted-foreground">{copy.assigneeMine}</p></div>}
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border bg-muted/50 p-4 text-sm transition-colors hover:border-foreground/15 sm:col-span-2 xl:col-span-1">
          <input type="checkbox" name="contacted" className="mt-0.5 size-5 shrink-0 accent-primary" />
          <span><span className="block font-medium">{copy.contacted}</span><span className="mt-0.5 block text-xs text-muted-foreground">{copy.contactedHint}</span></span>
        </label>
      </div>
    </fieldset>
    <div className="space-y-3 xl:col-span-12">
      {result && <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">{result.message}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button asChild variant="ghost" className="min-h-11"><Link href="/crm/leads">{copy.cancel}</Link></Button>
        <Button type="submit" disabled={pending} className="min-h-11 sm:min-w-36">{pending ? copy.creating : copy.createLead}</Button>
      </div>
    </div>
  </form>;
}
