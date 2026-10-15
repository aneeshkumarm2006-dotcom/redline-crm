import { Suspense } from "react";
import { PublicVehicleScreen } from "@/modules/inventory/components/public-vehicle-screen";
import { publicInventoryCopy as copy } from "@/modules/inventory/public-copy";

export const metadata = { title: copy.specs };
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<p role="status">{copy.loading}</p>}><PublicVehicleScreen params={params} /></Suspense>;
}
