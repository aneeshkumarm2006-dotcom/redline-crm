import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/shared/screen-skeleton";
import { CommissionReportScreen } from "@/modules/sales/components/commission-report-screen";
import { salesCopy } from "@/modules/sales/copy";
export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<ScreenSkeleton label={salesCopy.loading} tiles={0} rows={6} />}><CommissionReportScreen searchParams={searchParams} /></Suspense>;
}
