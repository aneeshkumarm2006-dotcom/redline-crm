import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/shared/screen-skeleton";
import { SalespersonScreen } from "@/modules/sales/components/salesperson-screen";
import { salesCopy } from "@/modules/sales/copy";
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<ScreenSkeleton label={salesCopy.loading} tiles={6} rows={6} />}><SalespersonScreen params={params} /></Suspense>;
}
