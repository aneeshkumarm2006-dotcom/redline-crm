import { Suspense } from "react";
import { LeadScreen } from "@/modules/leads/components/lead-screen";
import Loading from "../loading";
export default function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<Loading />}><LeadScreen params={params} searchParams={searchParams} /></Suspense>;
}
