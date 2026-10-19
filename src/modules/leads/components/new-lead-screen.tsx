import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { requirePageUser } from "@/modules/auth/page-guards";
import { listDealerships } from "@/modules/dealerships/service";
import { listVehicleChoices } from "@/modules/inventory/service";
import { getSettings } from "@/modules/settings/service";
import { listSalespeople } from "@/modules/users/service";
import { leadsCopy as copy } from "../copy";
import { NewLeadForm } from "./new-lead-form";

export async function NewLeadScreen() {
  const user = await requirePageUser();
  const owner = user.role === "owner";
  const [settings, vehicles, dealerships, salespeople] = await Promise.all([getSettings(), listVehicleChoices(), listDealerships(), owner ? listSalespeople() : []]);
  const location = (id: string) => dealerships.find((entry) => entry.id === id)?.name ?? copy.unknownDealership;
  return <>
    <PageHeader eyebrow={<Link href="/crm/leads" className="-my-2 inline-flex min-h-11 items-center gap-1.5 rounded-md hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
      <ArrowLeft aria-hidden className="size-3.5" />{copy.back}</Link>} title={copy.newLeadTitle} description={copy.newLeadIntro} />
    <NewLeadForm owner={owner}
      vehicles={vehicles.map((vehicle) => ({ id: vehicle.id, label: `${vehicle.stockNo} · ${vehicle.year} ${vehicle.make} ${vehicle.model}`, dealershipId: vehicle.dealershipId, dealershipName: location(vehicle.dealershipId) }))}
      sources={settings.leadSources.map((source) => ({ id: source.key, label: source.label }))}
      salespeople={salespeople.filter((person) => person.active).map((person) => ({ id: person.id, label: person.name, dealershipId: person.dealershipId }))} />
  </>;
}
