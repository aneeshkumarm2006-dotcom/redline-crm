"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose, SheetTrigger } from "@/components/ui/sheet";
import { StatusBadgeView } from "@/components/shared/status-badge-view";
import { brandTheme } from "@/components/shared/app-shell/theme";
import type { Settings } from "@/modules/settings/schema";
import type { InventoryVehicle } from "../schema";
import { changePriceAction, changeStatusAction } from "../actions";
import { inventoryCopy as copy, vehicleTitle } from "../copy";

export function VehicleControls({ vehicle, settings, price = false }: { vehicle: InventoryVehicle; settings: Settings; price?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  const title = price ? copy.editPrice : copy.changeStatus;
  function save(value: string) {
    setError("");
    startTransition(async () => {
      try {
        const ref = { id: vehicle.id, revision: vehicle.revision };
        const result = await (price ? changePriceAction({ ...ref, price: Number(value) }) : changeStatusAction({ ...ref, status: value }));
        if (!result.ok) { setError(result.message); router.refresh(); return; }
        if (result.warning) toast.warning(result.warning); else toast.success(price ? copy.priceSaved : copy.statusSaved);
        setOpen(false);
      } catch { setError(copy.networkError); }
    });
  }
  return <Sheet open={open} onOpenChange={(value) => { if (!pending) { setOpen(value); setError(""); } }}>
    <SheetTrigger asChild><Button variant="outline" className="min-h-11 min-w-11" aria-label={`${title}: ${vehicle.stockNo}`}>{price ? title : <StatusBadgeView kind="vehicle" status={vehicle.status} settings={settings} />}</Button></SheetTrigger>
    <SheetContent side="bottom" showCloseButton={false} style={brandTheme(settings.brand.primaryColor)} className="max-h-[85dvh] overflow-y-auto rounded-t-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-lg">
      <SheetHeader className="p-0 pr-12"><SheetTitle>{title}</SheetTitle><SheetDescription>{vehicleTitle(vehicle)} · {vehicle.stockNo}<br />{price ? copy.priceHint : copy.statusHint}</SheetDescription></SheetHeader>
      <SheetClose asChild><Button variant="ghost" disabled={pending} className="absolute right-2 top-2 min-h-11 min-w-11">{copy.close}</Button></SheetClose>
      {price ? <form onSubmit={(event) => { event.preventDefault(); save(String(new FormData(event.currentTarget).get("price"))); }} className="space-y-4">
        <label className="block space-y-2"><span className="text-sm font-medium">{copy.fields.price}</span><Input name="price" type="number" inputMode="decimal" min="0" max="100000000" step="0.01" required defaultValue={vehicle.price} className="min-h-11 text-base" disabled={pending} /></label>
        <Button type="submit" className="min-h-11 w-full" disabled={pending}>{pending ? copy.saving : copy.savePrice}</Button>
      </form> : <div className="grid gap-2">{settings.vehicleStatuses.map((status) => <Button key={status.key} variant="outline" className="min-h-14 justify-between whitespace-normal text-left" disabled={pending || status.key === vehicle.status} onClick={() => save(status.key)}>
        <StatusBadgeView kind="vehicle" status={status.key} settings={settings} />{status.key === vehicle.status && <span className="text-xs text-muted-foreground">{copy.current}</span>}
      </Button>)}</div>}
      {pending && <p role="status" className="text-sm">{copy.saving}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </SheetContent>
  </Sheet>;
}
