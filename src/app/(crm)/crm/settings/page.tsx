import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/shared/screen-skeleton";
import { SettingsScreen } from "@/modules/settings/components/settings-screen";
import { settingsCopy } from "@/modules/settings/copy";
export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<ScreenSkeleton label={settingsCopy.title} rows={6} />}><SettingsScreen searchParams={searchParams} /></Suspense>;
}
