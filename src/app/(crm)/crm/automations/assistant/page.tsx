import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/shared/screen-skeleton";
import { AssistantScreen } from "@/modules/assistant/components/assistant-screen";
import { assistantCopy } from "@/modules/assistant/copy";
export default function Page() {
  return <Suspense fallback={<ScreenSkeleton label={assistantCopy.pageTitle} tiles={3} rows={6} />}><AssistantScreen /></Suspense>;
}
