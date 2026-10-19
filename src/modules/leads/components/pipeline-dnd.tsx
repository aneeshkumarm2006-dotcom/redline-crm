"use client";
import { createContext, useContext, useState, useTransition, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { changeLeadStageAction } from "../actions";
import { leadsCopy as copy } from "../copy";

/**
 * Drag and drop between pipeline columns (desktop pointers, and touch browsers that support HTML drag and drop).
 * Tapping a card to pick a stage stays the keyboard and phone path. A drop saves through the same
 * `changeLeadStage` action, with the stage the card showed as the conflict check.
 */
type Dragged = { id: string; name: string; stage: string };
type DndState = { dragged: Dragged | null; savingId: string | null; start: (lead: Dragged) => void; end: () => void; drop: (stage: { key: string; label: string }) => void };
const DndContext = createContext<DndState | null>(null);
const MIME = "application/x-redline-lead";

export function PipelineDndProvider({ children }: { children: React.ReactNode }) {
  const [dragged, setDragged] = useState<Dragged | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  function drop(stage: { key: string; label: string }) {
    const lead = dragged;
    setDragged(null);
    if (!lead || lead.stage === stage.key) return;
    setSavingId(lead.id);
    startTransition(async () => {
      try {
        const result = await changeLeadStageAction({ id: lead.id, from: lead.stage, stage: stage.key });
        if (!result.ok) toast.error(result.message);
        else if (result.warning) toast.warning(result.warning);
        else toast.success(copy.movedTo(lead.name, stage.label));
      } catch { toast.error(copy.networkError); }
      finally { setSavingId(null); router.refresh(); }
    });
  }
  return <DndContext.Provider value={{ dragged, savingId, start: setDragged, end: () => setDragged(null), drop }}>{children}</DndContext.Provider>;
}

/** Props that make a card draggable; inert outside a provider. */
export function useDraggableLead(lead: Dragged) {
  const context = useContext(DndContext);
  if (!context) return { props: {}, dragging: false, saving: false };
  return {
    dragging: context.dragged?.id === lead.id,
    saving: context.savingId === lead.id,
    props: {
      draggable: context.savingId !== lead.id,
      onDragStart: (event: DragEvent) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(MIME, lead.id);
        event.dataTransfer.setData("text/plain", lead.name);
        context.start(lead);
      },
      onDragEnd: () => context.end(),
    },
  };
}

/** A stage column that accepts dropped cards from other columns and highlights while one hovers over it. */
export function PipelineDropColumn({ stage, className, style, children, ...rest }: {
  stage: { key: string; label: string }; className?: string; style?: React.CSSProperties; children: React.ReactNode; id?: string; "aria-labelledby"?: string;
}) {
  const context = useContext(DndContext);
  const [over, setOver] = useState(false);
  const accepts = Boolean(context?.dragged && context.dragged.stage !== stage.key);
  return <section {...rest} style={style}
    className={cn(className, "transition-colors", accepts && "outline-2 outline-dashed outline-offset-2 outline-border", accepts && over && "bg-primary/10 outline-primary")}
    onDragOver={(event) => { if (!accepts) return; event.preventDefault(); event.dataTransfer.dropEffect = "move"; if (!over) setOver(true); }}
    onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false); }}
    onDrop={(event) => { event.preventDefault(); setOver(false); if (accepts) context?.drop(stage); }}>
    {children}
  </section>;
}
