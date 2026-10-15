"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  const controls = "min-h-11 w-full min-w-0 rounded-md border bg-background px-3 py-2 text-base";
  return <form className="space-y-6 rounded-2xl border bg-card p-4 sm:p-6" onSubmit={(event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data = Object.fromEntries(form);
    const parsed = vehicleFormSchema.safeParse({ ...data, year: Number(data.year), mileage: Number(data.mileage), price: Number(data.price),
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
    <fieldset disabled={pending} className="grid min-w-0 gap-5 sm:grid-cols-2">
      {(["stockNo", "vin", "year", "make", "model", "trim", "mileage", "price", "dateInStock"] as const).map((field) => {
        const numeric = ["year", "mileage", "price"].includes(field);
        return <label key={field} className="min-w-0 space-y-2"><span className="text-sm font-medium">{copy.fields[field]}</span>
          <Input name={field} type={field === "dateInStock" ? "date" : numeric ? "number" : "text"} required={field !== "trim"}
            defaultValue={field === "dateInStock" ? vehicle?.dateInStock.slice(0, 10) ?? today : vehicle?.[field] ?? ""}
            min={field === "year" ? 1886 : numeric ? 0 : undefined} max={field === "year" ? 2100 : field === "mileage" ? 10000000 : field === "price" ? 100000000 : undefined}
            step={field === "price" ? "0.01" : numeric ? "1" : undefined} maxLength={field === "vin" ? 17 : field === "stockNo" ? 40 : 120}
            className="min-h-11 text-base" aria-invalid={!!fields[field]} aria-describedby={fields[field] ? `error-${field}` : undefined} />
          {fields[field] && <span id={`error-${field}`} className="block text-sm text-destructive">{fields[field]}</span>}
        </label>;
      })}
      <label className="min-w-0 space-y-2"><span className="text-sm font-medium">{copy.dealership}</span><select aria-label={copy.dealership} name="dealershipId" required className={controls} defaultValue={vehicle?.dealershipId ?? ""}>
        <option value="" disabled>{copy.dealership}</option>{dealerships.filter((item) => item.active || item.id === vehicle?.dealershipId).map((item) => <option key={item.id} value={item.id}>{item.name}{!item.active ? ` (${copy.inactive})` : ""}</option>)}
      </select>{fields.dealershipId && <span className="text-sm text-destructive">{fields.dealershipId}</span>}</label>
      <label className="min-w-0 space-y-2"><span className="text-sm font-medium">{copy.status}</span><select aria-label={copy.status} name="status" required className={controls} defaultValue={vehicle?.status ?? settings.vehicleStatuses[0]?.key}>
        {vehicle && !settings.vehicleStatuses.some((item) => item.key === vehicle.status) && <option value={vehicle.status}>{vehicle.status}</option>}
        {settings.vehicleStatuses.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
      </select>{fields.status && <span className="text-sm text-destructive">{fields.status}</span>}</label>
      <label className="min-w-0 space-y-2 sm:col-span-2"><span className="text-sm font-medium">{copy.fields.photos}</span><textarea name="photos" rows={4} maxLength={102400} defaultValue={vehicle?.photos.join("\n") ?? ""} className={controls} aria-invalid={!!fields.photos} aria-describedby={fields.photos ? "error-photos" : undefined} />{fields.photos && <span id="error-photos" className="block text-sm text-destructive">{fields.photos}</span>}</label>
    </fieldset>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap gap-3"><Button className="min-h-11" type="submit" disabled={pending}>{pending ? copy.saving : copy.save}</Button><Button variant="outline" className="min-h-11" asChild><Link href={back}>{copy.cancel}</Link></Button></div>
  </form>;
}
