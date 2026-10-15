import Link from "next/link";
import { publicInventoryCopy as copy } from "@/modules/inventory/public-copy";
export default function NotFound() {
  return <div className="space-y-4 py-12"><h1 className="text-2xl font-semibold">{copy.missing}</h1><p className="text-muted-foreground">{copy.missingHint}</p><Link href="/inventory" className="inline-flex min-h-11 items-center rounded-md border px-4">{copy.back}</Link></div>;
}
