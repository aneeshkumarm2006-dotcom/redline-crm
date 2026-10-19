import { cn } from "@/lib/utils";
import { colorFromName, initials } from "@/lib/color";

const sizes = { sm: "size-6 text-[0.625rem]", md: "size-8 text-xs", lg: "size-11 text-sm" } as const;

/** Initials on a colour derived from the name, so each person is recognisable at a glance. */
export function Avatar({ name, size = "md", className }: { name: string; size?: keyof typeof sizes; className?: string }) {
  return <span aria-hidden="true" title={name} style={{ backgroundColor: colorFromName(name) }}
    className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold tracking-wide text-white ring-2 ring-background", sizes[size], className)}>
    {initials(name)}
  </span>;
}

/** Avatar plus visible name, for person cells and lists. */
export function PersonChip({ name, detail, size = "sm", className }: { name: string; detail?: string; size?: keyof typeof sizes; className?: string }) {
  return <span className={cn("flex min-w-0 items-center gap-2", className)}>
    <Avatar name={name} size={size} />
    <span className="min-w-0">
      <span className="block truncate text-sm">{name}</span>
      {detail && <span className="block truncate text-xs text-muted-foreground">{detail}</span>}
    </span>
  </span>;
}
