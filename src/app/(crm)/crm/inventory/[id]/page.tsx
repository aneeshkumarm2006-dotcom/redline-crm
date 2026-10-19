import { Suspense } from "react";
import { VehicleScreen } from "@/modules/inventory/components/vehicle-screen";
import Loading from "../loading";
export default function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<Loading />}><VehicleScreen params={params} searchParams={searchParams} /></Suspense>;
}
