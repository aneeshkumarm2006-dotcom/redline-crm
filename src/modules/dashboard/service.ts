import "server-only";
import { z } from "zod";
import { objectIdSchema } from "@/lib/data-schema";
import { requireRole } from "@/modules/auth/service";
import { listStaffAppointments } from "@/modules/appointments/service";
import { localDate, recentLocalMonths, startOfLocalDay, startOfLocalMonth } from "@/modules/appointments/slots";
import { getNeedsAttention } from "@/modules/automations/reminders";
import { listDealerships } from "@/modules/dealerships/service";
import { listRecentVehicleActivity, listStockSnapshot, type StockRow } from "@/modules/inventory/service";
import { countLeadsByStage, countLeadsSince, listRecentLeadActivity, summarizeLeadsBySalesperson } from "@/modules/leads/service";
import { listMyNotifications } from "@/modules/notifications/service";
import { getSalesSummary } from "@/modules/sales/service";
import type { Settings } from "@/modules/settings/schema";
import { getSettings } from "@/modules/settings/service";

/**
 * Read-only dashboard figures. Everything comes through the other modules' services, so their role scoping
 * applies: the owner's Command Center sees every location (or one, via the filter), a salesperson sees their own.
 */

const DAY_MS = 86_400_000;
const iso = (instant: number) => new Date(instant).toISOString();
const daysInStock = (row: StockRow, now: number) => Math.max(0, Math.floor((now - Date.parse(row.dateInStock)) / DAY_MS));

/** Days-in-stock buckets for the aging chart; `max: null` is open-ended. */
export const agingBuckets = [{ min: 0, max: 30 }, { min: 31, max: 60 }, { min: 61, max: 90 }, { min: 91, max: null }] as const;
export type AgingBucket = (typeof agingBuckets)[number];

export const dashboardQuerySchema = z.object({ dealershipId: objectIdSchema.optional() });

function summarizeStock(rows: StockRow[], settings: Settings, now: number) {
  const sold = settings.statusRoles.sold;
  const unsold = rows.filter((row) => row.status !== sold && !row.soldAt);
  const ages = unsold.map((row) => daysInStock(row, now));
  // Configured statuses first, then any retired keys still on cars, so no car goes uncounted.
  const statuses = [...settings.vehicleStatuses, ...[...new Set(rows.map((row) => row.status))]
    .filter((key) => !settings.vehicleStatuses.some((status) => status.key === key)).map((key) => ({ key, label: key, color: "#94A3B8" }))];
  return {
    statuses,
    units: unsold.length,
    value: unsold.reduce((sum, row) => sum + row.price, 0),
    averageDays: ages.length ? Math.round(ages.reduce((sum, days) => sum + days, 0) / ages.length) : null,
    aging: ages.filter((days) => days > settings.inventoryAging.warnDays).length,
    byStatus: Object.fromEntries(statuses.map((status) => [status.key, rows.filter((row) => row.status === status.key).length])) as Record<string, number>,
    buckets: agingBuckets.map((bucket) => ({ ...bucket, count: ages.filter((days) => days >= bucket.min && (bucket.max === null || days <= bucket.max)).length })),
    byLocation: (dealershipId: string) => Object.fromEntries(statuses.map((status) => [status.key,
      rows.filter((row) => row.dealershipId === dealershipId && row.status === status.key).length])) as Record<string, number>,
  };
}

/**
 * Lead funnel from current stages: each open stage (in settings order, lost excluded) counts the leads at that
 * stage or further along. The first step is every lead received, lost ones included.
 */
function leadFunnel(counts: Record<string, number>, settings: Settings) {
  const steps = settings.leadStages.toSorted((a, b) => a.order - b.order).filter((stage) => stage.key !== settings.lostStageKey);
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const won = counts[settings.wonStageKey] ?? 0;
  const lost = counts[settings.lostStageKey] ?? 0;
  return {
    total, lost, conversion: won + lost ? won / (won + lost) : null,
    steps: steps.map((stage, index) => ({ ...stage, value: index === 0 ? total : steps.slice(index).reduce((sum, entry) => sum + (counts[entry.key] ?? 0), 0) })),
  };
}

function todaysAppointments<T extends { startsAt: string; status: string; dealershipId: string }>(appointments: T[], now: number, timeZone: string, dealershipId?: string) {
  const today = localDate(now, timeZone);
  return appointments.filter((entry) => entry.status !== "cancelled" && localDate(Date.parse(entry.startsAt), timeZone) === today && (!dealershipId || entry.dealershipId === dealershipId));
}

function mergedActivity(leadActivity: Awaited<ReturnType<typeof listRecentLeadActivity>>, vehicleActivity: Awaited<ReturnType<typeof listRecentVehicleActivity>>, limit: number) {
  return [
    ...leadActivity.map((entry) => ({ ...entry, kind: "lead" as const, href: `/crm/leads/${entry.leadId}`, subject: entry.name })),
    ...vehicleActivity.map((entry) => ({ ...entry, kind: "vehicle" as const, href: `/crm/inventory/${entry.vehicleId}`, subject: `${entry.name} · ${entry.stockNo}` })),
  ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, limit);
}
export type DashboardActivity = ReturnType<typeof mergedActivity>[number];

/** Owner Command Center: stock, leads, sales, team, what needs attention and today's agenda, optionally for one location. */
export async function getOwnerDashboard(input: unknown = {}, now = Date.now()) {
  await requireRole("owner");
  const query = dashboardQuerySchema.safeParse(input);
  const [settings, dealerships] = await Promise.all([getSettings(), listDealerships()]);
  const zone = settings.booking.timeZone;
  // An unknown location falls back to all locations rather than an empty dashboard.
  const dealershipId = query.success && dealerships.some((entry) => entry.id === query.data.dealershipId) ? query.data.dealershipId : undefined;
  const dayStart = startOfLocalDay(now, zone);
  const monthStart = startOfLocalMonth(now, zone);
  const funnelStart = recentLocalMonths(now, zone, 6)[0].start;
  const [stock, leadsToday, leadsThisMonth, stageCounts, sales, attention, appointments, leadActivity, vehicleActivity] = await Promise.all([
    listStockSnapshot(iso(monthStart), dealershipId), countLeadsSince(iso(dayStart), dealershipId), countLeadsSince(iso(monthStart), dealershipId),
    countLeadsByStage({ since: iso(funnelStart), dealershipId }), getSalesSummary({ dealershipId }, now), getNeedsAttention(now, dealershipId),
    listStaffAppointments(iso(dayStart)), listRecentLeadActivity(10, dealershipId), listRecentVehicleActivity(10, dealershipId),
  ]);
  const summary = summarizeStock(stock, settings, now);
  const locations = dealerships.filter((entry) => entry.active || stock.some((row) => row.dealershipId === entry.id));
  return {
    settings, dealerships, dealershipId, timeZone: zone,
    stock: { ...summary, byLocation: locations.filter((entry) => !dealershipId || entry.id === dealershipId).map((entry) => ({ dealership: entry, counts: summary.byLocation(entry.id) })) },
    leads: { today: leadsToday, thisMonth: leadsThisMonth, ...leadFunnel(stageCounts, settings) },
    sales, attention,
    appointments: todaysAppointments(appointments, now, zone, dealershipId),
    activity: mergedActivity(leadActivity, vehicleActivity, 10),
  };
}

/** Salesperson dashboard: my open leads, today's appointments, my month vs target, my reminders and recent activity. */
export async function getSalespersonDashboard(now = Date.now()) {
  const user = await requireRole("salesperson");
  const settings = await getSettings();
  const zone = settings.booking.timeZone;
  const dayStart = startOfLocalDay(now, zone);
  const [leadStats, appointments, sales, attention, reminders, leadActivity, vehicleActivity] = await Promise.all([
    summarizeLeadsBySalesperson(), listStaffAppointments(iso(dayStart)), getSalesSummary({}, now), getNeedsAttention(now),
    listMyNotifications(5, "reminders"), listRecentLeadActivity(10),
    user.dealershipId ? listRecentVehicleActivity(5, user.dealershipId) : Promise.resolve([]),
  ]);
  const mine = sales.leaderboard.find((row) => row.user.id === user.id);
  return {
    settings, user, timeZone: zone, attention, reminders,
    openLeads: leadStats[user.id]?.open ?? 0, workingVehicles: leadStats[user.id]?.workingVehicles ?? 0,
    month: { units: mine?.units ?? 0, revenue: mine?.revenue ?? 0, commission: mine?.commission ?? 0, target: user.monthlyTarget },
    appointments: todaysAppointments(appointments, now, zone),
    activity: mergedActivity(leadActivity, vehicleActivity, 8),
  };
}
