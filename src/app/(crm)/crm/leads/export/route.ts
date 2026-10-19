import type { NextRequest } from "next/server";
import { AuthorizationError } from "@/modules/auth/service";
import { exportLeads } from "@/modules/leads/service";

const filterKeys = ["q", "stage", "dealershipId", "assignedTo", "source"] as const;

/** Leads CSV with the same filters as the board and list. Salespeople only ever get their own leads. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const filters = Object.fromEntries(filterKeys.flatMap((key) => params.get(key) ? [[key, params.get(key)]] : []));
  try {
    const { filename, body } = await exportLeads(filters);
    return new Response(body, { headers: {
      "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store",
    } });
  } catch (error) {
    if (error instanceof AuthorizationError) return new Response(error.message, { status: error.status, headers: { "Cache-Control": "private, no-store" } });
    if (error instanceof Error && error.name === "ZodError") return new Response("Invalid filters.", { status: 400, headers: { "Cache-Control": "private, no-store" } });
    throw error;
  }
}
