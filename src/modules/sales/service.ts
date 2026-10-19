import "server-only";
import { requireRole } from "@/modules/auth/service";
import { listAppointmentsBetween, type StaffAppointment } from "@/modules/appointments/service";
import { localMonth, localWeek, recentLocalMonths, type LocalMonth } from "@/modules/appointments/slots";
import { listDealerships } from "@/modules/dealerships/service";
import { listSales, type SaleRecord } from "@/modules/inventory/service";
import { listLeadsForSalesperson, summarizeLeadsBySalesperson, type SalespersonLeadStats } from "@/modules/leads/service";
import { getSettings } from "@/modules/settings/service";
import { getStaffMember, listSalespeople } from "@/modules/users/service";
import type { User } from "@/modules/users/schema";
import { csvDocument } from "@/lib/csv";
import { formatMonth, salesCopy } from "./copy";

/**
 * Read-only sales aggregations. Everything comes through the inventory, leads, appointments and users
 * services (never their models), so their role scoping applies here too.
 */

export type MonthTotals = { key: string; label: string; start: number; units: number; revenue: number; commission: number };
export type SalespersonStats = {
  user: User; openLeads: number; workingVehicles: number; appointmentsThisWeek: number;
  unitsThisMonth: number; revenueThisMonth: number; commissionThisMonth: number;
  won: number; lost: number; conversion: number | null;
};

const iso = (instant: number) => new Date(instant).toISOString();
const inRange = (at: string, range: { start: number; end: number }) => { const time = Date.parse(at); return time >= range.start && time < range.end; };
const emptyLeads: SalespersonLeadStats = { open: 0, won: 0, lost: 0, workingVehicles: 0 };

function totalsByMonth(months: LocalMonth[], sales: SaleRecord[], timeZone: string): MonthTotals[] {
  return months.map((month) => {
    const within = sales.filter((sale) => inRange(sale.soldAt, month));
    return { key: month.key, label: formatMonth(month.start, timeZone), start: month.start, units: within.length,
      revenue: within.reduce((sum, sale) => sum + sale.price, 0), commission: within.reduce((sum, sale) => sum + sale.commission, 0) };
  });
}

function statsFor(user: User, leads: SalespersonLeadStats | undefined, sales: SaleRecord[], appointments: StaffAppointment[], month: LocalMonth, week: { start: number; end: number }): SalespersonStats {
  const own = sales.filter((sale) => sale.salespersonId === user.id && inRange(sale.soldAt, month));
  const { open, won, lost, workingVehicles } = leads ?? emptyLeads;
  return {
    user, openLeads: open, workingVehicles, won, lost, conversion: won + lost ? won / (won + lost) : null,
    appointmentsThisWeek: appointments.filter((entry) => entry.salespersonId === user.id && inRange(entry.startsAt, week)).length,
    unitsThisMonth: own.length, revenueThisMonth: own.reduce((sum, sale) => sum + sale.price, 0), commissionThisMonth: own.reduce((sum, sale) => sum + sale.commission, 0),
  };
}

async function periods(now: number) {
  const settings = await getSettings();
  const timeZone = settings.booking.timeZone;
  const months = recentLocalMonths(now, timeZone, 6);
  return { settings, timeZone, months, month: months[months.length - 1], week: localWeek(now, timeZone) };
}

/** Every salesperson's figures for this month and week, plus team totals for the last 6 months (owner). */
export async function getTeamPerformance(now = Date.now()) {
  await requireRole("owner");
  const { settings, timeZone, months, month, week } = await periods(now);
  const [people, leadStats, sales, appointments, dealerships] = await Promise.all([
    listSalespeople(), summarizeLeadsBySalesperson(), listSales({ from: iso(months[0].start), to: iso(month.end), limit: 2000 }),
    listAppointmentsBetween(iso(week.start), iso(week.end)), listDealerships(),
  ]);
  return {
    settings, dealerships, timeZone,
    people: people.map((user) => statsFor(user, leadStats[user.id], sales, appointments, month, week)),
    months: totalsByMonth(months, sales, timeZone),
  };
}

/** One salesperson in detail (owner): this month's figures, 6-month history, leads, sales and upcoming appointments. */
export async function getSalespersonPerformance(id: string, now = Date.now()) {
  await requireRole("owner");
  const user = await getStaffMember(id);
  if (!user || user.role !== "salesperson") return null;
  const { settings, timeZone, months, month, week } = await periods(now);
  const horizon = now + 30 * 86_400_000;
  const [leadStats, sales, appointments, leads, dealerships] = await Promise.all([
    summarizeLeadsBySalesperson(), listSales({ salespersonId: user.id, limit: 2000 }),
    listAppointmentsBetween(iso(Math.min(week.start, now)), iso(Math.max(week.end, horizon)), user.id),
    listLeadsForSalesperson(user.id), listDealerships(),
  ]);
  return {
    settings, timeZone, user, dealerships, leads, sales,
    stats: statsFor(user, leadStats[user.id], sales, appointments, month, week),
    months: totalsByMonth(months, sales, timeZone),
    upcoming: appointments.filter((entry) => entry.status === "booked" && Date.parse(entry.endsAt) > now && Date.parse(entry.startsAt) < horizon),
  };
}

export type LeaderboardRow = { user: User; units: number; revenue: number; commission: number };
/**
 * Dashboard sales figures: 6 months of totals and this month's leaderboard, optionally for one location.
 * Owners see the team; a salesperson gets only their own sales (and only themselves on the board).
 */
export async function getSalesSummary(input: { dealershipId?: string } = {}, now = Date.now()) {
  const user = await requireRole();
  const owner = user.role === "owner";
  const { timeZone, months, month } = await periods(now);
  const [sales, people] = await Promise.all([
    listSales({ from: iso(months[0].start), to: iso(month.end), limit: 2000 }),
    owner ? listSalespeople() : Promise.resolve([user]),
  ]);
  const location = owner ? input.dealershipId : undefined;
  const scoped = location ? sales.filter((sale) => sale.dealershipId === location) : sales;
  const thisMonth = scoped.filter((sale) => inRange(sale.soldAt, month));
  // Active salespeople at the location, plus anyone who sold there this month (moved or deactivated since).
  const leaderboard: LeaderboardRow[] = people
    .filter((person) => person.role === "salesperson" && ((person.active && (!location || person.dealershipId === location)) || thisMonth.some((sale) => sale.salespersonId === person.id)))
    .map((person) => {
      const own = thisMonth.filter((sale) => sale.salespersonId === person.id);
      return { user: person, units: own.length, revenue: own.reduce((sum, sale) => sum + sale.price, 0), commission: own.reduce((sum, sale) => sum + sale.commission, 0) };
    })
    .toSorted((a, b) => b.units - a.units || b.commission - a.commission || a.user.name.localeCompare(b.user.name));
  const months6 = totalsByMonth(months, scoped, timeZone);
  return { months: months6, thisMonth: months6[months6.length - 1], leaderboard, timeZone };
}

export type CommissionRow = { salespersonId: string; name: string; dealershipId: string | null; active: boolean; units: number; revenue: number; commission: number; sales: SaleRecord[] };
/** Commission per salesperson for a calendar month (`YYYY-MM`, default this month), in settings time zone (owner). */
export async function getCommissionReport(monthKey?: string, now = Date.now()) {
  await requireRole("owner");
  const settings = await getSettings();
  const timeZone = settings.booking.timeZone;
  const choices = recentLocalMonths(now, timeZone, 12).toReversed();
  const month = (monthKey ? localMonth(monthKey, timeZone) : null) ?? choices[0];
  const [sales, people, dealerships] = await Promise.all([listSales({ from: iso(month.start), to: iso(month.end), limit: 2000 }), listSalespeople(), listDealerships()]);
  // Active salespeople always appear; former staff appear only if they sold something that month.
  const rows: CommissionRow[] = people.filter((person) => person.active || sales.some((sale) => sale.salespersonId === person.id)).map((person) => {
    const own = sales.filter((sale) => sale.salespersonId === person.id);
    return { salespersonId: person.id, name: person.name, dealershipId: person.dealershipId, active: person.active, units: own.length,
      revenue: own.reduce((sum, sale) => sum + sale.price, 0), commission: own.reduce((sum, sale) => sum + sale.commission, 0), sales: own };
  }).toSorted((a, b) => b.commission - a.commission || a.name.localeCompare(b.name));
  const orphaned = sales.filter((sale) => !rows.some((row) => row.salespersonId === sale.salespersonId));
  if (orphaned.length) rows.push({ salespersonId: "", name: salesCopy.formerStaff, dealershipId: null, active: false, units: orphaned.length,
    revenue: orphaned.reduce((sum, sale) => sum + sale.price, 0), commission: orphaned.reduce((sum, sale) => sum + sale.commission, 0), sales: orphaned });
  const totals = { units: sales.length, revenue: sales.reduce((sum, sale) => sum + sale.price, 0), commission: sales.reduce((sum, sale) => sum + sale.commission, 0) };
  return { month: { ...month, label: formatMonth(month.start, timeZone, "long") }, choices: choices.map((entry) => ({ key: entry.key, label: formatMonth(entry.start, timeZone, "long") })),
    rows, totals, dealerships, timeZone };
}

const amount = (value: number) => value.toFixed(2);

/** The report as CSV: one row per salesperson plus a total, or one row per sale with `detail`. */
export async function exportCommissionReport(monthKey: string | undefined, detail: boolean) {
  const report = await getCommissionReport(monthKey);
  const location = (id: string | null) => report.dealerships.find((entry) => entry.id === id)?.name ?? salesCopy.unknownLocation;
  const month = report.month.key;
  const lines = detail
    ? [salesCopy.csv.detail, ...report.rows.flatMap((row) => row.sales.map((sale) => [month,
      new Intl.DateTimeFormat("en-CA", { dateStyle: "short", timeStyle: "short", timeZone: report.timeZone }).format(new Date(sale.soldAt)),
      row.name, location(sale.dealershipId), sale.stockNo, `${sale.year} ${sale.make} ${sale.model} ${sale.trim}`.trim(), amount(sale.price), amount(sale.commission)]))]
    : [salesCopy.csv.summary, ...report.rows.map((row) => [month, row.name, location(row.dealershipId), row.units, amount(row.revenue), amount(row.commission)]),
      [month, salesCopy.csv.total, "", report.totals.units, amount(report.totals.revenue), amount(report.totals.commission)]];
  return { filename: `commission-${month}${detail ? "-detail" : ""}.csv`, body: csvDocument(lines) };
}
