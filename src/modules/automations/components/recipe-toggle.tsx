"use client";
import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { AutomationRecipeKey } from "../schema";
import { setRecipeEnabledAction } from "../actions";
import { automationsCopy as copy } from "../copy";

/** On/off switch for one recipe. Flips at once, then settles to the saved value. */
export function RecipeToggle({ recipeKey, name, enabled }: { recipeKey: AutomationRecipeKey; name: string; enabled: boolean }) {
  const [pending, startTransition] = useTransition();
  const [checked, setChecked] = useOptimistic(enabled);
  const router = useRouter();
  function toggle() {
    const next = !checked;
    startTransition(async () => {
      setChecked(next);
      const result = await setRecipeEnabledAction({ key: recipeKey, enabled: next }).catch(() => ({ ok: false as const }));
      if (result.ok) toast.success(next ? copy.turnedOn(name) : copy.turnedOff(name)); else toast.error(copy.toggleFailed);
      router.refresh();
    });
  }
  return <button type="button" role="switch" aria-checked={checked} aria-label={copy.toggle(name)} disabled={pending} onClick={toggle}
    className="group inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-1 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-70">
    <span aria-hidden className={cn("w-7 text-right", checked ? "text-success" : "text-muted-foreground")}>{checked ? copy.on : copy.off}</span>
    <span aria-hidden className={cn("relative inline-flex h-7 w-12 items-center rounded-full transition-colors", checked ? "bg-success" : "bg-muted-foreground/30")}>
      <span className={cn("absolute size-5 rounded-full bg-white shadow-sm transition-transform", checked ? "translate-x-6" : "translate-x-1")} />
    </span>
  </button>;
}
