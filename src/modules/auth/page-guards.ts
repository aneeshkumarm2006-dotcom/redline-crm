import "server-only";
import { redirect } from "next/navigation";
import type { Role } from "@/modules/users/schema";
import { AuthorizationError, requireRole } from "./service";

/** Page adapter; services continue to use requireRole directly. */
export async function requirePageUser(...roles: Role[]) {
  try { return await requireRole(...roles); }
  catch (error) {
    if (!(error instanceof AuthorizationError)) throw error;
    redirect(error.status === 401 ? "/login" : "/crm/access-denied");
  }
}
