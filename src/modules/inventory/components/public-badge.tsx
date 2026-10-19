import { Sparkles, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicBadge } from "../schema";
import { publicInventoryCopy as copy } from "../public-copy";

const styles: Record<PublicBadge, { icon: typeof Sparkles; className: string }> = {
  price_drop: { icon: TrendingDown, className: "bg-danger text-white" },
  new_arrival: { icon: Sparkles, className: "bg-primary text-primary-foreground" },
};

export function PublicBadgePill({ badge, className }: { badge: PublicBadge; className?: string }) {
  const { icon: Icon, className: tone } = styles[badge];
  return <span className={cn("inline-flex min-h-6 items-center gap-1 rounded-full px-2.5 text-xs font-semibold shadow-sm", tone, className)}>
    <Icon aria-hidden className="size-3.5" />{copy.badges[badge]}
  </span>;
}
