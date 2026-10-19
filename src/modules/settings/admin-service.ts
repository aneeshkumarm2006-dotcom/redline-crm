import "server-only";
import { requireRole } from "@/modules/auth/service";
import { findGarageSpecialtiesInUse } from "@/modules/garages/service";
import { findVehicleKeysInUse } from "@/modules/inventory/service";
import { findLeadKeysInUse } from "@/modules/leads/service";
import { getSettings, replaceSettings, SettingsError } from "./service";
import { settingsSectionSchema, type Settings } from "./schema";
import { settingsCopy as copy } from "./copy";

/**
 * Owner settings screen: saves one section. Keys of existing statuses, stages, sources and repair types never change
 * (records store them); a key can be removed only when no vehicle, lead or garage still uses it. Cross-references
 * are checked by `replaceSettings`. Lives apart from `settings/service` so that service imports no other module.
 */
const removed = (before: { key: string }[], after: { key: string }[]) => before.filter((entry) => !after.some((next) => next.key === entry.key)).map((entry) => entry.key);
const labelOf = (list: { key: string; label: string }[], key: string) => list.find((entry) => entry.key === key)?.label ?? key;

export async function saveSettingsSection(input: unknown) {
  await requireRole("owner");
  const { section, data } = settingsSectionSchema.parse(input);
  const current = await getSettings();
  let next: Settings;
  if (section === "brand") next = { ...current, brand: data };
  else if (section === "thresholds") next = { ...current, ...data };
  else if (section === "inventory") {
    const statuses = removed(current.vehicleStatuses, data.vehicleStatuses);
    const repairTypes = removed(current.repairTypes, data.repairTypes);
    const [vehicles, garages] = await Promise.all([findVehicleKeysInUse({ statuses, repairTypes }), findGarageSpecialtiesInUse(repairTypes)]);
    const blocked = [
      ...vehicles.statuses.map((key) => copy.errors.statusInUse(labelOf(current.vehicleStatuses, key))),
      ...vehicles.repairTypes.map((key) => copy.errors.repairTypeInUse(labelOf(current.repairTypes, key))),
      ...garages.filter((key) => !vehicles.repairTypes.includes(key)).map((key) => copy.errors.specialtyInUse(labelOf(current.repairTypes, key))),
    ];
    if (blocked.length) throw new SettingsError(blocked.join(" "));
    next = { ...current, ...data };
  } else {
    const stages = removed(current.leadStages, data.leadStages);
    const sources = removed(current.leadSources, data.leadSources);
    const leads = await findLeadKeysInUse({ stages, sources });
    const blocked = [
      ...leads.stages.map((key) => copy.errors.stageInUse(labelOf(current.leadStages, key))),
      ...leads.sources.map((key) => copy.errors.sourceInUse(labelOf(current.leadSources, key))),
    ];
    if (blocked.length) throw new SettingsError(blocked.join(" "));
    const { appointmentStageKey, ...rest } = data;
    // Order follows the list order on screen.
    next = { ...current, ...rest, leadStages: rest.leadStages.map((stage, order) => ({ ...stage, order })), booking: { ...current.booking, appointmentStageKey } };
  }
  await replaceSettings(next);
}
