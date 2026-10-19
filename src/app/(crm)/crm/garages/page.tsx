import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/shared/screen-skeleton";
import { GaragesScreen } from "@/modules/garages/components/garages-screen";
import { garagesCopy } from "@/modules/garages/copy";
export default function Page() {
  return <Suspense fallback={<ScreenSkeleton label={garagesCopy.title} tiles={4} rows={4} />}><GaragesScreen /></Suspense>;
}
