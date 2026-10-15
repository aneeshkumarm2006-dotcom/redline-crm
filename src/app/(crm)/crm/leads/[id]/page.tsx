import { Suspense } from "react";
import { LeadScreen } from "@/modules/leads/components/lead-screen";
import Loading from "../loading";
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<Loading />}><LeadScreen params={params} /></Suspense>;
}
