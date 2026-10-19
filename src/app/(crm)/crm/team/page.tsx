import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/shared/screen-skeleton";
import { TeamScreen } from "@/modules/sales/components/team-screen";
import { salesCopy } from "@/modules/sales/copy";
export default function Page() {
  return <Suspense fallback={<ScreenSkeleton label={salesCopy.loading} tiles={4} rows={6} />}><TeamScreen /></Suspense>;
}
