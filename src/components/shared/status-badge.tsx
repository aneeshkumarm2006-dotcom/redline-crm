import { getSettings } from "@/modules/settings/service";
import { StatusBadgeView, type StatusBadgeProps } from "./status-badge-view";

export async function StatusBadge(props: StatusBadgeProps) {
  const settings = await getSettings();
  return <StatusBadgeView {...props} settings={settings} />;
}
