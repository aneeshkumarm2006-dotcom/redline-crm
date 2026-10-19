import "server-only";
import { on } from "@/lib/events";
import { winLeadForSale } from "./service";

/** Core lead upkeep. Round-robin assignment is a recipe, registered in `lib/automation.ts`. */
export function registerLeadHandlers() {
  return [on("vehicle.sold", "leads:won", winLeadForSale)];
}
