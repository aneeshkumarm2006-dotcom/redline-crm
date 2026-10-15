import "server-only";
import { on } from "@/lib/events";
import { eventNames, type DomainEvent } from "@/lib/event-contract";
import { dispatchNotifications, recordEventActivity } from "./service";

export function registerNotificationHandlers() {
  return eventNames.flatMap((name) => [
    on(name, "notifications:dispatch", (event) => dispatchNotifications(event as DomainEvent)),
    on(name, "notifications:activity", (event) => recordEventActivity(event as DomainEvent)),
  ]);
}
