import type { Settings } from "../../src/modules/settings/schema";
import { automationRecipeKeys } from "../../src/modules/automations/schema";

/** Demo configuration lives only in seed scripts, never in application imports. */
export const demoSettings: Settings = {
  emailFrom: null,
  brand: { companyName: "Clairmount Auto", logoUrl: null, primaryColor: "#D21F3C" },
  publicInventoryStatusKeys: ["available"],
  vehicleStatuses: [
    { key: "available", label: "Available", color: "#0B875E" },
    { key: "hold", label: "HOLD", color: "#F2A516" },
    { key: "in_repair", label: "In Repair", color: "#6D4AE8" },
    { key: "sold", label: "Sold", color: "#4B5568" },
  ],
  statusRoles: { available: "available", repair: "in_repair", sold: "sold" },
  repairTypes: [
    { key: "mechanical", label: "Mechanical", color: "#2F5BEA" },
    { key: "body_paint", label: "Body/Paint", color: "#D9487E" },
    { key: "detailing", label: "Detailing", color: "#14A38B" },
    { key: "tires", label: "Tires", color: "#4B5568" },
    { key: "safety_inspection", label: "Safety inspection", color: "#E8B21C" },
    { key: "electrical", label: "Electrical", color: "#7C5CFC" },
  ],
  leadSources: [
    { key: "website", label: "Website", color: "#2F5BEA" },
    { key: "phone", label: "Phone", color: "#14A38B" },
    { key: "walk_in", label: "Walk-in", color: "#F07B3F" },
    { key: "facebook", label: "Facebook", color: "#1E40C0" },
    { key: "autotrader", label: "AutoTrader", color: "#C2410C" },
    { key: "referral", label: "Referral", color: "#0B875E" },
  ],
  publicInquirySourceKey: "website",
  leadStages: [
    { key: "new", label: "New", color: "#2F5BEA", order: 0 },
    { key: "contacted", label: "Contacted", color: "#7C5CFC", order: 1 },
    { key: "appointment", label: "Appointment", color: "#F07B3F", order: 2 },
    { key: "won", label: "Won", color: "#0B875E", order: 3 },
    { key: "lost", label: "Lost", color: "#4B5568", order: 4 },
  ],
  wonStageKey: "won",
  lostStageKey: "lost",
  booking: {
    timeZone: "America/Toronto",
    businessHours: {
      monday: { opensAt: "09:00", closesAt: "18:00" },
      tuesday: { opensAt: "09:00", closesAt: "18:00" },
      wednesday: { opensAt: "09:00", closesAt: "18:00" },
      thursday: { opensAt: "09:00", closesAt: "18:00" },
      friday: { opensAt: "09:00", closesAt: "18:00" },
      saturday: { opensAt: "10:00", closesAt: "16:00" },
      sunday: null,
    },
    slotLengthMinutes: 30,
    daysAhead: 14,
    appointmentStageKey: "appointment",
  },
  leadAssignmentStrategy: "round_robin",
  inventoryAging: { warnDays: 45, criticalDays: 90 },
  repairOverdueDays: 7,
  uncontactedLeadHours: 24,
  customerFollowUpDays: [2, 5],
  // Every recipe starts on; the Automations page (Stage 6) toggles them.
  automations: Object.fromEntries(automationRecipeKeys.map((key) => [key, true])),
  notificationRules: [
    { event: "lead.created", recipients: ["customer"], channels: ["email"] },
    { event: "lead.assigned", recipients: ["assigned_salesperson"], channels: ["in_app", "email"] },
    { event: "appointment.booked", recipients: ["customer"], channels: ["email"] },
    { event: "appointment.booked", recipients: ["assigned_salesperson"], channels: ["in_app", "email"] },
    { event: "vehicle.status_changed", recipients: ["dealership_salespeople"], channels: ["in_app", "email"] },
    { event: "vehicle.price_changed", recipients: ["dealership_salespeople"], channels: ["in_app", "email"] },
    // Repair and sale workflows: the location's salespeople see the car leave or return to the lot, and the seller sees the sale.
    { event: "vehicle.repair_started", recipients: ["dealership_salespeople"], channels: ["in_app"] },
    { event: "vehicle.repair_completed", recipients: ["dealership_salespeople"], channels: ["in_app"] },
    { event: "vehicle.sold", recipients: ["assigned_salesperson", "dealership_salespeople", "owners"], channels: ["in_app"] },
  ],
};
