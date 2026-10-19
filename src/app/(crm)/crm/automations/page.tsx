import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/shared/screen-skeleton";
import { AutomationsScreen } from "@/modules/automations/components/automations-screen";
import { automationsCopy } from "@/modules/automations/copy";
export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<ScreenSkeleton label={automationsCopy.loading} tiles={4} rows={6} />}><AutomationsScreen searchParams={searchParams} /></Suspense>;
}
