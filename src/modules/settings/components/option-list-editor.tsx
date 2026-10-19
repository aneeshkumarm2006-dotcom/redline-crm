"use client";
import { useId } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { settingsCopy as copy } from "../copy";

/** One editable entry. `saved` entries keep their key (records store it); new ones may set or derive a key. */
export type OptionRow = { id: string; key: string; label: string; color: string; saved: boolean };
type Option = { key: string; label: string; color: string };

export const toRows = (options: Option[]): OptionRow[] => options.map((option) => ({ id: option.key, ...option, saved: true }));
/** A settings key from a label: lowercase words joined by underscores, starting with a letter. */
export const slugKey = (label: string) => {
  const slug = label.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
  return /^[a-z]/.test(slug) ? slug : `k_${slug}`.replace(/_+$/, "");
};
export const rowKey = (row: OptionRow) => row.saved ? row.key : row.key.trim() || slugKey(row.label);

/** Client-side checks before saving; the server validates again. Returns the first problem, or null. */
export function rowsProblem(rows: OptionRow[]) {
  if (!rows.length) return copy.errors.needOne;
  if (rows.some((row) => !row.label.trim())) return copy.errors.needLabel;
  const keys = rows.map(rowKey);
  if (keys.some((key) => !/^[a-z][a-z0-9_]*$/.test(key) || key.length > 80)) return copy.errors.invalidKey;
  const duplicate = keys.find((key, index) => keys.indexOf(key) !== index);
  return duplicate ? copy.errors.duplicateKey(duplicate) : null;
}
export const rowsToOptions = (rows: OptionRow[]) => rows.map((row) => ({ key: rowKey(row), label: row.label.trim(), color: row.color.toUpperCase() }));

/** Add, relabel, recolour, reorder (when `ordered`) and remove settings entries such as statuses or sources. */
export function OptionListEditor({ title, hint, rows, onChange, ordered = false, className }: { title: string; hint: string; rows: OptionRow[]; onChange: (rows: OptionRow[]) => void; ordered?: boolean; className?: string }) {
  const id = useId();
  const update = (index: number, change: Partial<OptionRow>) => onChange(rows.map((row, position) => position === index ? { ...row, ...change } : row));
  const move = (index: number, by: number) => {
    const next = [...rows];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    onChange(next);
  };
  return <div className={cn("min-w-0 rounded-2xl border bg-card p-5 shadow-xs sm:p-6", className)}><fieldset className="min-w-0">
    <legend className="flex items-center gap-2 text-lg font-semibold tracking-tight">{title}<span aria-hidden className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-muted px-2 text-xs font-semibold tabular-nums text-muted-foreground">{rows.length}</span></legend>
    <p className="mt-1 text-sm text-muted-foreground">{hint} {copy.list.inUseHint}</p>
    <ul className="mt-5 divide-y overflow-clip rounded-xl border">{rows.map((row, index) => {
      const name = row.label.trim() || copy.list.untitled;
      return <li key={row.id} className="bg-card p-2.5 transition-colors focus-within:bg-muted/30 hover:bg-muted/30 sm:px-3">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <label className="sr-only" htmlFor={`${id}-${row.id}-color`}>{copy.list.color}</label>
          <input id={`${id}-${row.id}-color`} type="color" value={row.color.toLowerCase()} onChange={(event) => update(index, { color: event.target.value })}
            className="size-11 shrink-0 cursor-pointer rounded-lg border border-input bg-card p-1 shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" />
          <label className="sr-only" htmlFor={`${id}-${row.id}-label`}>{copy.list.label}</label>
          <Input id={`${id}-${row.id}-label`} value={row.label} onChange={(event) => update(index, { label: event.target.value })} maxLength={120} required className="min-h-11 min-w-0 flex-1 text-base font-medium md:text-sm" />
          {ordered && <>
            <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0" disabled={index === 0} onClick={() => move(index, -1)} aria-label={copy.list.up(name)}><ArrowUp aria-hidden className="size-4" /></Button>
            <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0" disabled={index === rows.length - 1} onClick={() => move(index, 1)} aria-label={copy.list.down(name)}><ArrowDown aria-hidden className="size-4" /></Button>
          </>}
          <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0 text-muted-foreground hover:text-destructive" disabled={rows.length === 1}
            onClick={() => onChange(rows.filter((_, position) => position !== index))} aria-label={copy.list.remove(name)}><Trash2 aria-hidden className="size-4" /></Button>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-[3.125rem] text-xs text-muted-foreground sm:pl-[3.25rem]">
          {row.saved ? <span>{copy.list.key}: <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{row.key}</code></span> : <>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2 py-0.5 font-semibold text-primary"><span aria-hidden className="size-1.5 rounded-full bg-primary" />{copy.list.newBadge}</span>
            <label className="flex min-w-0 flex-1 items-center gap-2">{copy.list.key}
              <Input value={row.key} onChange={(event) => update(index, { key: event.target.value.toLowerCase() })} placeholder={slugKey(row.label) || "key"} maxLength={80}
                className="h-10 min-w-0 flex-1 font-mono text-sm" /></label>
          </>}
        </div>
      </li>;
    })}</ul>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
    <p className="min-w-0 flex-1 text-xs text-muted-foreground">{copy.list.keyHint}</p>
    <Button type="button" variant="outline" className="min-h-11 gap-2" onClick={() => onChange([...rows, { id: crypto.randomUUID(), key: "", label: "", color: "#64748B", saved: false }])}>
      <Plus aria-hidden className="size-4" />{copy.list.add}
    </Button>
    </div>
  </fieldset></div>;
}
