export const settingsCopy = {
  title: "Settings", intro: "Configure labels, colours, workflow rules, garages and customer emails. Changes apply across the CRM straight away.",
  tabs: { brand: "Branding", inventory: "Inventory", leads: "Leads", thresholds: "Reminders", garages: "Garages", templates: "Email templates" },
  tabsLabel: "Settings sections",
  save: "Save changes", saving: "Saving…", saved: "Settings saved.", failed: "Settings could not be saved. Try again.", ownerOnly: "Owner access is required.",
  brand: {
    title: "Branding", hint: "Shown in the staff app, on the public site, in emails and on the home-screen icon.",
    companyName: "Company name", logoUrl: "Logo URL", logoHint: "Optional. An https:// image URL; the car icon shows when empty or broken.", primaryColor: "Brand colour",
  },
  list: {
    label: "Label", key: "Key", color: "Colour", add: "Add", remove: (label: string) => `Remove ${label}`, up: (label: string) => `Move ${label} up`, down: (label: string) => `Move ${label} down`,
    keyHint: "Keys are permanent once saved, because records store them. Leave a new key blank to derive it from the label.", newBadge: "New",
    inUseHint: "An entry can be removed only when nothing uses it.", untitled: "New entry",
  },
  inventory: {
    statuses: "Vehicle statuses", statusesHint: "Board groups and status pills, in this order.",
    roles: "Workflow roles", rolesHint: "Which status each workflow sets. Repairs and sales move cars through these.",
    role: { available: "Available (back on the lot)", repair: "In repair", sold: "Sold" },
    public: "Shown on the public site", publicHint: "Cars in these statuses appear on the public inventory.",
    repairTypes: "Repair types", repairTypesHint: "Offered when sending a car to repair, and as garage specialties.",
  },
  leads: {
    stages: "Lead stages", stagesHint: "Pipeline columns, in this order.",
    roles: "Stage roles", rolesHint: "Stages the automations set.",
    won: "Won (car sold to this lead)", lost: "Lost (closed without a sale)", appointment: "Appointment (customer booked)",
    sources: "Lead sources", sourcesHint: "Where leads come from; shown as pills on the pipeline.",
    publicSource: "Website inquiry source", publicSourceHint: "Recorded on inquiries from the public vehicle pages.",
  },
  thresholds: {
    title: "Reminder thresholds", hint: "Used by the aging colours, Needs attention and the scheduled reminders.",
    warnDays: "Aging warning (days in stock)", criticalDays: "Aging critical (days in stock)",
    repairOverdueDays: "Repair overdue after (days)", uncontactedLeadHours: "Lead not contacted after (hours)",
    customerFollowUpDays: "Customer follow-up emails (days after inquiry)", customerFollowUpHint: "Comma-separated, increasing, e.g. 2, 5. Stops once the customer books.",
  },
  errors: {
    statusInUse: (label: string) => `“${label}” is still the status of some vehicles.`,
    repairTypeInUse: (label: string) => `“${label}” is used by current or past repairs.`,
    specialtyInUse: (label: string) => `“${label}” is still a garage specialty.`,
    stageInUse: (label: string) => `Some leads are still in “${label}”.`,
    sourceInUse: (label: string) => `Some leads still have the source “${label}”.`,
    invalidKey: "Keys use lowercase letters, numbers and underscores, starting with a letter.", duplicateKey: (key: string) => `The key “${key}” is used twice.`,
    needLabel: "Every entry needs a label.", needOne: "Keep at least one entry.",
  },
} as const;
