"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inquirySchema, type InquiryInput, type InquiryResult } from "../schema";
import { submitInquiry } from "../actions";
import { inquiryCopy as copy } from "../copy";
import { rememberUtmSource } from "../utm";

/**
 * Route-independent form. An embed can supply its own submission transport. `defaultMessage` pre-fills the message
 * (e.g. a test-drive request), and the visitor's `utm_source`, when present, is sent with the inquiry.
 */
export function InquiryForm({ vehicleId, onSubmitAction = submitInquiry, defaultMessage, title = copy.title, intro = copy.intro, id: anchor }: {
  vehicleId: string; onSubmitAction?: (input: InquiryInput) => Promise<InquiryResult>; defaultMessage?: string; title?: string; intro?: string; id?: string;
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
      utmSource: rememberUtmSource() ?? undefined,
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
  // Flat by design: the vehicle page's booking panel supplies the card surface.
  if (result?.ok) return <section id={anchor} role="status" className="scroll-mt-24 space-y-3">
    <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-2xl bg-success/10 text-success"><CheckCircle2 className="size-7" /></span>
    <h2 ref={success} tabIndex={-1} className="font-display pt-1 text-xl font-bold outline-none">{copy.thankYou}</h2>
    <p className="text-muted-foreground">{copy.received}</p>
  </section>;
  return <section id={anchor} className="scroll-mt-24" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`} className="font-display text-xl font-bold">{title}</h2>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">{intro}</p>
    <form onSubmit={send} className="mt-5 space-y-4" aria-busy={pending}>
      <fieldset disabled={pending} className="min-w-0 space-y-4">
        {([ ["name", copy.name, "text", "name", 120], ["email", copy.email, "email", "email", 254], ["phone", copy.phone, "tel", "tel", 40] ] as const).map(([name, label, type, autoComplete, maxLength]) => <div key={name} className="space-y-1.5">
          <label htmlFor={`${id}-${name}`} className="block text-sm font-semibold">{label}</label>
          <Input id={`${id}-${name}`} name={name} type={type} autoComplete={autoComplete} required maxLength={maxLength} minLength={name === "phone" ? 7 : 1}
            aria-invalid={!!errors?.[name]} aria-describedby={errors?.[name] ? `${id}-${name}-error` : undefined} className="h-12 rounded-xl px-4 text-base md:text-base" />
          {errors?.[name] && <p id={`${id}-${name}-error`} className="text-sm text-destructive">{errors[name]}</p>}
        </div>)}
        <div className="space-y-1.5">
          <label htmlFor={`${id}-message`} className="block text-sm font-semibold">{copy.message}</label>
          <textarea id={`${id}-message`} name="message" rows={4} maxLength={4000} defaultValue={defaultMessage} className="w-full min-w-0 rounded-xl border border-input bg-card px-4 py-3 text-base shadow-xs transition-[border-color,box-shadow] duration-150 outline-none hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30" aria-invalid={!!errors?.message} aria-describedby={errors?.message ? `${id}-message-error` : undefined} />
          {errors?.message && <p id={`${id}-message-error`} className="text-sm text-destructive">{errors.message}</p>}
        </div>
      </fieldset>
      {result && !result.ok && <p role="alert" className="text-sm font-medium text-destructive">{result.message}</p>}
      <Button type="submit" disabled={pending} className="h-14 w-full rounded-2xl text-[0.9375rem] shadow-[0_6px_16px_-6px_color-mix(in_oklab,var(--primary)_70%,transparent)]">{pending ? copy.pending : copy.submit}</Button>
      <p className="text-xs leading-5 text-muted-foreground">{copy.privacy}</p>
    </form>
  </section>;
}
