"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DropdownField } from "@/components/ui/dropdown-field";
import { cn } from "@/lib/utils";
import type { Dealership } from "@/modules/dealerships/schema";
import type { Settings } from "@/modules/settings/schema";
import { vehicleFormSchema, type InventoryVehicle } from "../schema";
import { createVehicleAction, updateVehicleAction } from "../actions";
import { inventoryCopy as copy } from "../copy";

export function VehicleForm({ vehicle, dealerships, settings, today }: { vehicle?: InventoryVehicle; dealerships: Dealership[]; settings: Settings; today: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const router = useRouter();
  const back = vehicle ? `/crm/inventory/${vehicle.id}` : "/crm/inventory";
  const controls = "min-h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 py-2 text-base shadow-xs outline-none transition-[border-color,box-shadow] duration-150 hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm";
  const panel = "min-w-0 rounded-2xl border bg-card p-5 shadow-xs sm:p-6";
  const heading = "text-[0.9375rem] font-semibold tracking-tight";
  const input = (field: "stockNo" | "vin" | "year" | "make" | "model" | "trim" | "mileage" | "price" | "acquisitionCost" | "commission" | "dateInStock") => {
    const money = ["price", "acquisitionCost", "commission"].includes(field);
    const numeric = money || ["year", "mileage"].includes(field);
    return <label key={field} className="min-w-0 space-y-2"><span className="text-sm font-medium">{copy.fields[field]}</span>
      <Input name={field} type={field === "dateInStock" ? "date" : numeric ? "number" : "text"} required={!["trim", "acquisitionCost", "commission"].includes(field)}
        defaultValue={field === "dateInStock" ? vehicle?.dateInStock.slice(0, 10) ?? today : vehicle?.[field] ?? ""}
        min={field === "year" ? 1886 : numeric ? 0 : undefined} max={field === "year" ? 2100 : field === "mileage" ? 10000000 : money ? 100000000 : undefined}
        step={money ? "0.01" : numeric ? "1" : undefined} maxLength={field === "vin" ? 17 : field === "stockNo" ? 40 : 120}
        className={cn("min-h-11 text-base md:text-sm", (field === "vin" || field === "stockNo") && "font-mono", money && "tabular-nums")} aria-invalid={!!fields[field]} aria-describedby={fields[field] ? `error-${field}` : undefined} />
      {field === "acquisitionCost" && <span className="block text-xs text-muted-foreground">{copy.costHint}</span>}
      {fields[field] && <span id={`error-${field}`} className="block text-sm text-destructive">{fields[field]}</span>}
    </label>;
  };
  return <form className="grid gap-5 xl:grid-cols-12" onSubmit={(event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data = Object.fromEntries(form);
    // Blank cost/commission keep the stored value (or the default for a new car).
    const optional = (value: FormDataEntryValue | undefined) => value === undefined || value === "" ? undefined : Number(value);
    const parsed = vehicleFormSchema.safeParse({ ...data, year: Number(data.year), mileage: Number(data.mileage), price: Number(data.price),
      acquisitionCost: optional(data.acquisitionCost), commission: optional(data.commission),
      dateInStock: `${data.dateInStock}T00:00:00.000Z`, photos: String(data.photos).split(/\r?\n/).map((url) => url.trim()).filter(Boolean) });
    setFields({}); setError("");
    if (!parsed.success) {
      setFields(Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message]))); setError(copy.invalidForm); return;
    }
    startTransition(async () => {
      try {
        const result = vehicle ? await updateVehicleAction({ id: vehicle.id, revision: vehicle.revision, data: parsed.data }) : await createVehicleAction(parsed.data);
        if (!result.ok) { setError(result.message); return; }
        if (result.warning) toast.warning(result.warning); else toast.success(copy.saved);
        router.push(`/crm/inventory/${result.id}`);
      } catch { setError(copy.networkError); }
    });
  }}>
    <section aria-labelledby="vehicle-form-details" className={cn(panel, "xl:col-span-8")}>
      <h2 id="vehicle-form-details" className={heading}>{copy.details}</h2>
      <fieldset disabled={pending} className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
        {(["stockNo", "vin", "year", "make", "model", "trim", "mileage", "dateInStock"] as const).map(input)}
        <label className="min-w-0 space-y-2"><span className="text-sm font-medium">{copy.dealership}</span><DropdownField label={copy.dealership} name="dealershipId" required defaultValue={vehicle?.dealershipId ?? ""} placeholder={copy.dealership}
          options={dealerships.filter((item) => item.active || item.id === vehicle?.dealershipId).map((item) => ({ value: item.id, label: `${item.name}${!item.active ? ` (${copy.inactive})` : ""}` }))} />{fields.dealershipId && <span className="text-sm text-destructive">{fields.dealershipId}</span>}</label>
        <label className="min-w-0 space-y-2"><span className="text-sm font-medium">{copy.status}</span><DropdownField label={copy.status} name="status" required defaultValue={vehicle?.status ?? settings.vehicleStatuses[0]?.key}
          options={[...(vehicle && !settings.vehicleStatuses.some((item) => item.key === vehicle.status) ? [{ value: vehicle.status, label: vehicle.status }] : []),
            ...settings.vehicleStatuses.map((item) => ({ value: item.key, label: item.label }))]} />{fields.status && <span className="text-sm text-destructive">{fields.status}</span>}</label>
      </fieldset>
    </section>
    <section aria-labelledby="vehicle-form-pricing" className={cn(panel, "xl:col-span-4 xl:row-span-2 xl:self-start")}>
      <h2 id="vehicle-form-pricing" className={heading}>{copy.pricing}</h2>
      <fieldset disabled={pending} className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-1">
        {(["price", "acquisitionCost", "commission"] as const).map(input)}
      </fieldset>
    </section>
    <section aria-labelledby="vehicle-form-photos" className={cn(panel, "xl:col-span-8")}>
      <h2 id="vehicle-form-photos" className={heading}>{copy.photos}</h2>
      <fieldset disabled={pending} className="mt-4 min-w-0">
        <label className="block min-w-0 space-y-2"><span className="text-sm font-medium">{copy.fields.photos}</span><textarea name="photos" rows={4} maxLength={102400} defaultValue={vehicle?.photos.join("\n") ?? ""} className={cn(controls, "font-mono leading-6 md:text-[0.8125rem]")} aria-invalid={!!fields.photos} aria-describedby={fields.photos ? "error-photos" : undefined} />{fields.photos && <span id="error-photos" className="block text-sm text-destructive">{fields.photos}</span>}</label>
      </fieldset>
    </section>
    <div className="flex flex-wrap items-center gap-3 xl:col-span-12">
      {error && <p role="alert" className="w-full text-sm text-destructive">{error}</p>}
      <Button className="min-h-11 px-5" type="submit" disabled={pending}>{pending ? copy.saving : copy.save}</Button><Button variant="ghost" className="min-h-11" asChild><Link href={back}>{copy.cancel}</Link></Button>
    </div>
  </form>;
}
