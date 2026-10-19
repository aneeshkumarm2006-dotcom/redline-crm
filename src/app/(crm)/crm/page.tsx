import { Suspense } from "react";
import { DashboardScreen } from "@/modules/dashboard/components/dashboard-screen";
import Loading from "./loading";
export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<Loading />}><DashboardScreen searchParams={searchParams} /></Suspense>;
}
