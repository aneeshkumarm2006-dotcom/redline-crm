import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/shared/screen-skeleton";
import { CoordinatorScreen } from "@/modules/coordinator/components/coordinator-screen";
import { coordinatorCopy } from "@/modules/coordinator/copy";
export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<ScreenSkeleton label={coordinatorCopy.loading} tiles={4} rows={6} />}><CoordinatorScreen searchParams={searchParams} /></Suspense>;
}
