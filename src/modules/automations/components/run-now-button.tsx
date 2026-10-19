"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runScheduledNowAction } from "../actions";
import { automationsCopy as copy } from "../copy";

/** Fires today's scheduled reminders on demand (for the live demo); repeats the same day send nothing new. */
export function RunNowButton() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  function run() {
    startTransition(async () => {
      const result = await runScheduledNowAction().catch(() => ({ ok: false as const }));
      if (result.ok) toast.success(copy.ranSummary(result.summary)); else toast.error(copy.runFailed);
      router.refresh();
    });
  }
  return <Button type="button" onClick={run} disabled={pending} title={copy.runNowHint} className="min-h-11 gap-2">
    <Play aria-hidden className="size-4" />{pending ? copy.running : copy.runNow}
  </Button>;
}
