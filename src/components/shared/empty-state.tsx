import type { LucideIcon } from "lucide-react";

/** Friendly empty list/section state shared by staff screens. */
export function EmptyState({ icon: Icon, title, description, children }: { icon: LucideIcon; title: string; description?: string; children?: React.ReactNode }) {
  return <section className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card px-6 py-12 text-center">
    <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted"><Icon aria-hidden="true" className="size-6 text-muted-foreground" strokeWidth={1.5} /></span>
    <h2 className="font-semibold tracking-tight">{title}</h2>
    {description && <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>}
    {children && <div className="mt-5">{children}</div>}
  </section>;
}
