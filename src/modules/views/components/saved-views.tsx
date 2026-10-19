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
  return <div role="group" aria-label={copy.label} className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
    <Bookmark aria-hidden className="size-4 shrink-0 text-muted-foreground" />
    {views.map((view) => {
      const active = view.query === current;
      return <span key={view.id} className={cn("inline-flex min-h-11 shrink-0 items-center rounded-full border pl-3", active ? "border-primary bg-primary text-primary-foreground" : "bg-card")}>
        <Link href={`${path}?${view.query}`} aria-current={active ? "page" : undefined} className="py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">{view.name}</Link>
        <button type="button" onClick={() => remove(view)} disabled={pending} aria-label={copy.remove(view.name)}
          className={cn("ml-1 flex size-10 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50", active ? "hover:bg-primary-foreground/15" : "text-muted-foreground hover:bg-muted")}>
          <X aria-hidden className="size-4" />
        </button>
      </span>;
    })}
    <Sheet open={open} onOpenChange={(value) => { if (!pending) { setOpen(value); setError(""); } }}>
      <SheetTrigger asChild>
        <Button type="button" variant="ghost" className="min-h-11 shrink-0 gap-2" disabled={!current} title={current ? undefined : copy.nothingToSave}><BookmarkPlus aria-hidden className="size-4" />{copy.save}</Button>
      </SheetTrigger>
      <SheetContent side="bottom" showCloseButton={false} style={brandTheme(primaryColor)} className="rounded-t-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-md">
        <SheetHeader className="p-0"><SheetTitle>{copy.saveTitle}</SheetTitle><SheetDescription>{copy.saveHint}</SheetDescription></SheetHeader>
        <form onSubmit={save} className="space-y-4">
          <label className="block space-y-2"><span className="text-sm font-medium">{copy.name}</span>
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
