import { Badge } from "@/components/ui/badge";
import type { Settings } from "@/modules/settings/schema";

export type StatusBadgeProps = {
  kind: "vehicle" | "lead";
  status: string;
  className?: string;
};

/** Pure view usable in client forms with definitions passed by a server parent. */
export function StatusBadgeView({ kind, status, settings, className }: StatusBadgeProps & {
  settings: Pick<Settings, "vehicleStatuses" | "leadStages">;
}) {
  const definition = (kind === "vehicle" ? settings.vehicleStatuses : settings.leadStages)
    .find((item) => item.key === status);
  return (
    <Badge variant="outline" className={className}>
      {definition && <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: definition.color }} />}
      {definition?.label ?? status}
    </Badge>
  );
}
