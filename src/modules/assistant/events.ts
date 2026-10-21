import "server-only";
import { on } from "@/lib/events";
import { queueInquiryForAssistant } from "./service";

/** The assistant answers the question in a new website inquiry (queued; answered after the response). */
export function registerAssistantHandlers() {
  return [on("lead.created", "assistant:inquiry", queueInquiryForAssistant)];
}
