import "server-only";
import { registerLeadHandlers } from "@/modules/leads/events";
import { registerNotificationHandlers } from "@/modules/notifications/events";

/** Called at Node server startup, or explicitly by trusted CLI checks. Keys are HMR-safe. */
export function registerAutomation() {
  const remove = [...registerLeadHandlers(), ...registerNotificationHandlers()];
  return () => remove.forEach((unsubscribe) => unsubscribe());
}
