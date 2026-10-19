import Link from "next/link";
import { AlarmClock, Hourglass, Phone, Wallet, Warehouse, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Board, type BoardColumn, type BoardGroup } from "@/components/shared/board";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusPill } from "@/components/shared/status-pill";
import { KpiRow, StatCard } from "@/components/shared/stats/stat-card";
import { requestNow } from "@/lib/clock";
import { colorFromName } from "@/lib/color";
import { cn } from "@/lib/utils";
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
  const header = <PageHeader title={copy.title} description={copy.intro}
    actions={<Button asChild variant="outline" className="min-h-11"><Link href="/crm/settings?tab=garages">{copy.manage}</Link></Button>} />;
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
    <KpiRow label={copy.kpis} className="md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-4">
      <StatCard label={copy.inRepair} icon={Wrench} value={vehicles.length} href={`/crm/inventory?status=${settings.statusRoles.repair}`} />
      <StatCard label={copy.avgDays} icon={Hourglass} value={copy.days(average(vehicles.map((car) => daysIn(car.repair!.startedAt))))} />
      <StatCard label={copy.overdue} icon={AlarmClock} value={overdue} hint={copy.overdueHint(settings.repairOverdueDays)} className={overdue ? "border-danger/40" : undefined} />
      <StatCard label={copy.spend} icon={Wallet} value={stats.reduce((sum, entry) => sum + entry.spend, 0)} format="money" hint={copy.completedHint(stats.reduce((sum, entry) => sum + entry.completed, 0))} />
    </KpiRow>
    <section aria-label={copy.title} className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {stats.map(({ garage, cars, avgDays, overdue: late, spend: monthSpend }) => <article key={garage.id} className="flex min-w-0 flex-col rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
        <div className="flex items-start gap-3.5">
          <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `color-mix(in oklab, ${colorFromName(garage.name)} 14%, transparent)`, color: colorFromName(garage.name) }}><Warehouse className="size-5" /></span>
          <div className="min-w-0 flex-1"><h2 className="break-words text-[0.9375rem] font-semibold tracking-tight">{garage.name}{!garage.active && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 align-middle text-xs font-medium text-muted-foreground">{copy.inactive}</span>}</h2>
            <p className="mt-0.5 break-words text-sm text-muted-foreground">{garage.address}</p></div>
          <a href={`tel:${garage.phone}`} aria-label={copy.call(garage.name)} className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border bg-card text-foreground/80 shadow-xs transition-colors duration-150 hover:border-foreground/25 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"><Phone aria-hidden className="size-4" /></a>
        </div>
        {garage.specialties.length > 0 && <div aria-label={copy.specialties} className="mt-4 flex flex-wrap gap-1.5">{garage.specialties.map((key) => <StatusPill key={key} option={repairType(key)} className="min-h-6 px-2.5" />)}</div>}
        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t pt-4 sm:grid-cols-4 md:grid-cols-2 xl:grid-cols-4">
          {([[copy.carsHere, String(cars.length)], [copy.avgDays, copy.days(avgDays)], [copy.overdue, String(late)], [copy.spend, money(monthSpend)]] as const).map(([label, value]) =>
            <div key={label} className="min-w-0"><dt className="eyebrow line-clamp-2">{label}</dt><dd className={cn("font-display mt-1 text-lg font-semibold tabular-nums", label === copy.overdue && late ? "text-danger" : "")}>{value}</dd></div>)}
        </dl>
      </article>)}
    </section>
    <Board label={copy.board} columns={columns} groups={groups} exportName="garages" />
  </>;
}
