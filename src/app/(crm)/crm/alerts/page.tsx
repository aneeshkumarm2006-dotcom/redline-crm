import { Suspense } from "react";
import { AlertsScreen } from "@/modules/notifications/components/alerts-screen";
import Loading from "./loading";
export default function Page() { return <Suspense fallback={<Loading />}><AlertsScreen /></Suspense>; }
