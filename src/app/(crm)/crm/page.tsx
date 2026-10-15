import { Suspense } from "react";
import { DashboardScreen } from "@/modules/dashboard/components/dashboard-screen";
import Loading from "./loading";
export default function Page() { return <Suspense fallback={<Loading />}><DashboardScreen /></Suspense>; }
