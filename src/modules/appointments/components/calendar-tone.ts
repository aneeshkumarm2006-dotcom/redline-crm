/** Chip, dot and accent classes per appointment status, shared by every calendar view and the details sheet. */
const tones: Record<string, { chip: string; dot: string; block: string }> = {
  booked: { chip: "border-primary/30 bg-brand-soft text-foreground", dot: "bg-primary", block: "border-primary bg-brand-soft text-foreground" },
  completed: { chip: "border-border bg-muted text-muted-foreground", dot: "bg-muted-foreground/50", block: "border-muted-foreground/40 bg-muted text-muted-foreground" },
  no_show: { chip: "border-warning/40 bg-warning/10 text-foreground", dot: "bg-warning", block: "border-warning bg-warning/10 text-foreground" },
  cancelled: { chip: "border-border bg-muted/50 text-muted-foreground line-through", dot: "bg-destructive/60", block: "border-destructive/40 bg-muted/60 text-muted-foreground line-through" },
};
export const statusTone = (status: string) => tones[status] ?? tones.booked;
export const legendStatuses = ["booked", "completed", "no_show", "cancelled"] as const;
