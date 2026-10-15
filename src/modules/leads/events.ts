import "server-only";
import { on } from "@/lib/events";
import { assignCreatedLead } from "./service";

export function registerLeadHandlers() {
  return [on("lead.created", "leads:assign", assignCreatedLead)];
}
