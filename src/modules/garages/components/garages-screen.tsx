import Link from "next/link";
import { Phone, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Board, type BoardColumn, type BoardGroup } from "@/components/shared/board";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusPill } from "@/components/shared/status-pill";
import { KpiRow, StatCard } from "@/components/shared/stats/stat-card";
import { requestNow } from "@/lib/clock";
import { colorFromName } from "@/lib/color";
import { requirePageUser } from "@/modules/auth/page-guards";
import { startOfLocalMonth } from "@/modules/appointments/slots";
import { listDealerships } from "@/modules/dealerships/service";
import { listVehiclesInRepair, summarizeRepairSpend } from "@/modules/inventory/service";
import { daysBetween, formatMileage, vehicleTitle } from "@/modules/inventory/copy";
import { getSettings } from "@/modules/settings/service";
import { listGarages } from "../service";
import { garagesCopy as copy } from "../copy";

const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const money = (value: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value);

/** Owner view of partner garages: cars at each one, time in repair, overdue repairs and this month's spend. */
export async function GaragesScreen() {
  await requirePageUser("owner");
  const header = <header className="flex flex-wrap items-start justify-between gap-4">
    <div><h1 className="text-3xl font-semibold tracking-tight">{copy.title}</h1><p className="mt-2 text-sm text-muted-foreground">{copy.intro}</p></div>
    <Button asChild variant="outline" className="min-h-11"><Link href="/crm/settings?tab=garages">{copy.manage}</Link></Button>
  </header>;
  const settings = await getSettings();
  const now = requestNow();
  const monthStart = new Date(startOfLocalMonth(now, settings.booking.timeZone)).toISOString();
  const [garages, vehicles, spend, dealerships] = await Promise.all([listGarages(), listVehiclesInRepair(), summarizeRepairSpend(monthStart), listDealerships()]);
  if (!garages.length) return <>
    {header}
    <EmptyState icon={Warehouse} title={copy.empty} description={copy.emptyHint} />
  </>;
  const repairType = (key: string) => settings.repairTypes.find((type) => type.key === key) ?? { key, label: key, color: "#94A3B8" };
  const daysIn = (startedAt: string) => daysBetween(startedAt, now);
  const isOverdue = (startedAt: string) => daysIn(startedAt) > settings.repairOverdueDays;
  const stats = garages.map((garage) => {
    const cars = vehicles.filter((vehicle) => vehicle.repair?.garageId === garage.id);
    const month = spend.find((row) => row.garageId === garage.id);
    return { garage, cars, avgDays: average(cars.map((car) => daysIn(car.repair!.startedAt))), overdue: cars.filter((car) => isOverdue(car.repair!.startedAt)).length,
      spend: month?.cost ?? 0, completed: month?.count ?? 0 };
  });
  const columns: BoardColumn[] = [
    { id: "vehicle", header: copy.columns.vehicle, cell: "link", width: 300 },
    { id: "type", header: copy.columns.status, cell: "label", width: 150 },
    { id: "days", header: copy.columns.days, cell: "days", width: 120, warnDays: settings.repairOverdueDays, criticalDays: settings.repairOverdueDays + 1 },
    { id: "estimate", header: copy.columns.estimate, cell: "money" },
    { id: "location", header: copy.columns.location, cell: "label", width: 180 },
    { id: "started", header: copy.columns.started, cell: "date", timeZone: settings.booking.timeZone, hideOnMobile: true },
  ];
  const groups: BoardGroup[] = stats.filter((entry) => entry.garage.active || entry.cars.length).map(({ garage, cars }) => ({
    id: garage.id, title: garage.name, color: colorFromName(garage.name),
    items: cars.map((car) => ({
      id: car.id, version: car.revision,
      values: {
        vehicle: { text: vehicleTitle(car), href: `/crm/inventory/${car.id}?tab=repairs`, description: [car.stockNo, car.trim, formatMileage(car.mileage)].filter(Boolean).join(" · "), imageUrl: car.photos[0] ?? null },
        type: { text: repairType(car.repair!.typeKey).label, color: repairType(car.repair!.typeKey).color },
        days: daysIn(car.repair!.startedAt), estimate: car.repair!.estimatedCost,
        location: { text: dealerships.find((entry) => entry.id === car.dealershipId)?.name ?? copy.unknownDealership },
        started: car.repair!.startedAt,
      },
    })),
  }));
  const overdue = stats.reduce((sum, entry) => sum + entry.overdue, 0);
  return <>
    {header}
    <KpiRow label={copy.kpis}>
      <StatCard label={copy.inRepair} value={vehicles.length} href={`/crm/inventory?status=${settings.statusRoles.repair}`} />
      <StatCard label={copy.avgDays} value={copy.days(average(vehicles.map((car) => daysIn(car.repair!.startedAt))))} />
      <StatCard label={copy.overdue} value={overdue} hint={copy.overdueHint(settings.repairOverdueDays)} className={overdue ? "border-danger/40" : undefined} />
      <StatCard label={copy.spend} value={stats.reduce((sum, entry) => sum + entry.spend, 0)} format="money" hint={copy.completedHint(stats.reduce((sum, entry) => sum + entry.completed, 0))} />
    </KpiRow>
    <section aria-label={copy.title} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {stats.map(({ garage, cars, avgDays, overdue: late, spend: monthSpend }) => <article key={garage.id} className="min-w-0 rounded-xl border border-l-[6px] bg-card p-4" style={{ borderLeftColor: colorFromName(garage.name) }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><h2 className="break-words font-semibold">{garage.name}{!garage.active && <span className="ml-2 text-xs font-normal text-muted-foreground">{copy.inactive}</span>}</h2>
            <p className="break-words text-xs text-muted-foreground">{garage.address}</p></div>
          <a href={`tel:${garage.phone}`} aria-label={copy.call(garage.name)} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border hover:bg-muted"><Phone aria-hidden className="size-4" /></a>
        </div>
        {garage.specialties.length > 0 && <div aria-label={copy.specialties} className="mt-3 flex flex-wrap gap-1.5">{garage.specialties.map((key) => <StatusPill key={key} option={repairType(key)} className="min-h-6 px-2.5" />)}</div>}
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-2 xl:grid-cols-4">
          {([[copy.carsHere, String(cars.length)], [copy.avgDays, copy.days(avgDays)], [copy.overdue, String(late)], [copy.spend, money(monthSpend)]] as const).map(([label, value]) =>
            <div key={label} className="min-w-0"><dt className="text-xs leading-4 text-muted-foreground">{label}</dt><dd className={`mt-1 text-lg font-semibold tabular-nums ${label === copy.overdue && late ? "text-danger" : ""}`}>{value}</dd></div>)}
        </dl>
      </article>)}
    </section>
    <Board label={copy.board} columns={columns} groups={groups} exportName="garages" />
  </>;
}
