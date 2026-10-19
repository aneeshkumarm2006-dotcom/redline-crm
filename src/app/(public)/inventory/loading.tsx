import { publicInventoryCopy as copy } from "@/modules/inventory/public-copy";
// Neutral skeleton: this boundary covers both the inventory list and vehicle pages.
export default function Loading() {
  return <div role="status" className="page-gutter py-10 sm:py-14">
    <span className="sr-only">{copy.loading}</span>
    <div aria-hidden className="motion-safe:animate-pulse">
      <div className="h-3 w-32 rounded-full bg-muted" /><div className="mt-4 h-9 w-72 max-w-full rounded-xl bg-muted" />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="overflow-clip rounded-[1.375rem] bg-card shadow-xs ring-1 ring-border">
        <div className="aspect-[16/10] bg-muted" /><div className="space-y-3 p-5"><div className="h-4 w-2/3 rounded-full bg-muted" /><div className="h-3 w-1/3 rounded-full bg-muted" /></div>
      </div>)}</div>
    </div>
  </div>;
}
