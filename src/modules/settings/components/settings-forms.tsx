"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownField, type DropdownOption } from "@/components/ui/dropdown-field";
import { Input } from "@/components/ui/input";
import type { Settings, SettingsSectionInput } from "../schema";
import { saveSettingsSectionAction } from "../actions";
import { settingsCopy as copy } from "../copy";
import { OptionListEditor, rowKey, rowsProblem, rowsToOptions, toRows, type OptionRow } from "./option-list-editor";

/** Options for a role picker; a saved key that is no longer in the list still shows, as its raw key. */
const choose = (options: { key: string; label: string }[], value: string): DropdownOption[] => [
  ...(options.some((option) => option.key === value) ? [] : [{ value, label: value }]),
  ...options.map((option) => ({ value: option.key, label: option.label })),
];
const field = "block min-w-0 space-y-2";
const inputClass = "min-h-11 text-base md:text-sm";

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
  return <div className="flex flex-wrap items-center justify-end gap-3 rounded-2xl border bg-card px-5 py-4 shadow-xs sm:px-6">
    {error && <p role="alert" className="mr-auto min-w-0 break-words text-sm font-medium text-destructive">{error}</p>}
    <Button type="submit" className="min-h-11 min-w-32" disabled={pending}>{pending ? copy.saving : copy.save}</Button>
  </div>;
}

/** A settings panel: title and hint, then its fields. */
function Section({ title, hint, children, className }: { title: string; hint: string; children: React.ReactNode; className?: string }) {
  return <div className={cn("min-w-0 rounded-2xl border bg-card p-5 shadow-xs sm:p-6", className)}><fieldset className="min-w-0">
    <legend className="text-lg font-semibold tracking-tight">{title}</legend>
    <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    <div className="mt-5">{children}</div>
  </fieldset></div>;
}

export function BrandForm({ brand }: { brand: Settings["brand"] }) {
  const { pending, error, save } = useSave();
  const [color, setColor] = useState(brand.primaryColor);
  return <form className="space-y-5" onSubmit={(event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const logo = String(form.get("logoUrl") ?? "").trim();
    save({ section: "brand", data: { companyName: String(form.get("companyName") ?? "").trim(), logoUrl: logo || null, primaryColor: color.toUpperCase() } });
  }}>
    <Section title={copy.brand.title} hint={copy.brand.hint}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <label className={field}><span className="text-sm font-medium">{copy.brand.companyName}</span><Input name="companyName" defaultValue={brand.companyName} required maxLength={120} className={inputClass} /></label>
        <label className={field}><span className="text-sm font-medium">{copy.brand.logoUrl}</span><Input name="logoUrl" type="url" defaultValue={brand.logoUrl ?? ""} placeholder="https://" className={inputClass} />
          <span className="block text-xs text-muted-foreground">{copy.brand.logoHint}</span></label>
        <div className={cn(field, "sm:col-span-2 xl:col-span-1")}><span className="block text-sm font-medium" id="brand-color">{copy.brand.primaryColor}</span>
          <div className="flex flex-wrap items-center gap-2">
            <input type="color" aria-labelledby="brand-color" value={color.toLowerCase()} onChange={(event) => setColor(event.target.value)} className="size-11 shrink-0 cursor-pointer rounded-lg border border-input bg-card p-1 shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" />
            <Input aria-labelledby="brand-color" value={color} onChange={(event) => setColor(event.target.value)} pattern="^#[0-9a-fA-F]{6}$" maxLength={7} className="min-h-11 w-32 font-mono text-base md:text-sm" />
            <span aria-hidden className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm" style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(color) ? color : undefined }}>{brand.companyName}</span>
          </div>
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
  return <form className="space-y-5" onSubmit={(event) => {
    event.preventDefault();
    const problem = rowsProblem(statuses) ?? rowsProblem(repairTypes);
    if (problem) { setError(problem); return; }
    const keys = new Set(statusOptions.map((option) => option.key));
    save({ section: "inventory", data: { vehicleStatuses: rowsToOptions(statuses), repairTypes: rowsToOptions(repairTypes), statusRoles: roles,
      publicInventoryStatusKeys: publicKeys.filter((key) => keys.has(key)) } });
  }}>
    <div className="grid items-start gap-5 xl:grid-cols-12">
    <OptionListEditor title={copy.inventory.statuses} hint={copy.inventory.statusesHint} rows={statuses} onChange={setStatuses} ordered className="xl:col-span-7" />
    <div className="grid min-w-0 gap-5 xl:col-span-5">
    <Section title={copy.inventory.roles} hint={copy.inventory.rolesHint}>
      <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">{(Object.keys(copy.inventory.role) as (keyof typeof roles)[]).map((role) => <label key={role} className={field}>
        <span className="text-sm font-medium">{copy.inventory.role[role]}</span>
        <DropdownField value={roles[role]} onValueChange={(next) => setRoles({ ...roles, [role]: next })} options={choose(statusOptions, roles[role])} />
      </label>)}</div>
    </Section>
    <Section title={copy.inventory.public} hint={copy.inventory.publicHint}>
      <div className="flex flex-wrap gap-2">{statusOptions.map((option) => <label key={option.key} className="inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border border-input bg-card px-3.5 text-sm font-medium shadow-xs transition-colors hover:border-foreground/25 has-checked:border-primary/40 has-checked:bg-brand-soft has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring">
        <input type="checkbox" className="size-5 accent-primary" checked={publicKeys.includes(option.key)}
          onChange={(event) => setPublicKeys(event.target.checked ? [...publicKeys, option.key] : publicKeys.filter((key) => key !== option.key))} />{option.label}
      </label>)}</div>
    </Section>
    <OptionListEditor title={copy.inventory.repairTypes} hint={copy.inventory.repairTypesHint} rows={repairTypes} onChange={setRepairTypes} />
    </div>
    </div>
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
  return <form className="space-y-5" onSubmit={(event) => {
    event.preventDefault();
    const problem = rowsProblem(stages) ?? rowsProblem(sources);
    if (problem) { setError(problem); return; }
    save({ section: "leads", data: { leadStages: rowsToOptions(stages).map((stage, order) => ({ ...stage, order })), leadSources: rowsToOptions(sources), ...roles, publicInquirySourceKey: publicSource } });
  }}>
    <div className="grid items-start gap-5 xl:grid-cols-12">
    <OptionListEditor title={copy.leads.stages} hint={copy.leads.stagesHint} rows={stages} onChange={setStages} ordered className="xl:col-span-7" />
    <div className="grid min-w-0 gap-5 xl:col-span-5">
    <Section title={copy.leads.roles} hint={copy.leads.rolesHint}>
      <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">{([["appointmentStageKey", copy.leads.appointment], ["wonStageKey", copy.leads.won], ["lostStageKey", copy.leads.lost]] as const).map(([role, label]) => <label key={role} className={field}>
        <span className="text-sm font-medium">{label}</span>
        <DropdownField value={roles[role]} onValueChange={(next) => setRoles({ ...roles, [role]: next })} options={choose(stageOptions, roles[role])} />
      </label>)}</div>
    </Section>
    <OptionListEditor title={copy.leads.sources} hint={copy.leads.sourcesHint} rows={sources} onChange={setSources} />
    <Section title={copy.leads.publicSource} hint={copy.leads.publicSourceHint}>
      <DropdownField label={copy.leads.publicSource} value={publicSource} onValueChange={setPublicSource} options={choose(sourceOptions, publicSource)} className="sm:max-w-xs" />
    </Section>
    </div>
    </div>
    <SaveBar pending={pending} error={error} />
  </form>;
}

export function ThresholdsForm({ settings }: { settings: Pick<Settings, "inventoryAging" | "repairOverdueDays" | "uncontactedLeadHours" | "customerFollowUpDays"> }) {
  const { pending, error, save } = useSave();
  const fields = [
    ["warnDays", copy.thresholds.warnDays, settings.inventoryAging.warnDays, 3650],
    ["criticalDays", copy.thresholds.criticalDays, settings.inventoryAging.criticalDays, 3650],
    ["repairOverdueDays", copy.thresholds.repairOverdueDays, settings.repairOverdueDays, 365],
    ["uncontactedLeadHours", copy.thresholds.uncontactedLeadHours, settings.uncontactedLeadHours, 720],
  ] as const;
  return <form className="space-y-5" onSubmit={(event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const number = (name: string) => Number(form.get(name));
    save({ section: "thresholds", data: { inventoryAging: { warnDays: number("warnDays"), criticalDays: number("criticalDays") },
      repairOverdueDays: number("repairOverdueDays"), uncontactedLeadHours: number("uncontactedLeadHours"),
      customerFollowUpDays: String(form.get("customerFollowUpDays") ?? "").split(/[\s,]+/).filter(Boolean).map(Number) } });
  }}>
    <Section title={copy.thresholds.title} hint={copy.thresholds.hint}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{fields.map(([name, label, value, max]) => <label key={name} className={field}>
        <span className="block text-sm font-medium">{label}</span>
        <Input name={name} type="number" inputMode="numeric" min={1} max={max} step={1} defaultValue={value} required className={cn(inputClass, "font-display tabular-nums")} />
      </label>)}
      <label className={cn(field, "sm:col-span-2")}>
        <span className="block text-sm font-medium">{copy.thresholds.customerFollowUpDays}</span>
        <Input name="customerFollowUpDays" inputMode="numeric" pattern="[0-9 ,]+" defaultValue={settings.customerFollowUpDays.join(", ")} required className={cn(inputClass, "font-display tabular-nums")} />
        <span className="block text-xs text-muted-foreground">{copy.thresholds.customerFollowUpHint}</span>
      </label></div>
    </Section>
    <SaveBar pending={pending} error={error} />
  </form>;
}
