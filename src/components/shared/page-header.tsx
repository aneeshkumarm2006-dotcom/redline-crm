import { cn } from "@/lib/utils";

/**
 * Full-width page header band: optional eyebrow, title, description and actions, with an optional
 * toolbar row (filters, tabs) underneath. It bleeds to the workspace edges so every page starts
 * with the same band instead of a heading floating on the canvas.
 */
export function PageHeader({ title, description, eyebrow, actions, children, className }: {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return <header className={cn("page-bleed -mt-6 border-b bg-background pt-6 pb-5 sm:-mt-8 sm:pt-8 sm:pb-6", className)}>
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0 flex-1">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="break-words text-3xl font-semibold tracking-tight sm:text-[2rem] sm:leading-[2.4rem]">{title}</h1>
        {description && <div className="mt-1.5 max-w-3xl text-sm text-muted-foreground sm:text-[0.9375rem]">{description}</div>}
      </div>
      {actions && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">{actions}</div>}
    </div>
    {children && <div className="mt-5">{children}</div>}
  </header>;
}

/** A titled page section with an optional action on the right. */
export function PageSection({ id, title, description, action, children, className }: {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return <section aria-labelledby={id} className={cn("min-w-0 space-y-4", className)}>
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="text-lg font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>;
}
