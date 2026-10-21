"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { assistantModes, type AssistantSettings } from "@/modules/settings/schema";
import { runAssistantNowAction, saveAssistantSettingsAction } from "../actions";
import { assistantCopy as copy } from "../copy";

const textareaClass = "w-full rounded-lg border border-input bg-card px-3 py-2.5 text-base leading-6 shadow-xs outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50";

/** Owner: check the reply inbox and answer what is waiting, now. */
export function CheckInboxButton() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return <Button variant="outline" className="min-h-11 gap-2" disabled={pending} onClick={() => startTransition(async () => {
    const result = await runAssistantNowAction().catch(() => ({ ok: false as const, message: copy.checkFailed }));
    if (!result.ok) toast.error(result.message);
    else if (result.error) toast.error(result.error);
    else toast.success(copy.checked(result.fetched));
    router.refresh();
  })}>
    <RefreshCw aria-hidden className={cn("size-4", pending && "animate-spin")} />{pending ? copy.checking : copy.checkNow}
  </Button>;
}

/** Owner settings for the assistant: on/off, send or draft, name, inquiry answers, daily cap and guidance. */
export function AssistantSettingsForm({ initial }: { initial: AssistantSettings }) {
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  const set = <K extends keyof AssistantSettings>(key: K, next: AssistantSettings[K]) => setValue((current) => ({ ...current, [key]: next }));
  return <form className="space-y-5" onSubmit={(event) => {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await saveAssistantSettingsAction(value).catch(() => ({ ok: false as const, message: copy.error }));
      if (!result.ok) { setError(result.message); toast.error(result.message); return; }
      toast.success(copy.saved);
      router.refresh();
    });
  }}>
    <fieldset disabled={pending} className="space-y-5">
      <label className="flex min-h-12 items-start gap-3 rounded-xl bg-muted px-3.5 py-3">
        <input type="checkbox" checked={value.enabled} onChange={(event) => set("enabled", event.target.checked)} className="mt-0.5 size-5 accent-primary" />
        <span><span className="block text-sm font-semibold">{copy.enabled}</span><span className="block text-xs text-muted-foreground">{copy.enabledHint}</span></span>
      </label>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">{copy.mode}</legend>
        {assistantModes.map((mode) => <label key={mode} className="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border bg-card p-3.5 shadow-xs has-checked:border-primary has-checked:bg-brand-soft has-checked:ring-1 has-checked:ring-primary">
          <input type="radio" name="mode" value={mode} checked={value.mode === mode} onChange={() => set("mode", mode)} className="mt-0.5 size-5 accent-primary" />
          <span><span className="block text-sm font-semibold">{copy.modes[mode]}</span><span className="block text-xs text-muted-foreground">{copy.modeHints[mode]}</span></span>
        </label>)}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2"><span className="text-sm font-medium">{copy.name}</span>
          <Input value={value.name} onChange={(event) => set("name", event.target.value)} maxLength={40} required className="min-h-11" />
        </label>
        <label className="block space-y-2"><span className="text-sm font-medium">{copy.maxReplies}</span>
          <Input type="number" min={1} max={20} value={value.maxRepliesPerDay} onChange={(event) => set("maxRepliesPerDay", Number(event.target.value))} required className="min-h-11" />
          <span className="block text-xs text-muted-foreground">{copy.maxRepliesHint}</span>
        </label>
      </div>
      <label className="flex min-h-12 items-start gap-3 rounded-xl bg-muted px-3.5 py-3">
        <input type="checkbox" checked={value.answerInquiries} onChange={(event) => set("answerInquiries", event.target.checked)} className="mt-0.5 size-5 accent-primary" />
        <span><span className="block text-sm font-semibold">{copy.answerInquiries}</span><span className="block text-xs text-muted-foreground">{copy.answerInquiriesHint}</span></span>
      </label>
      <label className="block space-y-2"><span className="text-sm font-medium">{copy.instructions}</span>
        <textarea value={value.instructions} onChange={(event) => set("instructions", event.target.value)} rows={6} maxLength={4000}
          placeholder={copy.instructionsPlaceholder} className={textareaClass} />
        <span className="block text-xs text-muted-foreground">{copy.instructionsHint}</span>
      </label>
    </fieldset>
    <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={pending}>{pending ? copy.saving : copy.save}</Button>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </form>;
}
