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
  return <>
    <button type="button" onClick={() => change(true)} aria-label={copy.open} aria-keyshortcuts="Meta+K Control+K"
      className="hidden h-9 w-64 items-center gap-2 rounded-lg border bg-muted/50 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring md:flex">
      <Search aria-hidden className="size-4" />
      <span className="flex-1 text-left">{copy.open}</span>
      <kbd className="rounded border bg-background px-1.5 py-0.5 font-sans text-[0.6875rem] font-medium">{mac ? copy.shortcutMac : copy.shortcut}</kbd>
    </button>
    <button type="button" onClick={() => change(true)} aria-label={copy.open}
      className="flex size-11 items-center justify-center rounded-lg text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring md:hidden">
      <Search aria-hidden className="size-5" />
    </button>
    <Dialog open={open} onOpenChange={change}>
      <DialogContent showCloseButton={false} style={brandTheme(primaryColor)}
        className="top-[max(1rem,env(safe-area-inset-top))] translate-y-0 gap-0 overflow-hidden p-0 sm:top-[12dvh] sm:max-w-xl">
        <DialogTitle className="sr-only">{copy.title}</DialogTitle>
        <DialogDescription className="sr-only">{copy.description}</DialogDescription>
        <div className="flex items-center gap-2 border-b px-4">
          <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <input autoFocus value={query} onChange={(event) => { setQuery(event.target.value); setActive(0); }} onKeyDown={onKeyDown}
            role="combobox" aria-expanded={hits.length > 0} aria-controls={listId} aria-autocomplete="list" aria-label={copy.title}
            aria-activedescendant={hits[current] ? optionId(hits[current]) : undefined}
            placeholder={copy.placeholder} maxLength={120} enterKeyHint="search"
            className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground" />
          <kbd className="hidden rounded border px-1.5 py-0.5 text-[0.6875rem] text-muted-foreground sm:block">{copy.escape}</kbd>
        </div>
        <div className="max-h-[min(60dvh,28rem)] overflow-y-auto p-2" aria-live="polite">
          {!ready && <p className="px-3 py-6 text-center text-sm text-muted-foreground">{copy.minimum}</p>}
          {ready && searching && hits.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">{copy.searching}</p>}
          {ready && !searching && answer.error && <p role="alert" className="px-3 py-6 text-center text-sm text-destructive">{copy.error}</p>}
          {ready && !searching && !answer.error && hits.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">{copy.none(trimmed)}</p>}
          <div id={listId} role="listbox" aria-label={copy.title} className={cn(searching && "opacity-60")}>
            {groups.map((group) => <div key={group.key} role="group" aria-label={copy.groups[group.key]} className="py-1">
              <p aria-hidden className="px-3 pt-2 pb-1 text-[0.6875rem] font-semibold tracking-wider text-muted-foreground uppercase">{copy.groups[group.key]}</p>
              {group.hits.map((hit) => {
                const index = hits.indexOf(hit);
                const selected = index === current;
                const Icon = kindIcons[hit.kind];
                return <div key={optionId(hit)} id={optionId(hit)} role="option" aria-selected={selected} onClick={() => go(hit)} onMouseMove={() => setActive(index)}
                  className={cn("flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-3 py-2", selected && "bg-muted")}>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon aria-hidden className="size-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{hit.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{hit.detail}</span>
                  </span>
                  {hit.status && <span className="hidden shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:flex"><span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: hit.status.color }} />{hit.status.label}</span>}
                  {selected && <CornerDownLeft aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
                </div>;
              })}
            </div>)}
          </div>
        </div>
        <p className="hidden border-t px-4 py-2 text-xs text-muted-foreground sm:block">{copy.hint}</p>
      </DialogContent>
    </Dialog>
  </>;
}
