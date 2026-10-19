"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { CarFront, CornerDownLeft, Search, UserRound, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { brandTheme } from "@/components/shared/app-shell/theme";
import { searchWorkspaceAction } from "../actions";
import { emptyResults, type SearchHit, type SearchResults } from "../schema";
import { searchCopy as copy } from "../copy";

const kindIcons = { vehicle: CarFront, lead: UsersRound, staff: UserRound };
const kindTiles = { vehicle: "bg-info/12 text-info", lead: "bg-success/12 text-success", staff: "bg-muted text-muted-foreground" };
const noop = () => () => {};
const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** ⌘K / Ctrl+K command palette on desktop and a header search button on mobile. */
export function GlobalSearch({ primaryColor }: { primaryColor: string }) {
  const router = useRouter();
  const listId = useId();
  const mac = useSyncExternalStore(noop, isMac, () => false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<{ query: string; results: SearchResults; error: boolean }>({ query: "", results: emptyResults, error: false });
  const [active, setActive] = useState(0);
  const latest = useRef(0);
  const trimmed = query.trim();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (trimmed.length < 2) return;
    const request = ++latest.current;
    const timer = setTimeout(async () => {
      const result = await searchWorkspaceAction(trimmed).catch(() => ({ ok: false as const }));
      if (request !== latest.current) return;
      setAnswer(result.ok ? { query: trimmed, results: result.results, error: false } : { query: trimmed, results: emptyResults, error: true });
    }, 200);
    return () => clearTimeout(timer);
  }, [trimmed]);

  const ready = trimmed.length >= 2;
  const searching = ready && answer.query !== trimmed;
  const results = ready ? answer.results : emptyResults;
  const groups = (["vehicles", "leads", "staff"] as const).map((key) => ({ key, hits: results[key] })).filter((group) => group.hits.length > 0);
  const hits: SearchHit[] = groups.flatMap((group) => group.hits);
  const current = Math.min(active, Math.max(0, hits.length - 1));

  function change(value: boolean) {
    setOpen(value);
    if (!value) { setQuery(""); setActive(0); }
  }
  function go(hit: SearchHit | undefined) {
    if (!hit) return;
    change(false);
    router.push(hit.href);
  }
  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((current + 1) % Math.max(1, hits.length)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive((current - 1 + hits.length) % Math.max(1, hits.length)); }
    else if (event.key === "Enter") { event.preventDefault(); go(hits[current]); }
  }

  const optionId = (hit: SearchHit) => `${listId}-${hit.kind}-${hit.id}`;
  const kbd = "inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-b-2 bg-card px-1.5 font-sans text-[0.6875rem] font-semibold text-muted-foreground";
  const message = "flex flex-col items-center gap-3 px-6 py-10 text-center text-sm text-muted-foreground";
  return <>
    <button type="button" onClick={() => change(true)} aria-label={copy.open} aria-keyshortcuts="Meta+K Control+K"
      className="group hidden h-10 w-72 items-center gap-2.5 rounded-xl border bg-card px-3 text-sm text-muted-foreground shadow-xs transition-[border-color,box-shadow,color] duration-150 hover:border-foreground/15 hover:text-foreground hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:flex xl:w-80">
      <Search aria-hidden className="size-4" />
      <span className="flex-1 text-left">{copy.open}</span>
      <kbd className={kbd}>{mac ? copy.shortcutMac : copy.shortcut}</kbd>
    </button>
    <button type="button" onClick={() => change(true)} aria-label={copy.open}
      className="flex size-11 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:hidden">
      <Search aria-hidden className="size-5" />
    </button>
    <Dialog open={open} onOpenChange={change}>
      <DialogContent showCloseButton={false} style={brandTheme(primaryColor)}
        className="top-[max(1rem,env(safe-area-inset-top))] translate-y-0 gap-0 overflow-hidden rounded-2xl bg-card p-0 shadow-xl ring-1 ring-black/5 sm:top-[12dvh] sm:max-w-2xl">
        <DialogTitle className="sr-only">{copy.title}</DialogTitle>
        <DialogDescription className="sr-only">{copy.description}</DialogDescription>
        <div className="flex items-center gap-3 border-b px-4 sm:px-5">
          <Search aria-hidden className="size-5 shrink-0 text-primary" />
          <input autoFocus value={query} onChange={(event) => { setQuery(event.target.value); setActive(0); }} onKeyDown={onKeyDown}
            role="combobox" aria-expanded={hits.length > 0} aria-controls={listId} aria-autocomplete="list" aria-label={copy.title}
            aria-activedescendant={hits[current] ? optionId(hits[current]) : undefined}
            placeholder={copy.placeholder} maxLength={120} enterKeyHint="search"
            className="h-16 min-w-0 flex-1 bg-transparent text-base font-medium outline-none placeholder:font-normal placeholder:text-muted-foreground sm:text-[1.0625rem]" />
          <kbd className={cn(kbd, "hidden sm:inline-flex")}>{copy.escape}</kbd>
        </div>
        <div className="max-h-[min(60dvh,30rem)] overflow-y-auto overscroll-contain p-2" aria-live="polite">
          {!ready && <div className={message}><span aria-hidden className="flex size-11 items-center justify-center rounded-xl bg-muted"><Search className="size-5" /></span><p>{copy.minimum}</p></div>}
          {ready && searching && hits.length === 0 && <p className={message}>{copy.searching}</p>}
          {ready && !searching && answer.error && <p role="alert" className={cn(message, "text-destructive")}>{copy.error}</p>}
          {ready && !searching && !answer.error && hits.length === 0 && <p className={message}>{copy.none(trimmed)}</p>}
          <div id={listId} role="listbox" aria-label={copy.title} className={cn("transition-opacity duration-150", searching && "opacity-60")}>
            {groups.map((group) => <div key={group.key} role="group" aria-label={copy.groups[group.key]} className="py-1 [&+&]:mt-1 [&+&]:border-t [&+&]:pt-2">
              <p aria-hidden className="flex items-center justify-between px-3 pt-1.5 pb-1.5">
                <span className="eyebrow">{copy.groups[group.key]}</span>
                <span className="text-xs font-semibold tabular-nums text-muted-foreground">{group.hits.length}</span>
              </p>
              {group.hits.map((hit) => {
                const index = hits.indexOf(hit);
                const selected = index === current;
                const Icon = kindIcons[hit.kind];
                return <div key={optionId(hit)} id={optionId(hit)} role="option" aria-selected={selected} onClick={() => go(hit)} onMouseMove={() => setActive(index)}
                  className={cn("flex min-h-14 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition-colors duration-100", selected && "bg-muted")}>
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors", selected ? "bg-brand-soft text-primary" : kindTiles[hit.kind])}><Icon aria-hidden className="size-[1.125rem]" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{hit.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{hit.detail}</span>
                  </span>
                  {hit.status && <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground/80 sm:inline-flex"><span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: hit.status.color }} />{hit.status.label}</span>}
                  <CornerDownLeft aria-hidden className={cn("size-4 shrink-0 text-muted-foreground transition-opacity", selected ? "opacity-100" : "opacity-0")} />
                </div>;
              })}
            </div>)}
          </div>
        </div>
        <p className="hidden items-center gap-x-4 gap-y-1 border-t bg-muted/40 px-5 py-2.5 text-xs text-muted-foreground sm:flex">
          {copy.hint.split(" · ").map((part) => {
            const [keys, ...rest] = part.split(" ");
            return <span key={part} className="inline-flex items-center gap-1.5"><kbd className={kbd}>{keys}</kbd>{rest.join(" ")}</span>;
          })}
        </p>
      </DialogContent>
    </Dialog>
  </>;
}
