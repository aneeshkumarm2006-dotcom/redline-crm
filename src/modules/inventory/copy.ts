export const inventoryCopy = {
  title: "Inventory", intro: "Your stock, across every location.", add: "Add vehicle", edit: "Edit vehicle",
  summary: "Stock by location", summaryHint: "All inventory, independent of the filters below.",
  filters: "Search and filters", search: "Search inventory", searchPlaceholder: "Make, model or stock #", dealership: "Dealership", status: "Status",
  allDealerships: "All dealerships", allStatuses: "All statuses", apply: "Apply filters", clear: "Clear filters",
  empty: "No vehicles found", emptyHint: "Try another search or clear your filters.",
  changeStatus: "Change status", statusHint: "Tap a status to save it immediately.", current: "Current",
  editPrice: "Edit price", priceHint: "Every price change is recorded in the vehicle history.",
  save: "Save vehicle", savePrice: "Save price", saving: "Saving…", saved: "Vehicle saved.", statusSaved: "Status updated.", priceSaved: "Price updated.",
  cancel: "Cancel", close: "Close", back: "Back to inventory", details: "Vehicle details", specs: "Specifications",
  photos: "Photos", noPhoto: "No photo available", leads: "Linked leads", noLeads: "No linked leads visible to you.",
  priceHistory: "Price history", statusHistory: "Status history", noHistory: "No changes recorded yet.",
  previous: "Previous", next: "Next", loading: "Loading inventory…", error: "Inventory could not be loaded.", retry: "Try again",
  formHint: "Enter the vehicle details and optional photo URLs. Prices are in CAD and mileage is in kilometres.",
  fields: { stockNo: "Stock number", vin: "VIN", year: "Year", make: "Make", model: "Model", trim: "Trim", mileage: "Mileage (km)", price: "Price (CAD)", dateInStock: "Date in stock", photos: "Photo URLs (one per line)" },
  invalidForm: "Check the highlighted fields.", networkError: "Unable to save. Check your connection and try again.",
  inactive: "Inactive", unknownDealership: "Unknown dealership", unknownActor: "Former staff member",
  results: (count: number) => `${count} vehicle${count === 1 ? "" : "s"}`,
  page: (page: number, total: number) => `Page ${page} of ${total}`,
} as const;
export const vehicleTitle = (vehicle: { year: number; make: string; model: string }) => `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
export const formatPrice = (price: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 2 }).format(price);
export const formatMileage = (mileage: number) => `${new Intl.NumberFormat("en-CA").format(mileage)} km`;
export const formatDate = (value: string, timeZone = "UTC") => new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone }).format(new Date(value));
export const formatTimestamp = (value: string, timeZone: string) => new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value));
