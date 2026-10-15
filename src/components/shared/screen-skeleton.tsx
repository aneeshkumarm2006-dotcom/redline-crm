import { Skeleton } from "@/components/ui/skeleton";

/** Route loading placeholder shaped like a staff screen: title, optional stat tiles, then list rows. */
export function ScreenSkeleton({ label, tiles = 0, rows = 5 }: { label: string; tiles?: number; rows?: number }) {
  return <div role="status" aria-live="polite" className="space-y-6">
    <span className="sr-only">{label}</span>
    <div className="space-y-3"><Skeleton className="h-9 w-40" /><Skeleton className="h-4 w-64 max-w-full" /></div>
    {tiles > 0 && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: tiles }, (_, index) => <Skeleton key={index} className="h-24" />)}</div>}
    <div className="space-y-3">{Array.from({ length: rows }, (_, index) => <Skeleton key={index} className="h-20" />)}</div>
  </div>;
}
