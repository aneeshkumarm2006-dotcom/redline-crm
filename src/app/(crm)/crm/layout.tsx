import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/shared/app-shell/app-shell";
import { ScreenSkeleton } from "@/components/shared/screen-skeleton";
import { shellCopy } from "@/components/shared/app-shell/copy";

export const metadata: Metadata = {
  title: shellCopy.workspace, robots: { index: false, follow: false },
  // Home-screen install on iOS; Android uses the web manifest.
  icons: { apple: "/app-icon/180" }, appleWebApp: { capable: true, title: shellCopy.workspace, statusBarStyle: "default" },
};
export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="min-h-dvh bg-surface lg:pl-64"><div className="page-gutter w-full pt-6"><ScreenSkeleton label={shellCopy.loading} tiles={2} rows={3} /></div></div>}>
    <AppShell>{children}</AppShell>
  </Suspense>;
}
