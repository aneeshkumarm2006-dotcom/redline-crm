"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { sendTestEmailAction } from "../actions";
import { automationsCopy as copy } from "../copy";

type Status = { mode: string; from: string | null; host: string | null; replyTo: string | null; problems: string[] };

/** How email goes out right now, what is wrong with the setup (by setting name, never values), and a test send. */
export function EmailDeliveryCard({ status, defaultTo }: { status: Status; defaultTo: string }) {
  const [to, setTo] = useState(defaultTo);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const ready = status.problems.length === 0;
  const live = status.mode !== "console";
  const send = (event: React.FormEvent) => {
    event.preventDefault();
    setResult(null);
    start(async () => {
      const outcome = await sendTestEmailAction(to);
      setResult(outcome.ok ? { ok: true, message: live ? copy.delivery.sent(to) : copy.delivery.logged } : { ok: false, message: outcome.message });
    });
  };
  return <section aria-labelledby="email-delivery" className="grid gap-5 rounded-2xl border bg-card p-5 shadow-xs sm:p-6 xl:grid-cols-12">
    <div className="flex min-w-0 gap-4 xl:col-span-7">
      <span aria-hidden className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", ready && live ? "bg-success/12 text-success" : ready ? "bg-muted text-muted-foreground" : "bg-danger/12 text-danger")}>
        {ready ? <Mail className="size-5" /> : <AlertTriangle className="size-5" />}
      </span>
      <div className="min-w-0">
        <h2 id="email-delivery" className="text-[0.9375rem] font-semibold">{copy.delivery.title}</h2>
        <p className="mt-1 break-words text-sm text-muted-foreground">
          {status.mode === "smtp" ? copy.delivery.smtp(status.from ?? "—", status.host ?? "") : status.mode === "resend" ? copy.delivery.resend : copy.delivery.console}
          {status.replyTo && ` ${copy.delivery.replyTo(status.replyTo)}`}
        </p>
        {ready ? <p className={cn("mt-2 inline-flex items-center gap-1.5 text-sm font-medium", live ? "text-success" : "text-muted-foreground")}><CheckCircle2 aria-hidden className="size-4" />{live ? copy.delivery.ready : copy.delivery.notLive}</p>
          : <ul className="mt-2 space-y-1">{status.problems.map((problem) => <li key={problem} className="flex gap-2 text-sm font-medium text-danger"><AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />{problem}</li>)}</ul>}
      </div>
    </div>
    <form onSubmit={send} className="flex min-w-0 flex-col gap-2 xl:col-span-5">
      <label htmlFor="test-email" className="text-sm font-medium">{copy.delivery.testLabel}</label>
      <div className="flex gap-2">
        <Input id="test-email" type="email" required value={to} onChange={(event) => setTo(event.target.value)} className="min-h-11 flex-1" />
        <Button type="submit" variant="secondary" className="min-h-11 gap-2" disabled={pending}><Send aria-hidden className="size-4" />{pending ? copy.delivery.sending : copy.delivery.send}</Button>
      </div>
      {result && <p role="status" className={cn("text-sm font-medium", result.ok ? "text-success" : "text-danger")}>{result.message}</p>}
    </form>
  </section>;
}
