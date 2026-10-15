import { Suspense } from "react";
import { NewVehicleScreen } from "@/modules/inventory/components/vehicle-screen";
import Loading from "../loading";
export default function Page() { return <Suspense fallback={<Loading />}><NewVehicleScreen /></Suspense>; }
