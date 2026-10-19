import Link from "next/link";
import { Button } from "@/components/ui/button";
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
    <Button asChild variant="ghost" className="min-h-11 self-start"><Link href="/crm/leads">← {copy.back}</Link></Button>
    <header><h1 className="text-3xl font-semibold tracking-tight">{copy.newLeadTitle}</h1><p className="mt-2 text-sm text-muted-foreground">{copy.newLeadIntro}</p></header>
    <NewLeadForm owner={owner}
      vehicles={vehicles.map((vehicle) => ({ id: vehicle.id, label: `${vehicle.stockNo} · ${vehicle.year} ${vehicle.make} ${vehicle.model}`, dealershipId: vehicle.dealershipId, dealershipName: location(vehicle.dealershipId) }))}
      sources={settings.leadSources.map((source) => ({ id: source.key, label: source.label }))}
      salespeople={salespeople.filter((person) => person.active).map((person) => ({ id: person.id, label: person.name, dealershipId: person.dealershipId }))} />
  </>;
}
