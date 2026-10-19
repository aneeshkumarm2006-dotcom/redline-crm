import { requirePageUser } from "@/modules/auth/page-guards";
import { OwnerDashboard } from "./owner-dashboard";
import { SalespersonDashboard } from "./salesperson-dashboard";

/** First screen after login: the owner's Command Center, or a salesperson's own day. */
export async function DashboardScreen({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePageUser();
  return user.role === "owner" ? <OwnerDashboard searchParams={searchParams} /> : <SalespersonDashboard />;
}
