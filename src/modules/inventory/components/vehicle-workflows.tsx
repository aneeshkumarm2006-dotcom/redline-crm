"use client";
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose, SheetTrigger } from "@/components/ui/sheet";
import { brandTheme } from "@/components/shared/app-shell/theme";
import type { StatusDefinition } from "@/modules/settings/schema";
import { completeRepairAction, markSoldAction, sendToRepairAction } from "../actions";
import { inventoryCopy as copy, formatPrice } from "../copy";

type VehicleRef = { id: string; revision: number; stockNo: string; title: string };
type ActionResult = { ok: true; warning?: string } | { ok: false; message: string };
const controls = "min-h-11 w-full min-w-0 rounded-md border bg-background px-3 py-2 text-base";

/** Open state, pending/error handling and URL cleanup shared by the workflow sheets. */
function useWorkflow(defaultOpen: boolean) {
  const [open, setOpen] = useState(defaultOpen);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  // A sheet opened from the board (`?action=…`) drops the parameter when it closes, so a refresh does not reopen it.
  function change(next: boolean) {
    if (pending) return;
    setOpen(next);
    setError("");
    if (!next && defaultOpen) router.replace(pathname, { scroll: false });
  }
  function run(action: () => Promise<ActionResult>, success: string) {
    setError("");
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) { setError(result.message); router.refresh(); return; }
        if (result.warning) toast.warning(result.warning); else toast.success(success);
        setOpen(false);
        router.replace(pathname, { scroll: false });
      } catch { setError(copy.networkError); }
    });
  }
  return { open, change, pending, error, run };
}

function WorkflowSheet({ title, description, trigger, primaryColor, state, children }: {
  title: string; description: string; trigger: React.ReactNode; primaryColor: string; state: ReturnType<typeof useWorkflow>; children: React.ReactNode;
}) {
  return <Sheet open={state.open} onOpenChange={state.change}>
    <SheetTrigger asChild>{trigger}</SheetTrigger>
    <SheetContent side="bottom" showCloseButton={false} style={brandTheme(primaryColor)} className="max-h-[90dvh] overflow-y-auto rounded-t-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-lg">
      <SheetHeader className="p-0 pr-16"><SheetTitle>{title}</SheetTitle><SheetDescription>{description}</SheetDescription></SheetHeader>
      <SheetClose asChild><Button variant="ghost" disabled={state.pending} className="absolute right-2 top-2 min-h-11 min-w-11">{copy.close}</Button></SheetClose>
      {children}
      {state.pending && <p role="status" className="text-sm">{copy.saving}</p>}
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    </SheetContent>
  </Sheet>;
}

const optionalMoney = (value: FormDataEntryValue | null) => value === null || value === "" ? null : Number(value);

export function SendToRepairSheet({ vehicle, repairTypes, garages, primaryColor, defaultOpen = false }: {
  vehicle: VehicleRef; repairTypes: StatusDefinition[]; garages: { id: string; name: string; specialties: string[] }[]; primaryColor: string; defaultOpen?: boolean;
}) {
  const state = useWorkflow(defaultOpen);
  const [typeKey, setTypeKey] = useState("");
  // Garages that specialise in the chosen repair type come first.
  const ordered = typeKey ? garages.toSorted((a, b) => Number(b.specialties.includes(typeKey)) - Number(a.specialties.includes(typeKey))) : garages;
  return <WorkflowSheet title={copy.sendToRepair} description={`${vehicle.title} · ${vehicle.stockNo}. ${copy.sendToRepairHint}`} primaryColor={primaryColor} state={state}
    trigger={<Button variant="outline" className="min-h-11">{copy.sendToRepair}</Button>}>
    <form className="space-y-4" onSubmit={(event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      state.run(() => sendToRepairAction({ id: vehicle.id, revision: vehicle.revision, typeKey: String(form.get("typeKey")), garageId: String(form.get("garageId")),
        estimatedCost: optionalMoney(form.get("estimatedCost")), notes: String(form.get("notes") ?? "") }), copy.repairSaved);
    }}>
      <fieldset disabled={state.pending} className="space-y-4">
        <label className="block space-y-2"><span className="text-sm font-medium">{copy.workflowFields.repairType}</span>
          <select name="typeKey" required value={typeKey} onChange={(event) => setTypeKey(event.target.value)} className={controls}>
            <option value="" disabled>{copy.chooseOne}</option>{repairTypes.map((type) => <option key={type.key} value={type.key}>{type.label}</option>)}
          </select></label>
        <label className="block space-y-2"><span className="text-sm font-medium">{copy.workflowFields.garage}</span>
          <select name="garageId" required defaultValue="" className={controls}>
            <option value="" disabled>{copy.chooseOne}</option>
            {ordered.map((garage) => <option key={garage.id} value={garage.id}>{garage.name}{typeKey && garage.specialties.includes(typeKey) ? ` (${copy.specialist})` : ""}</option>)}
          </select></label>
        <label className="block space-y-2"><span className="text-sm font-medium">{copy.workflowFields.estimatedCost}</span>
          <Input name="estimatedCost" type="number" inputMode="decimal" min="0" max="100000000" step="0.01" className="min-h-11 text-base" /></label>
        <label className="block space-y-2"><span className="text-sm font-medium">{copy.workflowFields.notes}</span>
          <textarea name="notes" rows={3} maxLength={2000} className={controls} /></label>
        <Button type="submit" className="min-h-11 w-full">{state.pending ? copy.saving : copy.sendToRepair}</Button>
      </fieldset>
    </form>
  </WorkflowSheet>;
}

export function CompleteRepairSheet({ vehicle, estimatedCost, primaryColor, defaultOpen = false }: {
  vehicle: VehicleRef; estimatedCost: number | null; primaryColor: string; defaultOpen?: boolean;
}) {
  const state = useWorkflow(defaultOpen);
  return <WorkflowSheet title={copy.completeRepair} description={`${vehicle.title} · ${vehicle.stockNo}. ${copy.completeRepairHint}`} primaryColor={primaryColor} state={state}
    trigger={<Button className="min-h-11">{copy.completeRepair}</Button>}>
    <form className="space-y-4" onSubmit={(event) => {
      event.preventDefault();
      const cost = Number(new FormData(event.currentTarget).get("cost"));
      state.run(() => completeRepairAction({ id: vehicle.id, revision: vehicle.revision, cost }), copy.repairCompleted);
    }}>
      <fieldset disabled={state.pending} className="space-y-4">
        <label className="block space-y-2"><span className="text-sm font-medium">{copy.workflowFields.finalCost}</span>
          <Input name="cost" type="number" inputMode="decimal" min="0" max="100000000" step="0.01" required defaultValue={estimatedCost ?? ""} className="min-h-11 text-base" /></label>
        <Button type="submit" className="min-h-11 w-full">{state.pending ? copy.saving : copy.completeRepair}</Button>
      </fieldset>
    </form>
  </WorkflowSheet>;
}

export function MarkSoldSheet({ vehicle, price, commission, salespeople, leads, primaryColor, defaultOpen = false }: {
  vehicle: VehicleRef; price: number; commission: number; salespeople: { id: string; name: string }[];
  leads: { id: string; name: string; stageLabel: string; assignedTo: string | null }[]; primaryColor: string; defaultOpen?: boolean;
}) {
  const state = useWorkflow(defaultOpen);
  const [salespersonId, setSalespersonId] = useState("");
  return <WorkflowSheet title={copy.markSold} description={`${vehicle.title} · ${vehicle.stockNo}. ${copy.markSoldHint}`} primaryColor={primaryColor} state={state}
    trigger={<Button variant="outline" className="min-h-11">{copy.markSold}</Button>}>
    {!salespeople.length ? <p className="text-sm text-muted-foreground">{copy.noSalespeople}</p> : <form className="space-y-4" onSubmit={(event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      state.run(() => markSoldAction({ id: vehicle.id, revision: vehicle.revision, salespersonId, leadId: String(form.get("leadId") ?? "") || null,
        price: Number(form.get("price")) }), copy.saleSaved);
    }}>
      <fieldset disabled={state.pending} className="space-y-4">
        {leads.length > 0 && <label className="block space-y-2"><span className="text-sm font-medium">{copy.workflowFields.lead}</span>
          {/* Picking the customer's lead preselects the salesperson working it. */}
          <select name="leadId" defaultValue="" className={controls} onChange={(event) => {
            const assignee = leads.find((lead) => lead.id === event.target.value)?.assignedTo;
            if (assignee && salespeople.some((person) => person.id === assignee)) setSalespersonId(assignee);
          }}>
            <option value="">{copy.workflowFields.noLead}</option>
            {leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name} · {lead.stageLabel}</option>)}
          </select></label>}
        <label className="block space-y-2"><span className="text-sm font-medium">{copy.workflowFields.salesperson}</span>
          <select name="salespersonId" required value={salespersonId} onChange={(event) => setSalespersonId(event.target.value)} className={controls}>
            <option value="" disabled>{copy.chooseOne}</option>{salespeople.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select></label>
        <label className="block space-y-2"><span className="text-sm font-medium">{copy.workflowFields.salePrice}</span>
          <Input name="price" type="number" inputMode="decimal" min="0" max="100000000" step="0.01" required defaultValue={price} className="min-h-11 text-base" /></label>
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm">{copy.commissionSnapshot(formatPrice(commission))}</p>
        <Button type="submit" className="min-h-11 w-full">{state.pending ? copy.saving : copy.markSold}</Button>
      </fieldset>
    </form>}
  </WorkflowSheet>;
}

/** Live time in repair. Starts from the server's clock so the first render matches, then ticks on the client. */
export function RepairTimer({ startedAt, serverNow, className }: { startedAt: string; serverNow: number; className?: string }) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const elapsed = Math.max(0, now - Date.parse(startedAt));
  const days = Math.floor(elapsed / 86_400_000);
  const hours = Math.floor((elapsed % 86_400_000) / 3_600_000);
  return <time dateTime={`PT${Math.floor(elapsed / 60_000)}M`} className={className}>{copy.elapsed(days, hours)}</time>;
}
