export const garagesCopy = {
  title: "Garages", intro: "Partner garages, the cars at each one and how long repairs are taking.",
  kpis: "Repair overview", inRepair: "Cars in repair", avgDays: "Avg. days in repair", overdue: "Overdue repairs", spend: "Repair spend this month",
  overdueHint: (days: number) => `Over ${days} days`, completedHint: (count: number) => `${count} repair${count === 1 ? "" : "s"} completed`,
  carsHere: "Cars there now", specialties: "Specialties", inactive: "Inactive", call: (name: string) => `Call ${name}`,
  board: "Cars in repair by garage", empty: "No garages yet", emptyHint: "Partner garages appear here once they are added to settings.",
  columns: { vehicle: "Vehicle", status: "Repair type", days: "Days in repair", estimate: "Estimate", location: "Location", started: "Started" },
  unknownDealership: "Unknown dealership",
  days: (value: number) => value.toFixed(1),
  manage: "Manage garages",
  // Owner admin (Settings → Garages)
  admin: {
    title: "Garages", hint: "Partner garages offered when a car is sent to repair. Deactivate one to stop offering it; its history stays.",
    add: "Add garage", edit: "Edit", editTitle: "Edit garage", addTitle: "Add garage", name: "Name", address: "Address", phone: "Phone",
    specialties: "Specialties", active: "Active (offered for new repairs)", save: "Save garage", saving: "Saving…", cancel: "Cancel",
    saved: "Garage saved.", created: "Garage added.", empty: "No garages yet.", inactive: "Inactive",
    unknownSpecialty: "Choose specialties from the configured repair types.", notFound: "That garage no longer exists.",
    failed: "The garage could not be saved. Try again.", ownerOnly: "Owner access is required.",
  },
} as const;
