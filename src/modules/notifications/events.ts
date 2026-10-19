import "server-only";
import { on } from "@/lib/events";
import { eventNames, type DomainEvent } from "@/lib/event-contract";
import { recordEventActivity } from "./service";

/** The audit trail on every lead and vehicle. Alert and email delivery are recipes, registered in `lib/automation.ts`. */
export function registerNotificationHandlers() {
  return eventNames.map((name) => on(name, "notifications:activity", (event) => recordEventActivity(event as DomainEvent)));
}
