import { Suspense } from "react";
import { NewLeadScreen } from "@/modules/leads/components/new-lead-screen";
import Loading from "../loading";
export default function Page() { return <Suspense fallback={<Loading />}><NewLeadScreen /></Suspense>; }
