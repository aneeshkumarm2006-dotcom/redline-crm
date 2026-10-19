import type { Settings } from "../../src/modules/settings/schema";
import { automationRecipeKeys } from "../../src/modules/automations/schema";

/** Demo configuration lives only in seed scripts, never in application imports. */
export const demoSettings: Settings = {
  emailFrom: null,
  brand: { companyName: "Clairmount Auto", logoUrl: null, primaryColor: "#DC2626" },
  publicInventoryStatusKeys: ["available"],
  vehicleStatuses: [
    { key: "available", label: "Available", color: "#15803D" },
    { key: "hold", label: "HOLD", color: "#B45309" },
    { key: "in_repair", label: "In Repair", color: "#7C3AED" },
    { key: "sold", label: "Sold", color: "#64748B" },
  ],
  statusRoles: { available: "available", repair: "in_repair", sold: "sold" },
  repairTypes: [
    { key: "mechanical", label: "Mechanical", color: "#2563EB" },
    { key: "body_paint", label: "Body/Paint", color: "#DB2777" },
    { key: "detailing", label: "Detailing", color: "#0D9488" },
    { key: "tires", label: "Tires", color: "#475569" },
    { key: "safety_inspection", label: "Safety inspection", color: "#CA8A04" },
    { key: "electrical", label: "Electrical", color: "#7C3AED" },
  ],
  leadSources: [
    { key: "website", label: "Website", color: "#2563EB" },
    { key: "phone", label: "Phone", color: "#0D9488" },
    { key: "walk_in", label: "Walk-in", color: "#B45309" },
    { key: "facebook", label: "Facebook", color: "#1D4ED8" },
    { key: "autotrader", label: "AutoTrader", color: "#EA580C" },
    { key: "referral", label: "Referral", color: "#15803D" },
  ],
  publicInquirySourceKey: "website",
  leadStages: [
    { key: "new", label: "New", color: "#2563EB", order: 0 },
    { key: "contacted", label: "Contacted", color: "#7C3AED", order: 1 },
    { key: "appointment", label: "Appointment", color: "#B45309", order: 2 },
    { key: "won", label: "Won", color: "#15803D", order: 3 },
    { key: "lost", label: "Lost", color: "#64748B", order: 4 },
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
