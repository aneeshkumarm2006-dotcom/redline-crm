import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/shared/screen-skeleton";
import { EmailLogScreen } from "@/modules/automations/components/email-log-screen";
import { emailLogCopy } from "@/modules/automations/copy";
export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<ScreenSkeleton label={emailLogCopy.title} tiles={0} rows={6} />}><EmailLogScreen searchParams={searchParams} /></Suspense>;
}
