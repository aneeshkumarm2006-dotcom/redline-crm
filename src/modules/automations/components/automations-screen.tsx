import Link from "next/link";
import { ArrowRight, CalendarClock, Clock3, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { KpiRow, StatCard } from "@/components/shared/stats/stat-card";
import { requestNow } from "@/lib/clock";
import { requirePageUser } from "@/modules/auth/page-guards";
import { startOfLocalMonth } from "@/modules/appointments/slots";
import { formatTimestamp } from "@/modules/inventory/copy";
import { getSettings } from "@/modules/settings/service";
import { countEmailsSince, listAutomationRuns, summarizeAutomationRuns, type RecipeRunStats } from "../service";
import { isAutomationRecipeKey, isRecipeEnabled, plannedRecipeKeys, recipeCatalog, recipeGroups, type AutomationRun } from "../schema";
import { automationsCopy as copy, plannedRecipes, recipeNames, recipeSentences, type RecipeSentenceValues } from "../copy";
import { AutomationsTabs } from "./automations-tabs";
import { RecipeSentence } from "./recipe-sentence";
import { RecipeToggle } from "./recipe-toggle";
import { RunNowButton } from "./run-now-button";

const outcomeStyles: Record<AutomationRun["outcome"], string> = {
  success: "bg-success/12 text-success", failed: "bg-danger/12 text-danger", skipped: "bg-muted text-muted-foreground",
};
const subjectHref = (subject: AutomationRun["subject"]) => ({
  lead: `/crm/leads/${subject.id}`, vehicle: `/crm/inventory/${subject.id}`, user: `/crm/team/${subject.id}`, appointment: null,
})[subject.type];

/** Owner page: every recipe as a "When X → do Y" sentence with its switch, run counts and history, plus Run now. */
export async function AutomationsScreen({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageUser("owner");
  const query = await searchParams;
  const recipe = typeof query.recipe === "string" && isAutomationRecipeKey(query.recipe) ? query.recipe : undefined;
  const settings = await getSettings();
  const now = requestNow();
  const zone = settings.booking.timeZone;
  const monthStart = new Date(startOfLocalMonth(now, zone)).toISOString();
  const [stats, runs, emails] = await Promise.all([
    summarizeAutomationRuns(monthStart), listAutomationRuns({ recipeKey: recipe, limit: 30 }), countEmailsSince(monthStart),
  ]);
  const values: RecipeSentenceValues = {
    appointmentStage: settings.leadStages.find((stage) => stage.key === settings.booking.appointmentStageKey)?.label ?? settings.booking.appointmentStageKey,
    warnDays: settings.inventoryAging.warnDays, criticalDays: settings.inventoryAging.criticalDays, repairOverdueDays: settings.repairOverdueDays,
    uncontactedHours: settings.uncontactedLeadHours, manualAssignment: settings.leadAssignmentStrategy === "manual",
  };
  const statsFor = (key: string): RecipeRunStats => stats.find((entry) => entry.key === key) ?? { key, runs: 0, success: 0, failed: 0, skipped: 0, lastRanAt: null, lastOutcome: null };
  const enabled = recipeCatalog.filter((entry) => isRecipeEnabled(settings.automations, entry.key)).length;
  const monthRuns = recipeCatalog.reduce((sum, entry) => sum + statsFor(entry.key).runs, 0);
  const monthFailed = recipeCatalog.reduce((sum, entry) => sum + statsFor(entry.key).failed, 0);

  return <>
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0"><h1 className="text-3xl font-semibold tracking-tight">{copy.title}</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">{copy.intro}</p></div>
      <RunNowButton />
    </header>
    <AutomationsTabs active="recipes" />

    <KpiRow label={copy.kpis}>
      <StatCard label={copy.activeRecipes} icon={Zap} value={enabled} hint={copy.activeHint(recipeCatalog.length)} />
      <StatCard label={copy.runsThisMonth} value={monthRuns} href="#recent-runs" />
      <StatCard label={copy.failedThisMonth} value={monthFailed} className={monthFailed ? "border-danger/40" : undefined} />
      <StatCard label={copy.emailsThisMonth} value={emails} hint={copy.emailsHint} href="/crm/automations/emails" />
    </KpiRow>

    {recipeGroups.map((group) => <section key={group} aria-labelledby={`recipes-${group}`} className="space-y-3">
      <div><h2 id={`recipes-${group}`} className="text-lg font-semibold">{copy.groups[group]}</h2><p className="text-sm text-muted-foreground">{copy.groupHints[group]}</p></div>
      <ul className="grid gap-3 lg:grid-cols-2">{recipeCatalog.filter((entry) => entry.group === group).map((entry) => {
        const stat = statsFor(entry.key);
        const on = isRecipeEnabled(settings.automations, entry.key);
        const TriggerIcon = entry.trigger === "schedule" ? CalendarClock : Zap;
        return <li key={entry.key} className={cn("flex min-w-0 flex-col gap-3 rounded-xl border border-l-[6px] bg-card p-4", on ? "border-l-success" : "border-l-muted-foreground/30")}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="break-words font-semibold">{recipeNames[entry.key]}</h3>
              <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground"><TriggerIcon aria-hidden className="size-3.5" />{copy.trigger[entry.trigger]}</span>
            </div>
            <RecipeToggle recipeKey={entry.key} name={recipeNames[entry.key]} enabled={on} />
          </div>
          <RecipeSentence text={recipeSentences[entry.key](values)} muted={!on} />
          <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
            <span><span className="font-semibold text-foreground tabular-nums">{copy.runs(stat.runs)}</span> {copy.thisMonth}{stat.runs > 0 && ` · ${copy.breakdown(stat.success, stat.skipped, stat.failed)}`}</span>
            <span className="inline-flex items-center gap-1"><Clock3 aria-hidden className="size-3.5" />{stat.lastRanAt ? copy.lastRan(formatTimestamp(stat.lastRanAt, zone)) : copy.neverRan}</span>
            <Link href={`/crm/automations?recipe=${entry.key}#recent-runs`} scroll={false} className="inline-flex min-h-11 items-center gap-1 font-medium text-foreground hover:underline">
              {copy.history}<ArrowRight aria-hidden className="size-3.5" />
            </Link>
          </div>
        </li>;
      })}</ul>
    </section>)}

    <section aria-labelledby="recipes-planned" className="space-y-3">
      <div><h2 id="recipes-planned" className="text-lg font-semibold">{copy.plannedLabel}</h2><p className="text-sm text-muted-foreground">{copy.comingSoonHint}</p></div>
      <ul className="grid gap-3 lg:grid-cols-2">{plannedRecipeKeys.map((key) => <li key={key} className="min-w-0 rounded-xl border border-dashed bg-card/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="break-words font-semibold text-muted-foreground">{plannedRecipes[key].name}</h3>
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">{copy.comingSoon}</span>
        </div>
        <RecipeSentence text={plannedRecipes[key].sentence} muted className="mt-2" />
      </li>)}</ul>
    </section>

    <section id="recent-runs" aria-labelledby="recent-runs-title" className="scroll-mt-20 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h2 id="recent-runs-title" className="text-lg font-semibold">{recipe ? copy.historyFor(recipeNames[recipe]) : copy.recent}</h2><p className="text-sm text-muted-foreground">{copy.recentHint}</p></div>
        {recipe && <Link href="/crm/automations#recent-runs" scroll={false} className="inline-flex min-h-11 items-center text-sm font-medium hover:underline">{copy.allRecipes}</Link>}
      </div>
      {!runs.length ? <p className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">{copy.noRuns}</p>
        : <ul className="divide-y rounded-xl border bg-card">{runs.map((run) => {
          const href = subjectHref(run.subject);
          const name = isAutomationRecipeKey(run.recipeKey) ? recipeNames[run.recipeKey] : run.recipeKey;
          return <li key={run.id} className="flex min-w-0 items-start gap-3 p-4">
            <span className={cn("mt-0.5 inline-flex min-h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-semibold", outcomeStyles[run.outcome])}>{copy.outcomes[run.outcome]}</span>
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-medium">{name}</p>
              {run.detail && <p className="break-words text-sm text-muted-foreground">{run.detail}</p>}
              <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                <time dateTime={run.ranAt}>{formatTimestamp(run.ranAt, zone)}</time>
                <span>{run.name === "schedule" ? copy.trigger.schedule : run.name}</span>
                {href && <Link href={href} className="font-medium text-foreground hover:underline">{`${copy.open} ${copy.subject[run.subject.type].toLowerCase()}`}</Link>}
              </p>
            </div>
          </li>;
        })}</ul>}
    </section>
  </>;
}
