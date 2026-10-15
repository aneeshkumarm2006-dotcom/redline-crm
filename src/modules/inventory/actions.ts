"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { AuthorizationError } from "@/modules/auth/service";
import { changePrice, changeStatus, createVehicle, updateVehicle, InventoryError, type InventoryMutation } from "./service";

async function run(operation: () => Promise<InventoryMutation>) {
  try {
    const result = await operation();
    revalidatePath("/crm/inventory", "layout");
    revalidatePath("/inventory", "layout");
    return { ok: true as const, id: result.vehicle.id, warning: result.warning };
  } catch (error) {
    const message = error instanceof AuthorizationError ? "Owner access is required. Sign in again if your session expired."
      : error instanceof InventoryError ? error.message
      : error instanceof ZodError ? error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(" ")
      : "Unable to save the vehicle. Please try again.";
    return { ok: false as const, message };
  }
}
export async function createVehicleAction(input: unknown) { return run(() => createVehicle(input)); }
export async function updateVehicleAction(input: unknown) { return run(() => updateVehicle(input)); }
export async function changeStatusAction(input: unknown) { return run(() => changeStatus(input)); }
export async function changePriceAction(input: unknown) { return run(() => changePrice(input)); }
