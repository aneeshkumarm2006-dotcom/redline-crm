import { Suspense } from "react";
import { VehicleScreen } from "@/modules/inventory/components/vehicle-screen";
import Loading from "../loading";
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<Loading />}><VehicleScreen params={params} /></Suspense>;
}
