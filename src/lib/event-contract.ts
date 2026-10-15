/** Serializable event contracts. IDs are strings, timestamps are ISO strings. */
export const eventNames = [
  "lead.created", "lead.assigned", "lead.stage_changed", "appointment.booked",
  "vehicle.status_changed", "vehicle.price_changed",
] as const;

type LeadRef = { leadId: string; vehicleId: string; dealershipId: string };
type VehicleRef = { vehicleId: string; dealershipId: string; changedBy: string };

export type EventPayloads = {
  "lead.created": LeadRef;
  // `changedBy` is present only for a manual reassignment by staff; automatic assignment omits it.
  "lead.assigned": LeadRef & { salespersonId: string; previousSalespersonId: string | null; changedBy?: string };
  "lead.stage_changed": LeadRef & { previousStage: string; stage: string; changedBy: string };
  "appointment.booked": LeadRef & { appointmentId: string; salespersonId: string; startsAt: string; endsAt: string };
  "vehicle.status_changed": VehicleRef & { previousStatus: string; status: string };
  "vehicle.price_changed": VehicleRef & { previousPrice: number; price: number };
};
export type EventName = keyof EventPayloads;
export type DomainEvent = { [K in EventName]: AppEvent<K> }[EventName];
export type AppEvent<K extends EventName> = Readonly<{
  id: string;
  name: K;
  occurredAt: string;
  payload: Readonly<EventPayloads[K]>;
}>;
