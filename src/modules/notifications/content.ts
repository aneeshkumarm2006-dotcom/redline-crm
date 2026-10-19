import type { DomainEvent } from "@/lib/event-contract";

/** Display values resolved by the caller from settings and users, so the log never shows raw keys or IDs. */
export type ActivityLabels = {
  staffName: (id: string) => string;
  statusLabel: (key: string) => string;
  stageLabel: (key: string) => string;
  repairTypeLabel: (key: string) => string;
  garageName: (id: string) => string;
  money: (amount: number) => string;
  time: (iso: string) => string;
};

/** Ends text with one full stop; formatted times like "10:00 a.m." already end with one. */
export const sentence = (text: string) => text.endsWith(".") ? text : `${text}.`;

/** Shared plain-text audit copy, independent of email delivery/configuration. */
export function activityMessage(event: DomainEvent, labels: ActivityLabels) {
  switch (event.name) {
    case "lead.created": return "Customer inquiry received.";
    case "lead.assigned": return `Lead assigned to ${labels.staffName(event.payload.salespersonId)}.`;
    case "lead.stage_changed": return `Stage changed from ${labels.stageLabel(event.payload.previousStage)} to ${labels.stageLabel(event.payload.stage)}.`;
    case "appointment.booked": return sentence(`Appointment booked for ${labels.time(event.payload.startsAt)}`);
    case "vehicle.status_changed": return `Status changed from ${labels.statusLabel(event.payload.previousStatus)} to ${labels.statusLabel(event.payload.status)}.`;
    case "vehicle.price_changed": return `Price changed from ${labels.money(event.payload.previousPrice)} to ${labels.money(event.payload.price)}.`;
    case "vehicle.repair_started": return `Sent to ${labels.garageName(event.payload.garageId)} for ${labels.repairTypeLabel(event.payload.repairTypeKey)}. Status changed from ${labels.statusLabel(event.payload.previousStatus)} to ${labels.statusLabel(event.payload.status)}.`;
    case "vehicle.repair_completed": return `${labels.repairTypeLabel(event.payload.repairTypeKey)} at ${labels.garageName(event.payload.garageId)} completed for ${labels.money(event.payload.cost)}. Status changed from ${labels.statusLabel(event.payload.previousStatus)} to ${labels.statusLabel(event.payload.status)}.`;
    case "vehicle.sold": return `Sold by ${labels.staffName(event.payload.salespersonId)} for ${labels.money(event.payload.price)}, commission ${labels.money(event.payload.commission)}.`;
  }
}
