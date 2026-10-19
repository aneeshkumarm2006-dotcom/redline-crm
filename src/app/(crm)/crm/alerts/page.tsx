import { Suspense } from "react";
import { AlertsScreen } from "@/modules/notifications/components/alerts-screen";
import Loading from "./loading";
export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<Loading />}><AlertsScreen searchParams={searchParams} /></Suspense>;
}
