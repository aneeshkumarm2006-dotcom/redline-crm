import "server-only";

const scheduler = Symbol.for("redline.automationScheduler");
type Holder = typeof globalThis & { [scheduler]?: ReturnType<typeof setInterval> };

/**
 * In-process timer for the scheduled reminders (aging stock, overdue repairs, uncontacted leads, appointment
 * reminders, customer follow-ups) on long-running servers, e.g. `next dev` or `next start`.
 *
 * Every reminder is claimed in `automation_runs` under a deterministic key before it acts, so running often, or
 * alongside Vercel Cron, never sends anything twice. On by default outside production (every 15 minutes); set
 * AUTOMATION_INTERVAL_MINUTES to enable it in production or change the cadence, or 0 to turn it off. Serverless
 * deployments rely on `/api/cron` instead.
 */
export function startAutomationScheduler() {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const configured = process.env.AUTOMATION_INTERVAL_MINUTES;
  const minutes = configured === undefined ? (process.env.NODE_ENV === "production" ? 0 : 15) : Number(configured);
  if (!Number.isFinite(minutes) || minutes <= 0) return;
  const holder = globalThis as Holder;
  // Hot reloads re-run instrumentation; keep a single timer per process.
  if (holder[scheduler]) clearInterval(holder[scheduler]);
  const run = async () => {
    try {
      const { runScheduledAutomations } = await import("@/modules/automations/reminders");
      await runScheduledAutomations(Date.now());
    } catch {
      console.error("Scheduled automations failed; the next run will retry.");
    }
  };
  setTimeout(run, 30_000).unref();
  holder[scheduler] = setInterval(run, Math.max(1, minutes) * 60_000);
  holder[scheduler].unref();
  console.info(`Automation scheduler running every ${minutes} minute(s).`);
}

const assistantTimer = Symbol.for("redline.assistantScheduler");
type AssistantHolder = typeof globalThis & { [assistantTimer]?: ReturnType<typeof setInterval> };

/**
 * In-process timer for the virtual assistant on long-running servers: reads the reply inbox and answers waiting
 * customer emails. Every 60 seconds by default outside production; ASSISTANT_POLL_SECONDS changes it (0 turns it off).
 * Serverless deployments call `/api/assistant/poll` from a scheduler instead. Polls never overlap or store twice.
 */
export function startAssistantScheduler() {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const configured = process.env.ASSISTANT_POLL_SECONDS;
  const seconds = configured === undefined || configured === "" ? (process.env.NODE_ENV === "production" ? 0 : 60) : Number(configured);
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const holder = globalThis as AssistantHolder;
  if (holder[assistantTimer]) clearInterval(holder[assistantTimer]);
  const run = async () => {
    try {
      const { runAssistantCycle } = await import("@/modules/assistant/inbox");
      await runAssistantCycle(Date.now());
    } catch {
      console.error("Assistant cycle failed; the next run will retry.");
    }
  };
  holder[assistantTimer] = setInterval(run, Math.max(15, seconds) * 1000);
  holder[assistantTimer].unref();
  console.info(`Assistant inbox check running every ${Math.max(15, seconds)} second(s).`);
}
