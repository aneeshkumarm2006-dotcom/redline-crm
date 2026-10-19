import { Suspense } from "react";
import { PublicVehicleScreen } from "@/modules/inventory/components/public-vehicle-screen";
import { publicInventoryCopy as copy } from "@/modules/inventory/public-copy";

export const metadata = { title: copy.specs };
export default function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<p role="status">{copy.loading}</p>}><PublicVehicleScreen params={params} searchParams={searchParams} /></Suspense>;
}
