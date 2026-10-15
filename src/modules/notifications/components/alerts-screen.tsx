import { BellOff } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { requirePageUser } from "@/modules/auth/page-guards";
import { formatTimestamp } from "@/modules/inventory/copy";
import { getSettings } from "@/modules/settings/service";
import { listMyNotifications } from "../service";
import { alertsCopy as copy } from "../copy";
import { AlertsList } from "./alerts-list";

export async function AlertsScreen() {
  await requirePageUser();
  const [notifications, settings] = await Promise.all([listMyNotifications(), getSettings()]);
  // Times are formatted on the server in the dealership zone so the client cannot drift.
  const times = Object.fromEntries(notifications.map((entry) => [entry.id, formatTimestamp(entry.createdAt, settings.booking.timeZone)]));
  return <>
    <header><h1 className="text-3xl font-semibold tracking-tight">{copy.title}</h1><p className="mt-2 text-sm text-muted-foreground">{copy.intro}</p></header>
    {!notifications.length ? <EmptyState icon={BellOff} title={copy.empty} description={copy.emptyHint} /> : <AlertsList notifications={notifications} times={times} />}
  </>;
}
