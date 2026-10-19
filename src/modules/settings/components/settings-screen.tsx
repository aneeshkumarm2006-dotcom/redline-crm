import Link from "next/link";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { requirePageUser } from "@/modules/auth/page-guards";
import { listEmailTemplates } from "@/modules/email-templates/service";
import { TemplatesAdmin } from "@/modules/email-templates/components/templates-admin";
import { listGarages } from "@/modules/garages/service";
import { GaragesAdmin } from "@/modules/garages/components/garages-admin";
import { getSettings } from "../service";
import { settingsCopy as copy } from "../copy";
import { BrandForm, InventorySettingsForm, LeadSettingsForm, ThresholdsForm } from "./settings-forms";

const tabs = ["brand", "inventory", "leads", "thresholds", "garages", "templates"] as const;
type Tab = (typeof tabs)[number];

/** Owner settings: one tab per area, each saved on its own. Forms remount after a save so they show what was stored. */
export async function SettingsScreen({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageUser("owner");
  const query = await searchParams;
  const tab: Tab = tabs.find((entry) => entry === query.tab) ?? "brand";
  const settings = await getSettings();
  const version = (value: unknown) => JSON.stringify(value);
  return <>
    <PageHeader title={copy.title} description={copy.intro}>
      <nav aria-label={copy.tabsLabel} className="scrollbar-thin flex w-full gap-1 overflow-x-auto rounded-xl bg-muted p-1 sm:w-fit">
        {tabs.map((entry) => <Link key={entry} href={entry === "brand" ? "/crm/settings" : `/crm/settings?tab=${entry}`} scroll={false} aria-current={tab === entry ? "page" : undefined}
          className={cn("inline-flex min-h-9 shrink-0 items-center rounded-lg px-3.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11",
            tab === entry ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground")}>{copy.tabs[entry]}</Link>)}
      </nav>
    </PageHeader>
    {tab === "brand" && <BrandForm key={version(settings.brand)} brand={settings.brand} />}
    {tab === "inventory" && <InventorySettingsForm key={version([settings.vehicleStatuses, settings.repairTypes, settings.statusRoles, settings.publicInventoryStatusKeys])} settings={settings} />}
    {tab === "leads" && <LeadSettingsForm key={version([settings.leadStages, settings.leadSources, settings.wonStageKey, settings.lostStageKey, settings.booking.appointmentStageKey, settings.publicInquirySourceKey])} settings={settings} />}
    {tab === "thresholds" && <ThresholdsForm key={version([settings.inventoryAging, settings.repairOverdueDays, settings.uncontactedLeadHours])} settings={settings} />}
    {tab === "garages" && <GaragesAdmin garages={await listGarages()} repairTypes={settings.repairTypes} primaryColor={settings.brand.primaryColor} />}
    {tab === "templates" && <TemplatesAdmin templates={await listEmailTemplates()} brand={settings.brand} />}
  </>;
}
