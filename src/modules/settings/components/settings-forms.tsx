"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Settings, SettingsSectionInput } from "../schema";
import { saveSettingsSectionAction } from "../actions";
import { settingsCopy as copy } from "../copy";
import { OptionListEditor, rowKey, rowsProblem, rowsToOptions, toRows, type OptionRow } from "./option-list-editor";

const selectClass = "min-h-11 w-full min-w-0 rounded-md border bg-background px-3 text-base";
const field = "block min-w-0 space-y-2";

/** Saves one settings section, then refreshes so every screen picks up the new labels and colours. */
function useSave() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  function save(input: SettingsSectionInput) {
    setError("");
    startTransition(async () => {
      try {
        const result = await saveSettingsSectionAction(input);
        if (!result.ok) { setError(result.message); toast.error(result.message); return; }
        toast.success(copy.saved);
        router.refresh();
      } catch { setError(copy.failed); toast.error(copy.failed); }
    });
  }
  return { pending, error, setError, save };
}

function SaveBar({ pending, error }: { pending: boolean; error: string }) {
  return <div className="sticky bottom-20 z-10 flex flex-wrap items-center justify-end gap-3 rounded-xl border bg-card/95 p-3 shadow-sm backdrop-blur lg:bottom-4">
    {error && <p role="alert" className="mr-auto text-sm text-destructive">{error}</p>}
    <Button type="submit" className="min-h-11" disabled={pending}>{pending ? copy.saving : copy.save}</Button>
  </div>;
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return <fieldset className="min-w-0 space-y-4 rounded-xl border bg-card p-4">
    <legend className="px-1 text-base font-semibold">{title}</legend>
    <p className="-mt-2 text-sm text-muted-foreground">{hint}</p>
    {children}
  </fieldset>;
}

export function BrandForm({ brand }: { brand: Settings["brand"] }) {
  const { pending, error, save } = useSave();
  const [color, setColor] = useState(brand.primaryColor);
  return <form className="space-y-4" onSubmit={(event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const logo = String(form.get("logoUrl") ?? "").trim();
    save({ section: "brand", data: { companyName: String(form.get("companyName") ?? "").trim(), logoUrl: logo || null, primaryColor: color.toUpperCase() } });
  }}>
    <Section title={copy.brand.title} hint={copy.brand.hint}>
      <label className={field}><span className="text-sm font-medium">{copy.brand.companyName}</span><Input name="companyName" defaultValue={brand.companyName} required maxLength={120} className="min-h-11 text-base" /></label>
      <label className={field}><span className="text-sm font-medium">{copy.brand.logoUrl}</span><Input name="logoUrl" type="url" defaultValue={brand.logoUrl ?? ""} placeholder="https://" className="min-h-11 text-base" />
        <span className="block text-xs text-muted-foreground">{copy.brand.logoHint}</span></label>
      <div className={field}><span className="text-sm font-medium" id="brand-color">{copy.brand.primaryColor}</span>
        <div className="flex items-center gap-2">
          <input type="color" aria-labelledby="brand-color" value={color.toLowerCase()} onChange={(event) => setColor(event.target.value)} className="size-11 shrink-0 cursor-pointer rounded-md border bg-transparent p-1" />
          <Input aria-labelledby="brand-color" value={color} onChange={(event) => setColor(event.target.value)} pattern="^#[0-9a-fA-F]{6}$" maxLength={7} className="min-h-11 w-32 font-mono text-base" />
          <span aria-hidden className="inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-white" style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(color) ? color : undefined }}>{brand.companyName}</span>
        </div>
      </div>
    </Section>
    <SaveBar pending={pending} error={error} />
  </form>;
}

export function InventorySettingsForm({ settings }: { settings: Pick<Settings, "vehicleStatuses" | "repairTypes" | "statusRoles" | "publicInventoryStatusKeys"> }) {
  const { pending, error, setError, save } = useSave();
  const [statuses, setStatuses] = useState<OptionRow[]>(toRows(settings.vehicleStatuses));
  const [repairTypes, setRepairTypes] = useState<OptionRow[]>(toRows(settings.repairTypes));
  const [roles, setRoles] = useState(settings.statusRoles);
  const [publicKeys, setPublicKeys] = useState(settings.publicInventoryStatusKeys);
  const statusOptions = statuses.map((row) => ({ key: rowKey(row), label: row.label.trim() || rowKey(row) }));
  return <form className="space-y-4" onSubmit={(event) => {
    event.preventDefault();
    const problem = rowsProblem(statuses) ?? rowsProblem(repairTypes);
    if (problem) { setError(problem); return; }
    const keys = new Set(statusOptions.map((option) => option.key));
    save({ section: "inventory", data: { vehicleStatuses: rowsToOptions(statuses), repairTypes: rowsToOptions(repairTypes), statusRoles: roles,
      publicInventoryStatusKeys: publicKeys.filter((key) => keys.has(key)) } });
  }}>
    <OptionListEditor title={copy.inventory.statuses} hint={copy.inventory.statusesHint} rows={statuses} onChange={setStatuses} ordered />
    <Section title={copy.inventory.roles} hint={copy.inventory.rolesHint}>
      <div className="grid gap-3 sm:grid-cols-3">{(Object.keys(copy.inventory.role) as (keyof typeof roles)[]).map((role) => <label key={role} className={field}>
        <span className="text-sm font-medium">{copy.inventory.role[role]}</span>
        <select value={roles[role]} onChange={(event) => setRoles({ ...roles, [role]: event.target.value })} className={selectClass}>
          {!statusOptions.some((option) => option.key === roles[role]) && <option value={roles[role]}>{roles[role]}</option>}
          {statusOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
        </select>
      </label>)}</div>
    </Section>
    <Section title={copy.inventory.public} hint={copy.inventory.publicHint}>
      <div className="flex flex-wrap gap-2">{statusOptions.map((option) => <label key={option.key} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm">
        <input type="checkbox" className="size-5 accent-primary" checked={publicKeys.includes(option.key)}
          onChange={(event) => setPublicKeys(event.target.checked ? [...publicKeys, option.key] : publicKeys.filter((key) => key !== option.key))} />{option.label}
      </label>)}</div>
    </Section>
    <OptionListEditor title={copy.inventory.repairTypes} hint={copy.inventory.repairTypesHint} rows={repairTypes} onChange={setRepairTypes} />
    <SaveBar pending={pending} error={error} />
  </form>;
}

export function LeadSettingsForm({ settings }: { settings: Pick<Settings, "leadStages" | "leadSources" | "wonStageKey" | "lostStageKey" | "publicInquirySourceKey" | "booking"> }) {
  const { pending, error, setError, save } = useSave();
  const [stages, setStages] = useState<OptionRow[]>(toRows(settings.leadStages.toSorted((a, b) => a.order - b.order)));
  const [sources, setSources] = useState<OptionRow[]>(toRows(settings.leadSources));
  const [roles, setRoles] = useState({ wonStageKey: settings.wonStageKey, lostStageKey: settings.lostStageKey, appointmentStageKey: settings.booking.appointmentStageKey });
  const [publicSource, setPublicSource] = useState(settings.publicInquirySourceKey);
  const stageOptions = stages.map((row) => ({ key: rowKey(row), label: row.label.trim() || rowKey(row) }));
  const sourceOptions = sources.map((row) => ({ key: rowKey(row), label: row.label.trim() || rowKey(row) }));
  const choose = (options: { key: string; label: string }[], value: string) => <>
    {!options.some((option) => option.key === value) && <option value={value}>{value}</option>}
    {options.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
  </>;
  return <form className="space-y-4" onSubmit={(event) => {
    event.preventDefault();
    const problem = rowsProblem(stages) ?? rowsProblem(sources);
    if (problem) { setError(problem); return; }
    save({ section: "leads", data: { leadStages: rowsToOptions(stages).map((stage, order) => ({ ...stage, order })), leadSources: rowsToOptions(sources), ...roles, publicInquirySourceKey: publicSource } });
  }}>
    <OptionListEditor title={copy.leads.stages} hint={copy.leads.stagesHint} rows={stages} onChange={setStages} ordered />
    <Section title={copy.leads.roles} hint={copy.leads.rolesHint}>
      <div className="grid gap-3 sm:grid-cols-3">{([["appointmentStageKey", copy.leads.appointment], ["wonStageKey", copy.leads.won], ["lostStageKey", copy.leads.lost]] as const).map(([role, label]) => <label key={role} className={field}>
        <span className="text-sm font-medium">{label}</span>
        <select value={roles[role]} onChange={(event) => setRoles({ ...roles, [role]: event.target.value })} className={selectClass}>{choose(stageOptions, roles[role])}</select>
      </label>)}</div>
    </Section>
    <OptionListEditor title={copy.leads.sources} hint={copy.leads.sourcesHint} rows={sources} onChange={setSources} />
    <Section title={copy.leads.publicSource} hint={copy.leads.publicSourceHint}>
      <select aria-label={copy.leads.publicSource} value={publicSource} onChange={(event) => setPublicSource(event.target.value)} className={`${selectClass} sm:max-w-xs`}>{choose(sourceOptions, publicSource)}</select>
    </Section>
    <SaveBar pending={pending} error={error} />
  </form>;
}

export function ThresholdsForm({ settings }: { settings: Pick<Settings, "inventoryAging" | "repairOverdueDays" | "uncontactedLeadHours"> }) {
  const { pending, error, save } = useSave();
  const fields = [
    ["warnDays", copy.thresholds.warnDays, settings.inventoryAging.warnDays, 3650],
    ["criticalDays", copy.thresholds.criticalDays, settings.inventoryAging.criticalDays, 3650],
    ["repairOverdueDays", copy.thresholds.repairOverdueDays, settings.repairOverdueDays, 365],
    ["uncontactedLeadHours", copy.thresholds.uncontactedLeadHours, settings.uncontactedLeadHours, 720],
  ] as const;
  return <form className="space-y-4" onSubmit={(event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const number = (name: string) => Number(form.get(name));
    save({ section: "thresholds", data: { inventoryAging: { warnDays: number("warnDays"), criticalDays: number("criticalDays") },
      repairOverdueDays: number("repairOverdueDays"), uncontactedLeadHours: number("uncontactedLeadHours") } });
  }}>
    <Section title={copy.thresholds.title} hint={copy.thresholds.hint}>
      <div className="grid gap-3 sm:grid-cols-2">{fields.map(([name, label, value, max]) => <label key={name} className={field}>
        <span className="text-sm font-medium">{label}</span>
        <Input name={name} type="number" inputMode="numeric" min={1} max={max} step={1} defaultValue={value} required className="min-h-11 text-base" />
      </label>)}</div>
    </Section>
    <SaveBar pending={pending} error={error} />
  </form>;
}
