"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bot, Mail, PauseCircle, PlayCircle, Send, Sparkles, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatTimestamp } from "@/modules/inventory/copy";
import type { ConversationView } from "../service";
import type { AssistantActionResult } from "../schema";
import { approveDraftAction, discardDraftAction, requestAssistantDraftAction, sendStaffReplyAction, setAssistantPausedAction } from "../actions";
import { assistantCopy as copy, assistantNotes } from "../copy";

const textareaClass = "w-full rounded-lg border border-input bg-card px-3 py-2.5 text-base leading-6 shadow-xs outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50";

function useAssistantAction() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  function run(action: () => Promise<AssistantActionResult>, success: string, done?: () => void) {
    startTransition(async () => {
      const result = await action().catch(() => ({ ok: false as const, message: copy.error }));
      if (!result.ok) { toast.error(result.message); router.refresh(); return; }
      toast.success(success);
      done?.();
      router.refresh();
    });
  }
  return { pending, run };
}

type Message = ConversationView["messages"][number];

function DraftCard({ message }: { message: Message }) {
  const [body, setBody] = useState(message.text);
  const { pending, run } = useAssistantAction();
  return <div className="space-y-3">
    {message.stale && <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">{assistantNotes.newer} Check it still fits before sending.</p>}
    {message.note && <p className="text-sm text-muted-foreground">{message.note}</p>}
    <label className="block space-y-1.5"><span className="sr-only">{copy.editDraft}</span>
      <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={Math.min(14, Math.max(5, body.split("\n").length + 1))} maxLength={8000} disabled={pending} className={textareaClass} />
    </label>
    <div className="flex flex-wrap gap-2">
      <Button className="min-h-11 gap-2" disabled={pending || !body.trim()} onClick={() => run(() => approveDraftAction({ id: message.id, body }), copy.sent)}>
        <Send aria-hidden className="size-4" />{pending ? copy.sending : copy.approve}
      </Button>
      <Button variant="outline" className="min-h-11" disabled={pending} onClick={() => run(() => discardDraftAction({ id: message.id }), copy.discardedSaved)}>{copy.discard}</Button>
    </div>
  </div>;
}

/** The lead's email conversation with the virtual assistant: customer emails, answers, drafts to approve and a reply box. */
export function ConversationPanel({ leadId, view, timeZone, email }: { leadId: string; view: ConversationView; timeZone: string; email: string }) {
  const [reply, setReply] = useState("");
  const action = useAssistantAction();
  const { thread, assistant } = view;
  const state = !assistant.enabled ? copy.off : thread.optedOut ? copy.optedOut : thread.paused ? copy.paused : copy.active;
  const working = assistant.enabled && !thread.paused && !thread.optedOut;
  const label = (message: Message) => message.direction === "inbound" ? (message.source === "inquiry" ? copy.inquiry : copy.customer)
    : message.author === "staff" ? `${message.fromName.split(" at ")[0] || copy.staff} · ${copy.staff.toLowerCase()}` : copy.assistant(assistant.name);
  const Icon = (message: Message) => message.direction === "inbound" ? Mail : message.author === "staff" ? UserRound : Bot;
  return <div className="grid gap-4 sm:gap-5 xl:grid-cols-12">
    <section aria-labelledby="conversation-title" className="min-w-0 rounded-2xl border bg-card p-5 shadow-xs sm:p-6 xl:col-span-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="conversation-title" className="text-[0.9375rem] font-semibold tracking-tight">{copy.title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{copy.hint}</p>
        </div>
        <span className={cn("inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold", working ? "bg-brand-soft text-primary" : "bg-muted text-muted-foreground")}>
          <Bot aria-hidden className="size-3.5" />{state}
        </span>
      </div>
      {!view.messages.length ? <p className="mt-4 text-sm text-muted-foreground">{copy.empty}</p> : <ol className="mt-4 space-y-3">
        {view.messages.filter((message) => message.status !== "discarded").map((message) => {
          const MessageIcon = Icon(message);
          const outbound = message.direction === "outbound";
          return <li key={message.id} className={cn("rounded-xl border p-4", outbound ? "bg-muted/40 sm:ml-8" : "bg-card sm:mr-8", message.status === "draft" && "border-primary/40 ring-1 ring-primary/20")}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <MessageIcon aria-hidden className="size-3.5" />
              <span className="font-semibold text-foreground">{label(message)}</span>
              <span className="tabular-nums">{formatTimestamp(message.occurredAt, timeZone)}</span>
              {message.status === "draft" && <span className="rounded-full bg-primary px-2 py-0.5 font-semibold text-primary-foreground">{copy.draft}</span>}
              {message.status === "failed" && outbound && <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-semibold text-destructive">{copy.failed}</span>}
              {!outbound && copy.statuses[message.status] && <span className="rounded-full bg-muted px-2 py-0.5">{copy.statuses[message.status]}</span>}
            </div>
            {message.subject && <p className="mt-2 break-words text-sm font-medium">{message.subject}</p>}
            {message.status === "draft" ? <div className="mt-3"><DraftCard message={message} /></div> : <>
              <p className="mt-2 whitespace-pre-line break-words text-sm leading-6">{message.text || "—"}</p>
              {message.note && <p className="mt-2 text-xs text-muted-foreground">{message.note}</p>}
            </>}
          </li>;
        })}
      </ol>}
    </section>
    <div className="grid min-w-0 content-start gap-4 sm:gap-5 xl:col-span-4">
      <section aria-labelledby="conversation-reply" className="rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
        <form className="space-y-3" onSubmit={(event) => {
          event.preventDefault();
          action.run(() => sendStaffReplyAction({ leadId, body: reply }), copy.sent, () => setReply(""));
        }}>
          <label className="block space-y-2"><span id="conversation-reply" className="text-sm font-medium">{copy.replyLabel}</span>
            <textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={6} maxLength={8000} disabled={action.pending}
              placeholder={copy.replyPlaceholder} className={textareaClass} />
          </label>
          <p className="text-xs leading-5 text-muted-foreground">{`To ${email}. ${copy.replyHint}`}</p>
          <Button type="submit" className="min-h-11 w-full gap-2" disabled={action.pending || !reply.trim()}><Send aria-hidden className="size-4" />{action.pending ? copy.sending : copy.send}</Button>
        </form>
      </section>
      <section aria-label={copy.assistant(assistant.name)} className="grid gap-2 rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
        <Button variant="outline" className="min-h-11 justify-start gap-2" disabled={action.pending}
          onClick={() => action.run(() => requestAssistantDraftAction(leadId), copy.drafted)}>
          <Sparkles aria-hidden className="size-4" />{action.pending ? copy.drafting : copy.draftWithAi}
        </Button>
        {!thread.optedOut && <Button variant="ghost" className="min-h-11 justify-start gap-2" disabled={action.pending}
          onClick={() => action.run(() => setAssistantPausedAction({ leadId, paused: !thread.paused }), thread.paused ? copy.resumedSaved : copy.pausedSaved)}>
          {thread.paused ? <PlayCircle aria-hidden className="size-4" /> : <PauseCircle aria-hidden className="size-4" />}{thread.paused ? copy.resume : copy.pause}
        </Button>}
        {thread.paused && thread.pausedReason && <p className="text-xs leading-5 text-muted-foreground">{thread.pausedReason}</p>}
      </section>
    </div>
  </div>;
}
