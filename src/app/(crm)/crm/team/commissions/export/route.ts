import type { NextRequest } from "next/server";
import { AuthorizationError } from "@/modules/auth/service";
import { exportCommissionReport } from "@/modules/sales/service";

/** Commission report CSV (owner). `?month=YYYY-MM` (default this month), `&detail=1` for one row per sale. */
export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("month") ?? undefined;
  const detail = request.nextUrl.searchParams.get("detail") === "1";
  try {
    const { filename, body } = await exportCommissionReport(month, detail);
    return new Response(body, { headers: {
      "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store",
    } });
  } catch (error) {
    if (error instanceof AuthorizationError) return new Response(error.message, { status: error.status, headers: { "Cache-Control": "private, no-store" } });
    throw error;
  }
}
