"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brandEmail, sampleEmailValues, type EmailBrand } from "@/lib/email/layout";
import { allowedPlaceholders, type EmailTemplate } from "../schema";
import { updateEmailTemplateAction } from "../actions";
import { templatesCopy as copy } from "../copy";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
/** Fills placeholders with sample values (escaped like real sends), or leaves them visible; unknown ones stay as written. */
function fill(text: string, sample: boolean, html: boolean) {
  return text.replace(/{{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*}}/g, (token, key: string) => {
    if (!sample || !Object.hasOwn(sampleEmailValues, key)) return token;
    return html ? escapeHtml(sampleEmailValues[key]) : sampleEmailValues[key];
  });
}

/** One template's editor: subject, HTML body, tap-to-insert placeholders and a sandboxed live preview. */
function TemplateEditor({ template, brand }: { template: EmailTemplate; brand: EmailBrand }) {
  const [sample, setSample] = useState(true);
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const allowed = allowedPlaceholders(template);
  function insert(name: string) {
    const element = textarea.current;
    const token = `{{${name}}}`;
    const start = element?.selectionStart ?? body.length;
    const end = element?.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + token + body.slice(end));
    requestAnimationFrame(() => { element?.focus(); element?.setSelectionRange(start + token.length, start + token.length); });
  }
  function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        const result = await updateEmailTemplateAction({ id: template.id, subject, body });
        if (!result.ok) { setError(result.message); toast.error(result.message); return; }
        toast.success(copy.saved);
        router.refresh();
      } catch { setError(copy.failed); }
    });
  }
  return <form onSubmit={save} className="grid gap-6 xl:grid-cols-12">
    <div className="min-w-0 space-y-5 rounded-2xl border bg-card p-5 shadow-xs sm:p-6 xl:col-span-7">
      <label className="block space-y-2"><span className="block text-sm font-medium">{copy.subject}</span>
        <Input value={subject} onChange={(event) => setSubject(event.target.value)} required maxLength={300} className="min-h-11 text-base md:text-sm" /></label>
      <label className="block space-y-2"><span className="block text-sm font-medium">{copy.body}</span>
        <textarea ref={textarea} value={body} onChange={(event) => setBody(event.target.value)} required maxLength={50_000} rows={16} spellCheck={false}
          className="block w-full min-w-0 rounded-lg border border-input bg-muted/30 px-3.5 py-3 font-mono text-sm leading-6 shadow-xs transition-[border-color,box-shadow] duration-150 hover:border-foreground/25 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" /></label>
      <div className="space-y-2"><p className="text-sm font-medium">{copy.placeholders}</p>
        <ul className="flex flex-wrap gap-1.5">{allowed.map((name) => <li key={name}>
          <button type="button" onClick={() => insert(name)} aria-label={copy.insert(name)} className="inline-flex min-h-9 items-center rounded-lg border bg-card px-2.5 font-mono text-xs text-foreground/80 shadow-xs transition-colors hover:border-primary/40 hover:bg-brand-soft hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11">{`{{${name}}}`}</button>
        </li>)}</ul>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-5">
        {error && <p role="alert" className="mr-auto min-w-0 break-words text-sm font-medium text-destructive">{error}</p>}
        <Button type="submit" className="min-h-11 min-w-32" disabled={pending || (subject === template.subject && body === template.body)}>{pending ? copy.saving : copy.save}</Button>
      </div>
    </div>
    <div className="min-w-0 xl:col-span-5">
      <div className="overflow-clip rounded-2xl border bg-card shadow-xs xl:sticky xl:top-20">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/40 px-5 py-3.5">
          <div className="min-w-0">
            <p className="eyebrow">{copy.preview}</p>
            <p className="mt-1 break-words text-sm font-semibold">{fill(subject, sample, false)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{copy.previewHint}</p>
          </div>
          <div role="group" aria-label={copy.previewMode} className="inline-flex shrink-0 gap-1 rounded-xl bg-muted p-1">
            {([true, false] as const).map((mode) => <button key={String(mode)} type="button" aria-pressed={sample === mode} onClick={() => setSample(mode)}
              className={cn("inline-flex min-h-8 items-center rounded-lg px-3 text-xs font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:min-h-11",
                sample === mode ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground")}>{mode ? copy.sampleData : copy.rawPlaceholders}</button>)}
          </div>
        </div>
        {/* Owner-authored HTML in the branded layout, rendered with every capability disabled. */}
        <iframe title={copy.preview} sandbox="" srcDoc={brandEmail(fill(body, sample, true), { brand, subject: fill(subject, sample, false) })} className="block h-[36rem] w-full bg-[#F4F6FA]" />
      </div>
    </div>
  </form>;
}

export function TemplatesAdmin({ templates, brand }: { templates: EmailTemplate[]; brand: EmailBrand }) {
  const [selected, setSelected] = useState(templates[0]?.key);
  const template = templates.find((entry) => entry.key === selected) ?? templates[0];
  return <section aria-labelledby="templates-admin" className="space-y-5">
    <div><h2 id="templates-admin" className="text-lg font-semibold tracking-tight">{copy.title}</h2><p className="mt-0.5 text-sm text-muted-foreground">{copy.hint}</p></div>
    {!template ? <p className="rounded-2xl border border-dashed bg-card p-5 text-sm text-muted-foreground">{copy.empty}</p> : <>
      <nav aria-label={copy.template} className="scrollbar-thin flex w-full gap-1 overflow-x-auto rounded-xl bg-muted p-1 sm:w-fit sm:max-w-full">{templates.map((entry) => <button key={entry.key} type="button" onClick={() => setSelected(entry.key)}
        aria-current={entry.key === template.key ? "true" : undefined}
        className={cn("inline-flex min-h-9 shrink-0 items-center rounded-lg px-3.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11",
          entry.key === template.key ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground")}>{copy.names[entry.key] ?? entry.key}</button>)}</nav>
      <TemplateEditor key={`${template.id}-${template.subject}-${template.body.length}`} template={template} brand={brand} />
    </>}
  </section>;
}
