"use client";
import { useState } from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/shared/avatar";
import { StatusPill, type PillOption } from "@/components/shared/status-pill";
import type { Settings } from "@/modules/settings/schema";
import { changeLeadStageAction } from "../actions";
import { leadsCopy as copy } from "../copy";
import { ControlSheet, StageOptions, useLeadAction } from "./lead-controls";
import { useDraggableLead } from "./pipeline-dnd";

export type PipelineCardData = {
  id: string; name: string; stage: string; assignedTo: string | null; assignee: string | null;
  vehicle: string; stockNo: string | null; source: PillOption | null; age: string; nextAppointment: string | null;
};

/**
 * Kanban card. Tapping it opens a sheet to move the lead to another stage (with the stage the user saw as the
 * conflict check) or open the full lead; on desktop it can also be dragged to another column. It is a
 * `role="button"` element rather than a <button>, because Firefox will not start a drag from a button.
 */
export function PipelineCard({ lead, settings }: { lead: PipelineCardData; settings: Pick<Settings, "leadStages" | "vehicleStatuses" | "brand"> }) {
  const [open, setOpen] = useState(false);
  const { pending, error, setError, run } = useLeadAction();
  const ref = { id: lead.id, name: lead.name, stage: lead.stage, assignedTo: lead.assignedTo };
  const drag = useDraggableLead({ id: lead.id, name: lead.name, stage: lead.stage });
  return <ControlSheet title={copy.moveStage} description={`${lead.name} · ${copy.moveHint}`} primaryColor={settings.brand.primaryColor}
    open={open} setOpen={(value) => { setOpen(value); setError(""); }} pending={pending} error={error}
    trigger={<div role="button" tabIndex={0} data-lead={lead.id} aria-label={`${lead.name}, ${lead.vehicle}. ${copy.moveStage}`} aria-busy={drag.saving || undefined}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }} {...drag.props}
      className={cn("block w-full min-w-0 cursor-pointer space-y-2.5 rounded-xl border bg-card p-3 text-left shadow-xs transition-[colors,opacity] hover:border-foreground/20 hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-ring",
        drag.props.draggable && "lg:cursor-grab lg:active:cursor-grabbing", (drag.dragging || drag.saving) && "opacity-50")}>
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0 break-words text-sm font-semibold">{lead.name}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{lead.age}</span>
      </span>
      <span className="block truncate text-xs text-muted-foreground">{lead.vehicle}{lead.stockNo && ` · ${lead.stockNo}`}</span>
      {lead.nextAppointment && <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <CalendarClock aria-hidden className="size-3.5 shrink-0 text-primary" /><span className="sr-only">{copy.nextAppointment}: </span>{lead.nextAppointment}
      </span>}
      <span className="flex items-center justify-between gap-2">
        {lead.source ? <StatusPill option={lead.source} className="max-w-[60%]" /> : <span />}
        {lead.assignee ? <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"><Avatar name={lead.assignee} size="sm" /><span className="truncate">{lead.assignee.split(/\s+/)[0]}</span></span>
          : <span className="text-xs font-medium text-warning">{copy.noAssignee}</span>}
      </span>
    </div>}>
    <StageOptions lead={ref} settings={settings} pending={pending}
      onChoose={(stage) => run(() => changeLeadStageAction({ id: lead.id, from: lead.stage, stage }), copy.stageSaved, () => setOpen(false))} />
    <Button asChild variant="ghost" className="min-h-11 w-full"><Link href={`/crm/leads/${lead.id}`}>{copy.openLead} →</Link></Button>
  </ControlSheet>;
}
