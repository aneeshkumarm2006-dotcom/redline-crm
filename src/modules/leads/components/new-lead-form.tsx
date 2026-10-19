"use client";
import { useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const control = "min-h-11 w-full min-w-0 rounded-md border bg-background px-3 text-base";

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
      const field = form.elements.namedItem(String(parsed.error.issues[0]?.path[0]));
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

  const field = (name: keyof StaffLeadInput, label: string, input: React.ReactNode) => <div className="min-w-0 space-y-2">
    <label htmlFor={`${id}-${name}`} className="text-sm font-medium">{label}</label>
    {input}
    {errors?.[name] && <p id={`${id}-${name}-error`} className="text-sm text-destructive">{errors[name]}</p>}
  </div>;
  const described = (name: keyof StaffLeadInput) => ({ id: `${id}-${name}`, name, "aria-invalid": Boolean(errors?.[name]), "aria-describedby": errors?.[name] ? `${id}-${name}-error` : undefined });

  if (!vehicles.length) return <p className="rounded-xl border border-dashed bg-card p-5 text-sm text-muted-foreground">{copy.noVehicles}</p>;
  return <form onSubmit={submit} className="space-y-5" aria-busy={pending} noValidate>
    <fieldset disabled={pending} className="min-w-0 space-y-4 rounded-xl border bg-card p-5">
      <legend className="px-1 text-lg font-semibold">{copy.customerSection}</legend>
      {field("name", copy.name, <Input {...described("name")} autoComplete="off" required maxLength={120} className="min-h-11 text-base" />)}
      <div className="grid gap-4 sm:grid-cols-2">
        {field("phone", copy.phone, <Input {...described("phone")} type="tel" autoComplete="off" required minLength={7} maxLength={40} className="min-h-11 text-base" />)}
        {field("email", copy.emailField, <Input {...described("email")} type="email" autoComplete="off" required maxLength={254} className="min-h-11 text-base" />)}
      </div>
      {field("message", copy.note, <textarea {...described("message")} rows={3} maxLength={4000} className="w-full min-w-0 rounded-md border bg-background px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-ring" />)}
    </fieldset>
    <fieldset disabled={pending} className="min-w-0 space-y-4 rounded-xl border bg-card p-5">
      <legend className="px-1 text-lg font-semibold">{copy.leadSection}</legend>
      {field("vehicleId", copy.vehicleField, <select {...described("vehicleId")} required value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} className={control}>
        <option value="">{copy.chooseVehicle}</option>
        {vehicles.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}{owner ? ` · ${entry.dealershipName}` : ""}</option>)}
      </select>)}
      {field("source", copy.sourceField, <select {...described("source")} required defaultValue="" className={control}>
        <option value="" disabled>{copy.chooseSource}</option>
        {sources.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
      </select>)}
      {owner ? field("assignedTo", copy.assigneeField, <select {...described("assignedTo")} key={vehicle?.dealershipId ?? "none"} defaultValue="" disabled={!vehicle} className={control}>
        <option value="">{copy.autoAssign}</option>
        {eligible.map((person) => <option key={person.id} value={person.id}>{person.label}</option>)}
      </select>) : <p className="text-sm"><span className="font-medium">{copy.assigneeField}: </span><span className="text-muted-foreground">{copy.assigneeMine}</span></p>}
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="contacted" className="mt-0.5 size-5 shrink-0 accent-primary" />
        <span><span className="block font-medium">{copy.contacted}</span><span className="block text-xs text-muted-foreground">{copy.contactedHint}</span></span>
      </label>
    </fieldset>
    {result && <p role="alert" className="text-sm text-destructive">{result.message}</p>}
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button asChild variant="ghost" className="min-h-11"><Link href="/crm/leads">{copy.cancel}</Link></Button>
      <Button type="submit" disabled={pending} className="min-h-11">{pending ? copy.creating : copy.createLead}</Button>
    </div>
  </form>;
}
