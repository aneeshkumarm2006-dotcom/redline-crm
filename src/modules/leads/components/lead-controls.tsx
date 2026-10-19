"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose, SheetTrigger } from "@/components/ui/sheet";
import { StatusBadgeView } from "@/components/shared/status-badge-view";
import { brandTheme } from "@/components/shared/app-shell/theme";
import type { Settings } from "@/modules/settings/schema";
import type { LeadActionResult } from "../schema";
import { addLeadNoteAction, changeLeadStageAction, logLeadCallAction, reassignLeadAction } from "../actions";
import { leadsCopy as copy } from "../copy";

type LeadRef = { id: string; name: string; stage: string; assignedTo: string | null };

/** Runs a lead action with shared pending/error/toast handling. */
export function useLeadAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  function run(action: () => Promise<LeadActionResult>, success: string, done?: () => void) {
    setError("");
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) { setError(result.message); toast.error(result.message); router.refresh(); return; }
        if (result.warning) toast.warning(result.warning); else toast.success(success);
        done?.();
        router.refresh();
      } catch { setError(copy.networkError); toast.error(copy.networkError); }
    });
  }
  return { pending, error, setError, run };
}

/** Bottom sheet shared by the lead controls (stage, reassign, log call). */
export function ControlSheet({ title, description, trigger, primaryColor, open, setOpen, pending, error, children }: {
  title: string; description: string; trigger: React.ReactNode; primaryColor: string; open: boolean; setOpen: (open: boolean) => void;
  pending: boolean; error: string; children: React.ReactNode;
}) {
  return <Sheet open={open} onOpenChange={(value) => { if (!pending) setOpen(value); }}>
    <SheetTrigger asChild>{trigger}</SheetTrigger>
    <SheetContent side="bottom" showCloseButton={false} style={brandTheme(primaryColor)} className="max-h-[85dvh] overflow-y-auto rounded-t-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-lg">
      <SheetHeader className="p-0 pr-16"><SheetTitle>{title}</SheetTitle><SheetDescription>{description}</SheetDescription></SheetHeader>
      <SheetClose asChild><Button variant="ghost" disabled={pending} className="absolute right-2 top-2 min-h-11 min-w-11">{copy.close}</Button></SheetClose>
      {children}
      {pending && <p role="status" className="text-sm">{copy.saving}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </SheetContent>
  </Sheet>;
}

/** Stage buttons in settings order; tapping one saves immediately with the stage the user saw as the conflict check. */
export function StageOptions({ lead, settings, pending, onChoose }: {
  lead: LeadRef; settings: Pick<Settings, "leadStages" | "vehicleStatuses">; pending: boolean; onChoose: (stage: string) => void;
}) {
  const stages = [...settings.leadStages].sort((a, b) => a.order - b.order);
  return <div className="grid gap-2">{stages.map((stage) => <Button key={stage.key} variant="outline" className="min-h-14 justify-between whitespace-normal text-left"
    disabled={pending || stage.key === lead.stage} onClick={() => onChoose(stage.key)}>
    <StatusBadgeView kind="lead" status={stage.key} settings={settings} />{stage.key === lead.stage && <span className="text-xs text-muted-foreground">{copy.current}</span>}
  </Button>)}</div>;
}

export function StageControl({ lead, settings }: { lead: LeadRef; settings: Settings }) {
  const [open, setOpen] = useState(false);
  const { pending, error, setError, run } = useLeadAction();
  return <ControlSheet title={copy.changeStage} description={`${lead.name} · ${copy.stageHint}`} primaryColor={settings.brand.primaryColor}
    open={open} setOpen={(value) => { setOpen(value); setError(""); }} pending={pending} error={error}
    trigger={<Button variant="outline" className="min-h-11 justify-between gap-3" aria-label={`${copy.changeStage}: ${lead.name}`}>
      <StatusBadgeView kind="lead" status={lead.stage} settings={settings} /><span className="text-sm">{copy.changeStage}</span>
    </Button>}>
    <StageOptions lead={lead} settings={settings} pending={pending}
      onChoose={(stage) => run(() => changeLeadStageAction({ id: lead.id, from: lead.stage, stage }), copy.stageSaved, () => setOpen(false))} />
  </ControlSheet>;
}

export function ReassignControl({ lead, salespeople, primaryColor, label = copy.reassign }: {
  lead: LeadRef; salespeople: { id: string; name: string }[]; primaryColor: string; label?: string;
}) {
  const [open, setOpen] = useState(false);
  const { pending, error, setError, run } = useLeadAction();
  return <ControlSheet title={label} description={`${lead.name} · ${copy.reassignHint}`} primaryColor={primaryColor}
    open={open} setOpen={(value) => { setOpen(value); setError(""); }} pending={pending} error={error}
    trigger={<Button variant="outline" className="min-h-11" aria-label={`${label}: ${lead.name}`}>{label}</Button>}>
    {!salespeople.length ? <p className="text-sm text-muted-foreground">{copy.noSalespeople}</p> : <div className="grid gap-2">{salespeople.map((person) =>
      <Button key={person.id} variant="outline" className="min-h-14 justify-between whitespace-normal text-left" disabled={pending || person.id === lead.assignedTo}
        onClick={() => run(() => reassignLeadAction({ id: lead.id, from: lead.assignedTo, salespersonId: person.id }), copy.assigneeSaved, () => setOpen(false))}>
        <span className="font-medium">{person.name}</span>{person.id === lead.assignedTo && <span className="text-xs text-muted-foreground">{copy.current}</span>}
      </Button>)}</div>}
  </ControlSheet>;
}

/**
 * Log call: an optional note, and (for a lead still in the first stage) a ticked "Move to <next stage>".
 * The first call or email sets the lead's first-contact time.
 */
export function LogCallControl({ lead, nextStage, primaryColor, compact = false }: {
  lead: LeadRef; nextStage: { key: string; label: string } | null; primaryColor: string; compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [advance, setAdvance] = useState(true);
  const { pending, error, setError, run } = useLeadAction();
  return <ControlSheet title={copy.logCall} description={`${lead.name} · ${copy.logCallHint}`} primaryColor={primaryColor}
    open={open} setOpen={(value) => { setOpen(value); setError(""); }} pending={pending} error={error}
    trigger={<Button variant="outline" className={compact ? "min-h-11" : "min-h-12 justify-start gap-3"} aria-label={`${copy.logCall}: ${lead.name}`}>
      <PhoneCall aria-hidden className="size-5" />{copy.logCall}
    </Button>}>
    <form className="space-y-4" onSubmit={(event) => {
      event.preventDefault();
      run(() => logLeadCallAction({ id: lead.id, note, advanceFrom: nextStage && advance ? lead.stage : null }), copy.callSaved, () => { setOpen(false); setNote(""); });
    }}>
      <label className="block space-y-2"><span className="text-sm font-medium">{copy.callNote}</span>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={3} disabled={pending}
          placeholder={copy.callNotePlaceholder} className="w-full rounded-md border bg-background px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </label>
      {nextStage && <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" checked={advance} onChange={(event) => setAdvance(event.target.checked)} disabled={pending} className="size-5 accent-primary" />
        {copy.advanceStage(nextStage.label)}
      </label>}
      <Button type="submit" className="min-h-11 w-full" disabled={pending}>{pending ? copy.saving : copy.saveCall}</Button>
    </form>
  </ControlSheet>;
}

export function NoteForm({ leadId }: { leadId: string }) {
  const [message, setMessage] = useState("");
  const { pending, error, run } = useLeadAction();
  return <form className="space-y-3" onSubmit={(event) => {
    event.preventDefault();
    run(() => addLeadNoteAction({ id: leadId, message }), copy.noteSaved, () => setMessage(""));
  }}>
    <label className="block space-y-2"><span className="text-sm font-medium">{copy.addNote}</span>
      <textarea name="message" value={message} onChange={(event) => setMessage(event.target.value)} required maxLength={2000} rows={3} disabled={pending}
        placeholder={copy.notePlaceholder} className="w-full rounded-md border bg-background px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring" />
    </label>
    <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={pending || !message.trim()}>{pending ? copy.saving : copy.saveNote}</Button>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </form>;
}
