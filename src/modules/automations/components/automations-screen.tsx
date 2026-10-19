import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, CarFront, Clock3, Mail, Play, UserPlus, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { emailDeliveryStatus } from "@/lib/email/provider";
import { EmailDeliveryCard } from "./email-delivery-card";
import { requestNow } from "@/lib/clock";
import { requirePageUser } from "@/modules/auth/page-guards";
import { startOfLocalMonth } from "@/modules/appointments/slots";
import { formatTimestamp } from "@/modules/inventory/copy";
import { getSettings } from "@/modules/settings/service";
import { countEmailsSince, listAutomationRuns, summarizeAutomationRuns, type RecipeRunStats } from "../service";
import { isAutomationRecipeKey, isRecipeEnabled, plannedRecipeKeys, recipeCatalog, recipeGroups, type AutomationRun, type RecipeGroup } from "../schema";
import { automationsCopy as copy, plannedRecipes, recipeNames, recipeSentences, type RecipeSentenceValues } from "../copy";
import { AutomationsTabs } from "./automations-tabs";
import { RecipeSentence } from "./recipe-sentence";
import { RecipeToggle } from "./recipe-toggle";
import { RunNowButton } from "./run-now-button";

const outcomeStyles: Record<AutomationRun["outcome"], string> = {
  success: "bg-success/12 text-success", failed: "bg-danger/12 text-danger", skipped: "bg-muted text-muted-foreground",
};
const outcomeDots: Record<AutomationRun["outcome"], string> = { success: "bg-success", failed: "bg-danger", skipped: "bg-muted-foreground/50" };
/** Each recipe category gets its own tinted icon tile, so the grid reads by group at a glance. */
const groupTiles: Record<RecipeGroup, { icon: LucideIcon; tile: string }> = {
  leads: { icon: UserPlus, tile: "bg-info/12 text-info" },
  inventory: { icon: CarFront, tile: "bg-warning/12 text-warning" },
  reminders: { icon: CalendarClock, tile: "bg-brand-soft text-primary" },
};
const subjectHref = (subject: AutomationRun["subject"]) => ({
  lead: `/crm/leads/${subject.id}`, vehicle: `/crm/inventory/${subject.id}`, user: `/crm/team/${subject.id}`, appointment: null,
})[subject.type];
const panel = "rounded-2xl border bg-card shadow-xs";
const lift = "transition-[border-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-md";

/** One figure in the dark KPI strip; links to its section when `href` is set. */
function InkStat({ label, value, hint, icon: Icon, href, alert }: { label: string; value: number; hint?: string; icon: LucideIcon; href?: string; alert?: boolean }) {
  const body = <>
    <span className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 items-center gap-2 text-[0.8125rem] font-medium text-ink-muted">
        {alert && <span aria-hidden className="size-2 shrink-0 rounded-full bg-primary ring-4 ring-primary/25" />}<span className="truncate">{label}</span>
      </span>
      <span aria-hidden className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", alert ? "bg-primary text-primary-foreground" : "bg-white/[0.07] text-ink-foreground")}><Icon className="size-[1.125rem]" /></span>
    </span>
    <span className="font-display mt-3 block text-[1.75rem] leading-none font-semibold tabular-nums sm:text-[2rem]">{value}</span>
    {hint && <span className="mt-2.5 block truncate text-xs text-ink-muted">{hint}</span>}
  </>;
  const classes = "block min-w-0 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-4 sm:p-5";
  return href
    ? <Link href={href} className={cn(classes, "transition-[background-color,transform] duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring")}>{body}</Link>
    : <div className={classes}>{body}</div>;
}

/** Owner page: every recipe as a "When X → do Y" sentence with its switch, run counts and history, plus Run now. */
export async function AutomationsScreen({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePageUser("owner");
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
    followUpDays: settings.customerFollowUpDays, uncontactedHours: settings.uncontactedLeadHours, manualAssignment: settings.leadAssignmentStrategy === "manual",
  };
  const statsFor = (key: string): RecipeRunStats => stats.find((entry) => entry.key === key) ?? { key, runs: 0, success: 0, failed: 0, skipped: 0, lastRanAt: null, lastOutcome: null };
  const enabled = recipeCatalog.filter((entry) => isRecipeEnabled(settings.automations, entry.key)).length;
  const monthRuns = recipeCatalog.reduce((sum, entry) => sum + statsFor(entry.key).runs, 0);
  const monthFailed = recipeCatalog.reduce((sum, entry) => sum + statsFor(entry.key).failed, 0);

  return <>
    <PageHeader title={copy.title} description={copy.intro} actions={<RunNowButton />}>
      <AutomationsTabs active="recipes" />
    </PageHeader>

    <section aria-label={copy.kpis} className="ink-glow rounded-[1.25rem] bg-ink p-4 text-ink-foreground sm:p-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <InkStat label={copy.activeRecipes} icon={Zap} value={enabled} hint={copy.activeHint(recipeCatalog.length)} />
        <InkStat label={copy.runsThisMonth} icon={Play} value={monthRuns} href="#recent-runs" />
        <InkStat label={copy.failedThisMonth} icon={AlertTriangle} value={monthFailed} alert={monthFailed > 0} />
        <InkStat label={copy.emailsThisMonth} icon={Mail} value={emails} hint={copy.emailsHint} href="/crm/automations/emails" />
      </div>
    </section>

    <EmailDeliveryCard status={emailDeliveryStatus()} defaultTo={user.email} />

    {recipeGroups.map((group) => {
      const { icon: GroupIcon, tile } = groupTiles[group];
      return <section key={group} aria-labelledby={`recipes-${group}`} className="grid gap-4 xl:grid-cols-12 xl:gap-6">
        <div className="flex items-start gap-3 xl:col-span-3">
          <span aria-hidden className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", tile)}><GroupIcon className="size-5" /></span>
          <div className="min-w-0"><h2 id={`recipes-${group}`} className="text-lg font-semibold tracking-tight">{copy.groups[group]}</h2><p className="mt-0.5 text-sm text-muted-foreground">{copy.groupHints[group]}</p></div>
        </div>
        <ul className="grid min-w-0 gap-4 md:grid-cols-2 xl:col-span-9">{recipeCatalog.filter((entry) => entry.group === group).map((entry) => {
          const stat = statsFor(entry.key);
          const on = isRecipeEnabled(settings.automations, entry.key);
          const TriggerIcon = entry.trigger === "schedule" ? CalendarClock : Zap;
          return <li key={entry.key} className={cn(panel, lift, "flex min-w-0 flex-col gap-4 p-5")}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span aria-hidden className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl transition-opacity", tile, !on && "opacity-60")}><GroupIcon className="size-5" /></span>
                <div className="min-w-0">
                  <h3 className="break-words font-semibold tracking-tight">{recipeNames[entry.key]}</h3>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                    <span className={cn("inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 font-semibold", on ? "bg-success/12 text-success" : "bg-muted text-muted-foreground")}>
                      <span aria-hidden className={cn("size-1.5 rounded-full", on ? "bg-success" : "bg-muted-foreground/60")} />{on ? copy.on : copy.off}
                    </span>
                    <span className="inline-flex items-center gap-1"><TriggerIcon aria-hidden className="size-3.5" />{copy.trigger[entry.trigger]}</span>
                  </span>
                </div>
              </div>
              <RecipeToggle recipeKey={entry.key} name={recipeNames[entry.key]} enabled={on} />
            </div>
            <RecipeSentence text={recipeSentences[entry.key](values)} muted={!on} />
            <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
              <span><span className="font-semibold text-foreground tabular-nums">{copy.runs(stat.runs)}</span> {copy.thisMonth}{stat.runs > 0 && ` · ${copy.breakdown(stat.success, stat.skipped, stat.failed)}`}</span>
              <span className="inline-flex items-center gap-1"><Clock3 aria-hidden className="size-3.5" />{stat.lastRanAt ? copy.lastRan(formatTimestamp(stat.lastRanAt, zone)) : copy.neverRan}</span>
              <Link href={`/crm/automations?recipe=${entry.key}#recent-runs`} scroll={false} className="group/link inline-flex min-h-11 items-center gap-1 font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring">
                {copy.history}<ArrowRight aria-hidden className="size-3.5 transition-transform duration-200 group-hover/link:translate-x-0.5" />
              </Link>
            </div>
          </li>;
        })}</ul>
      </section>;
    })}

    <div className="grid gap-6 xl:grid-cols-12">
      <section id="recent-runs" aria-labelledby="recent-runs-title" className="min-w-0 scroll-mt-20 space-y-4 xl:col-span-8">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0"><h2 id="recent-runs-title" className="text-lg font-semibold tracking-tight">{recipe ? copy.historyFor(recipeNames[recipe]) : copy.recent}</h2><p className="mt-0.5 text-sm text-muted-foreground">{copy.recentHint}</p></div>
          {recipe && <Link href="/crm/automations#recent-runs" scroll={false} className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring">{copy.allRecipes}</Link>}
        </div>
        {!runs.length ? <p className="rounded-2xl border border-dashed bg-card p-5 text-sm text-muted-foreground">{copy.noRuns}</p>
          : <ul className="divide-y overflow-clip rounded-2xl border bg-card shadow-xs">{runs.map((run) => {
            const href = subjectHref(run.subject);
            const name = isAutomationRecipeKey(run.recipeKey) ? recipeNames[run.recipeKey] : run.recipeKey;
            return <li key={run.id} className="flex min-w-0 flex-col gap-2 p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-start sm:gap-4 sm:px-5">
              <span className={cn("inline-flex min-h-6 w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold sm:mt-0.5", outcomeStyles[run.outcome])}>
                <span aria-hidden className={cn("size-1.5 rounded-full", outcomeDots[run.outcome])} />{copy.outcomes[run.outcome]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium">{name}</p>
                {run.detail && <p className="break-words text-sm text-muted-foreground">{run.detail}</p>}
                <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  <time dateTime={run.ranAt} className="tabular-nums">{formatTimestamp(run.ranAt, zone)}</time>
                  <span>{run.name === "schedule" ? copy.trigger.schedule : run.name}</span>
                  {href && <Link href={href} className="font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring">{`${copy.open} ${copy.subject[run.subject.type].toLowerCase()}`}</Link>}
                </p>
              </div>
            </li>;
          })}</ul>}
      </section>

      <section aria-labelledby="recipes-planned" className="min-w-0 space-y-4 xl:col-span-4">
        <div><h2 id="recipes-planned" className="text-lg font-semibold tracking-tight">{copy.plannedLabel}</h2><p className="mt-0.5 text-sm text-muted-foreground">{copy.comingSoonHint}</p></div>
        <ul className="divide-y overflow-clip rounded-2xl border border-dashed bg-card/70">{plannedRecipeKeys.map((key) => <li key={key} className="min-w-0 p-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="break-words font-semibold text-muted-foreground">{plannedRecipes[key].name}</h3>
            <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">{copy.comingSoon}</span>
          </div>
          <RecipeSentence text={plannedRecipes[key].sentence} muted className="mt-2" />
        </li>)}</ul>
      </section>
    </div>
  </>;
}
