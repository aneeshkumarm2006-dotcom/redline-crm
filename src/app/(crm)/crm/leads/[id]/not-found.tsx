import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { leadsCopy } from "@/modules/leads/copy";
export default function NotFound() {
  return <EmptyState icon={SearchX} title={leadsCopy.notFound}><Button asChild className="min-h-11"><Link href="/crm/leads">{leadsCopy.back}</Link></Button></EmptyState>;
}
