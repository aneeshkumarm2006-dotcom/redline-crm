"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bookmark, BookmarkPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { brandTheme } from "@/components/shared/app-shell/theme";
import { normalizeViewQuery, viewBoards, type SavedView, type ViewBoard } from "../schema";
import { deleteViewAction, saveViewAction } from "../actions";
import { viewsCopy as copy } from "../copy";

/**
 * A row of saved filter sets for one board: tap a chip to apply it, × to delete it, and Save view to keep the
 * filters currently applied. The active view is highlighted when the URL matches it.
 */
export function SavedViews({ board, views, currentQuery, primaryColor }: { board: ViewBoard; views: Pick<SavedView, "id" | "name" | "query">[]; currentQuery: string; primaryColor: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const path = viewBoards[board].path;
  const current = normalizeViewQuery(board, currentQuery);
  function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        const result = await saveViewAction({ board, name, query: current });
        if (!result.ok) { setError(result.message); return; }
        toast.success(copy.saved(name.trim()));
        setOpen(false); setName("");
        router.refresh();
      } catch { setError(copy.failed); }
    });
  }
  function remove(view: { id: string }) {
    startTransition(async () => {
      try {
        const result = await deleteViewAction(view.id);
        if (result.ok) toast.success(copy.removed); else toast.error(result.message);
        router.refresh();
      } catch { toast.error(copy.failed); }
    });
  }
  return <div role="group" aria-label={copy.label} className="scrollbar-thin -mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
    <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Bookmark className="size-4" /></span>
    {views.map((view) => {
      const active = view.query === current;
      return <span key={view.id} className={cn("inline-flex min-h-10 shrink-0 items-center rounded-lg border pl-3 shadow-xs transition-[border-color,background-color] duration-150 pointer-coarse:min-h-11",
        active ? "border-primary/30 bg-brand-soft text-foreground" : "bg-card hover:border-foreground/15")}>
        {active && <span aria-hidden className="mr-2 size-1.5 shrink-0 rounded-full bg-primary" />}
        <Link href={`${path}?${view.query}`} aria-current={active ? "page" : undefined} className={cn("rounded-md py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring", !active && "text-foreground/80 hover:text-foreground")}>{view.name}</Link>
        <button type="button" onClick={() => remove(view)} disabled={pending} aria-label={copy.remove(view.name)}
          className={cn("ml-0.5 flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 pointer-coarse:size-11", active ? "hover:bg-primary/10" : "hover:bg-muted")}>
          <X aria-hidden className="size-3.5" />
        </button>
      </span>;
    })}
    <Sheet open={open} onOpenChange={(value) => { if (!pending) { setOpen(value); setError(""); } }}>
      <SheetTrigger asChild>
        <Button type="button" variant="ghost" className="min-h-10 shrink-0 gap-2 rounded-lg text-primary hover:bg-brand-soft hover:text-primary pointer-coarse:min-h-11" disabled={!current} title={current ? undefined : copy.nothingToSave}><BookmarkPlus aria-hidden className="size-4" />{copy.save}</Button>
      </SheetTrigger>
      <SheetContent side="bottom" showCloseButton={false} style={brandTheme(primaryColor)} className="rounded-t-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-md">
        <SheetHeader className="p-0"><SheetTitle className="text-lg tracking-tight">{copy.saveTitle}</SheetTitle><SheetDescription>{copy.saveHint}</SheetDescription></SheetHeader>
        <form onSubmit={save} className="space-y-4">
          <label className="block space-y-2"><span className="block text-sm font-medium">{copy.name}</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} required maxLength={60} placeholder={copy.namePlaceholder} className="min-h-11 text-base" autoFocus /></label>
          <p className="text-xs text-muted-foreground">{copy.replaceHint}</p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <SheetClose asChild><Button type="button" variant="outline" className="min-h-11 flex-1" disabled={pending}>{copy.cancel}</Button></SheetClose>
            <Button type="submit" className="min-h-11 flex-1" disabled={pending || !name.trim()}>{pending ? copy.saving : copy.save}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  </div>;
}
