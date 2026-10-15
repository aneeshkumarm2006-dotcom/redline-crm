"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inquirySchema, type InquiryInput, type InquiryResult } from "../schema";
import { submitInquiry } from "../actions";
import { inquiryCopy as copy } from "../copy";

/** Route-independent form. An embed can supply its own submission transport. */
export function InquiryForm({ vehicleId, onSubmitAction = submitInquiry }: {
  vehicleId: string; onSubmitAction?: (input: InquiryInput) => Promise<InquiryResult>;
}) {
  const id = useId();
  const requestId = useRef<string | null>(null);
  const busy = useRef(false);
  const success = useRef<HTMLHeadingElement>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<InquiryResult | null>(null);
  useEffect(() => { if (result?.ok) success.current?.focus(); }, [result]);
  const errors = result && !result.ok ? result.fields : undefined;
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    requestId.current ??= crypto.randomUUID();
    const parsed = inquirySchema.safeParse({ vehicleId, inquiryId: requestId.current,
      name: fields.get("name"), email: fields.get("email"), phone: fields.get("phone"), message: fields.get("message"),
    });
    if (!parsed.success) {
      setResult({ ok: false, message: copy.invalid, fields: Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message])) });
      const field = form.elements.namedItem(String(parsed.error.issues[0]?.path[0]));
      if (field instanceof HTMLElement) field.focus();
      return;
    }
    busy.current = true; setPending(true); setResult(null);
    try { setResult(await onSubmitAction(parsed.data)); }
    catch { setResult({ ok: false, message: copy.error }); }
    finally { busy.current = false; setPending(false); }
  }
  if (result?.ok) return <section role="status" className="space-y-4 rounded-2xl border bg-card p-6">
    <CheckCircle2 className="size-9 text-primary" aria-hidden="true" />
    <h2 ref={success} tabIndex={-1} className="text-xl font-semibold outline-none">{copy.thankYou}</h2>
    <p className="text-muted-foreground">{copy.received}</p>
  </section>;
  return <section className="rounded-2xl border bg-card p-5 sm:p-6" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`} className="text-xl font-semibold">{copy.title}</h2>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy.intro}</p>
    <form onSubmit={send} className="mt-6 space-y-4" aria-busy={pending}>
      <fieldset disabled={pending} className="min-w-0 space-y-4">
        {([ ["name", copy.name, "text", "name", 120], ["email", copy.email, "email", "email", 254], ["phone", copy.phone, "tel", "tel", 40] ] as const).map(([name, label, type, autoComplete, maxLength]) => <div key={name} className="space-y-2">
          <label htmlFor={`${id}-${name}`} className="text-sm font-medium">{label}</label>
          <Input id={`${id}-${name}`} name={name} type={type} autoComplete={autoComplete} required maxLength={maxLength} minLength={name === "phone" ? 7 : 1}
            aria-invalid={!!errors?.[name]} aria-describedby={errors?.[name] ? `${id}-${name}-error` : undefined} className="min-h-11 text-base" />
          {errors?.[name] && <p id={`${id}-${name}-error`} className="text-sm text-destructive">{errors[name]}</p>}
        </div>)}
        <div className="space-y-2">
          <label htmlFor={`${id}-message`} className="text-sm font-medium">{copy.message}</label>
          <textarea id={`${id}-message`} name="message" rows={4} maxLength={4000} className="w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-ring" aria-invalid={!!errors?.message} aria-describedby={errors?.message ? `${id}-message-error` : undefined} />
          {errors?.message && <p id={`${id}-message-error`} className="text-sm text-destructive">{errors.message}</p>}
        </div>
      </fieldset>
      {result && !result.ok && <p role="alert" className="text-sm text-destructive">{result.message}</p>}
      <Button type="submit" disabled={pending} className="min-h-11 w-full">{pending ? copy.pending : copy.submit}</Button>
      <p className="text-xs leading-5 text-muted-foreground">{copy.privacy}</p>
    </form>
  </section>;
}
