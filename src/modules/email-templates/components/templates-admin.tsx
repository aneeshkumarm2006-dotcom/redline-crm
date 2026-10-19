"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { allowedPlaceholders, type EmailTemplate } from "../schema";
import { updateEmailTemplateAction } from "../actions";
import { templatesCopy as copy } from "../copy";


/** One template's editor: subject, HTML body, tap-to-insert placeholders and a sandboxed live preview. */
function TemplateEditor({ template }: { template: EmailTemplate }) {
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
  return <form onSubmit={save} className="grid gap-4 lg:grid-cols-2">
    <div className="min-w-0 space-y-4">
      <label className="block space-y-2"><span className="text-sm font-medium">{copy.subject}</span>
        <Input value={subject} onChange={(event) => setSubject(event.target.value)} required maxLength={300} className="min-h-11 text-base" /></label>
      <label className="block space-y-2"><span className="text-sm font-medium">{copy.body}</span>
        <textarea ref={textarea} value={body} onChange={(event) => setBody(event.target.value)} required maxLength={50_000} rows={14} spellCheck={false}
          className="w-full min-w-0 rounded-md border bg-background px-3 py-2 font-mono text-sm leading-6 focus-visible:outline-2 focus-visible:outline-ring" /></label>
      <div className="space-y-2"><p className="text-sm font-medium">{copy.placeholders}</p>
        <ul className="flex flex-wrap gap-1.5">{allowed.map((name) => <li key={name}>
          <button type="button" onClick={() => insert(name)} aria-label={copy.insert(name)} className="inline-flex min-h-9 items-center rounded-full border bg-muted/50 px-2.5 font-mono text-xs hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">{`{{${name}}}`}</button>
        </li>)}</ul>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="min-h-11" disabled={pending || (subject === template.subject && body === template.body)}>{pending ? copy.saving : copy.save}</Button>
    </div>
    <div className="min-w-0 space-y-2">
      <p className="text-sm font-medium">{copy.preview}</p>
      <p className="break-words rounded-t-lg border border-b-0 bg-muted/40 px-3 py-2 text-sm font-medium">{subject}</p>
      {/* Owner-authored HTML, rendered with every capability disabled. */}
      <iframe title={copy.preview} sandbox="" srcDoc={body} className="-mt-2 h-96 w-full rounded-b-lg border bg-white" />
    </div>
  </form>;
}

export function TemplatesAdmin({ templates }: { templates: EmailTemplate[] }) {
  const [selected, setSelected] = useState(templates[0]?.key);
  const template = templates.find((entry) => entry.key === selected) ?? templates[0];
  return <section aria-labelledby="templates-admin" className="space-y-4">
    <div><h2 id="templates-admin" className="text-lg font-semibold">{copy.title}</h2><p className="text-sm text-muted-foreground">{copy.hint}</p></div>
    {!template ? <p className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">{copy.empty}</p> : <>
      <nav aria-label={copy.template} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">{templates.map((entry) => <button key={entry.key} type="button" onClick={() => setSelected(entry.key)}
        aria-current={entry.key === template.key ? "true" : undefined}
        className={cn("inline-flex min-h-10 shrink-0 items-center rounded-full border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring",
          entry.key === template.key ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted")}>{copy.names[entry.key] ?? entry.key}</button>)}</nav>
      <div className="rounded-xl border bg-card p-4"><TemplateEditor key={`${template.id}-${template.subject}-${template.body.length}`} template={template} /></div>
    </>}
  </section>;
}
