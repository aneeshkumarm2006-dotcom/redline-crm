import type { Settings } from "../../src/modules/settings/schema";

/** Demo configuration lives only in seed scripts, never in application imports. */
export const demoSettings: Settings = {
  emailFrom: null,
  brand: { companyName: "Clairmount Auto", logoUrl: null, primaryColor: "#DC2626" },
  publicInventoryStatusKeys: ["available"],
  vehicleStatuses: [
    { key: "available", label: "Available", color: "#15803D" },
    { key: "hold", label: "HOLD", color: "#B45309" },
    { key: "sold", label: "Sold", color: "#64748B" },
  ],
  leadStages: [
    { key: "new", label: "New", color: "#2563EB", order: 0 },
    { key: "contacted", label: "Contacted", color: "#7C3AED", order: 1 },
    { key: "appointment", label: "Appointment", color: "#B45309", order: 2 },
    { key: "won", label: "Won", color: "#15803D", order: 3 },
    { key: "lost", label: "Lost", color: "#64748B", order: 4 },
  ],
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
  notificationRules: [
    { event: "lead.created", recipients: ["customer"], channels: ["email"] },
    { event: "lead.assigned", recipients: ["assigned_salesperson"], channels: ["in_app", "email"] },
    { event: "appointment.booked", recipients: ["customer"], channels: ["email"] },
    { event: "appointment.booked", recipients: ["assigned_salesperson"], channels: ["in_app", "email"] },
    { event: "vehicle.status_changed", recipients: ["dealership_salespeople"], channels: ["in_app", "email"] },
    { event: "vehicle.price_changed", recipients: ["dealership_salespeople"], channels: ["in_app", "email"] },
  ],
};
