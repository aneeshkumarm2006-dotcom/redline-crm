"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { AuthorizationError } from "@/modules/auth/service";
import type { BoardActionResult, BoardMoneyChange, BoardStatusChange } from "@/components/shared/board";
import { changePrice, changeStatus, completeRepair, createVehicle, markSold, sendToRepair, updateVehicle, InventoryError, WorkflowRequiredError, type InventoryMutation } from "./service";
import type { VehicleWorkflow } from "./schema";

async function run(operation: () => Promise<InventoryMutation>) {
  try {
    const result = await operation();
    // Dashboard, garages and the team views read the same stock.
    revalidatePath("/crm", "layout");
    revalidatePath("/inventory", "layout");
    return { ok: true as const, id: result.vehicle.id, warning: result.warning };
  } catch (error) {
    const message = error instanceof AuthorizationError ? "Owner access is required. Sign in again if your session expired."
      : error instanceof InventoryError ? error.message
      : error instanceof ZodError ? error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(" ")
      : "Unable to save the vehicle. Please try again.";
    // A status change that needs a workflow tells the client which sheet to open instead.
    const workflow: VehicleWorkflow | null = error instanceof WorkflowRequiredError ? error.workflow : null;
    return { ok: false as const, message, workflow };
  }
}
/** Vehicle detail with a workflow sheet open. */
const workflowHref = (id: string, workflow: VehicleWorkflow | null) => workflow ? `/crm/inventory/${id}?action=${workflow}` : undefined;

export async function createVehicleAction(input: unknown) { return run(() => createVehicle(input)); }
export async function updateVehicleAction(input: unknown) { return run(() => updateVehicle(input)); }
export async function changeStatusAction(input: unknown) { return run(() => changeStatus(input)); }
export async function changePriceAction(input: unknown) { return run(() => changePrice(input)); }
export async function sendToRepairAction(input: unknown) { return run(() => sendToRepair(input)); }
export async function completeRepairAction(input: unknown) { return run(() => completeRepair(input)); }
export async function markSoldAction(input: unknown) { return run(() => markSold(input)); }

/** Inline status edits from the inventory board, with the row revision as the concurrency token. */
export async function boardStatusAction(input: BoardStatusChange): Promise<BoardActionResult> {
  const result = await run(() => changeStatus({ id: input.itemId, revision: input.version, status: input.value }));
  return result.ok ? { ok: true, warning: result.warning } : { ok: false, message: result.message, href: workflowHref(input.itemId, result.workflow) };
}
/** Inline price edits from the inventory board. */
export async function boardPriceAction(input: BoardMoneyChange): Promise<BoardActionResult> {
  const result = await run(() => changePrice({ id: input.itemId, revision: input.version, price: input.value }));
  return result.ok ? { ok: true, warning: result.warning } : { ok: false, message: result.message };
}
