// Fictional demo fixtures. Every person, phone number, address and garage here is invented;
// 555-01xx numbers are reserved for fiction and example.com addresses never receive mail.

export const demoLocations = ["North", "Central", "South"] as const;

/** `location` indexes `demoLocations`; null is the owner, who covers every location. */
export const demoStaff = [
  { name: "Demo Owner", email: "owner@clairmount.example", role: "owner" as const, location: null, phone: "+1 416 555 0170", monthlyTarget: null, hiredAt: "2016-04-01T13:00:00.000Z" },
  { name: "Alex Morgan", email: "salesperson@clairmount.example", role: "salesperson" as const, location: 0, phone: "+1 416 555 0171", monthlyTarget: 3, hiredAt: "2021-03-15T13:00:00.000Z" },
  { name: "Priya Shah", email: "priya@clairmount.example", role: "salesperson" as const, location: 0, phone: "+1 416 555 0172", monthlyTarget: 4, hiredAt: "2019-08-06T13:00:00.000Z" },
  { name: "Daniel Chen", email: "daniel@clairmount.example", role: "salesperson" as const, location: 1, phone: "+1 647 555 0173", monthlyTarget: 4, hiredAt: "2018-05-22T13:00:00.000Z" },
  { name: "Sofia Martin", email: "sofia@clairmount.example", role: "salesperson" as const, location: 1, phone: "+1 647 555 0174", monthlyTarget: 3, hiredAt: "2022-01-10T14:00:00.000Z" },
  { name: "Marcus Reid", email: "marcus@clairmount.example", role: "salesperson" as const, location: 2, phone: "+1 905 555 0175", monthlyTarget: 4, hiredAt: "2020-09-14T13:00:00.000Z" },
  { name: "Emma Wilson", email: "emma@clairmount.example", role: "salesperson" as const, location: 2, phone: "+1 905 555 0176", monthlyTarget: 2, hiredAt: "2024-06-03T13:00:00.000Z" },
];

/** Baseline units per month for the sales history, varied month to month so the leaderboard moves. */
export const monthlySalesBaseline: Record<string, number> = {
  "salesperson@clairmount.example": 2, "priya@clairmount.example": 3, "daniel@clairmount.example": 3,
  "sofia@clairmount.example": 2, "marcus@clairmount.example": 3, "emma@clairmount.example": 1,
};

export const demoGarages = [
  { name: "Northside Mechanical", address: "45 Demo Industrial Road, North — placeholder address", phone: "+1 416 555 0180",
    specialties: ["mechanical", "electrical", "safety_inspection", "tires"] },
  { name: "Precision Body & Paint", address: "12 Demo Collision Court, Central — placeholder address", phone: "+1 647 555 0181",
    specialties: ["body_paint", "detailing"] },
  { name: "Lakeshore Detail Centre", address: "300 Demo Lakeshore Drive, South — placeholder address", phone: "+1 905 555 0182",
    specialties: ["detailing", "tires"] },
];

// Illustrative CAD prices and kilometre readings; these are not live listings.
// [year, make, model, trim, second trim for repeat units, km, price]
export const catalog: [number, string, string, string, string, number, number][] = [
  [2022, "Jeep", "Grand Cherokee", "Limited 4x4", "Laredo 4x4", 48200, 36995],
  [2021, "Toyota", "RAV4", "XLE AWD", "LE AWD", 62400, 28995],
  [2020, "Honda", "Civic", "EX", "LX", 71300, 20995],
  [2023, "Ford", "F-150", "XLT SuperCrew 4x4", "Lariat SuperCrew 4x4", 39800, 42995],
  [2022, "Hyundai", "Tucson", "Preferred AWD", "Essential AWD", 53100, 26995],
  [2019, "Mazda", "CX-5", "GT AWD", "GS AWD", 89400, 22995],
  [2021, "Chevrolet", "Equinox", "LT AWD", "LS AWD", 65900, 21995],
  [2020, "Subaru", "Outback", "Touring", "Limited", 81200, 24995],
  [2022, "Nissan", "Rogue", "SV AWD", "SL AWD", 46700, 27995],
  [2021, "Jeep", "Wrangler", "Unlimited Sahara", "Unlimited Sport", 58200, 35995],
  [2020, "Toyota", "Corolla", "SE", "LE", 77400, 19995],
  [2022, "Honda", "CR-V", "Sport AWD", "EX-L AWD", 49600, 30995],
  [2021, "Ram", "1500", "Big Horn 4x4", "Sport 4x4", 68900, 34995],
  [2023, "Kia", "Sportage", "EX AWD", "LX AWD", 28700, 31995],
  [2019, "Volkswagen", "Golf", "Highline", "Comfortline", 93200, 17995],
  [2022, "Ford", "Escape", "SEL AWD", "SE AWD", 55900, 25995],
  [2020, "GMC", "Sierra 1500", "SLE 4x4", "Elevation 4x4", 88400, 32995],
  [2021, "Hyundai", "Elantra", "Preferred", "Ultimate", 61600, 18995],
  [2023, "Mazda", "CX-30", "GS AWD", "GT AWD", 32400, 27995],
  [2020, "Nissan", "Sentra", "SV", "SR", 73900, 16995],
  [2022, "Subaru", "Forester", "Touring", "Sport", 51700, 29995],
  [2021, "Chevrolet", "Silverado 1500", "Custom 4x4", "LT 4x4", 76200, 33995],
  [2023, "Toyota", "Camry", "SE", "XSE", 35800, 28995],
  [2020, "Kia", "Sorento", "EX V6 AWD", "LX AWD", 86700, 21995],
  [2022, "Volkswagen", "Tiguan", "Comfortline AWD", "Highline AWD", 56900, 27995],
  [2021, "Honda", "Accord", "Sport", "EX-L", 64200, 26995],
  [2019, "Ford", "Edge", "Titanium AWD", "SEL AWD", 98200, 20995],
];

/**
 * The 45 cars on the lot this month, CLA-001…CLA-045. Location is `index % 3`.
 * Days since acquisition per index; several pass 45 days and a few pass 90.
 */
export const lotAges = [
  18, 9, 33, 27, 51, 22, 64, 4, 96, 31, 47, 15, 39, 58, 26, 11, 44, 73, 7, 36, 21, 102, 29,
  13, 55, 41, 24, 88, 6, 19, 49, 34, 68, 16, 93, 25, 8, 38, 61, 14, 30, 46, 52, 3, 79,
];
export const lotHolds = [4, 13, 20, 33, 44];
/** Cars at a garage now: [lot index, repair type, garage index, days in repair, estimated cost, notes]. */
export const lotRepairs: [number, string, number, number, number, string][] = [
  [3, "detailing", 2, 1, 280, "Full interior shampoo and exterior polish before photos."],
  [11, "tires", 2, 3, 840, "Four new all-season tires; alignment check."],
  [16, "safety_inspection", 0, 5, 180, "Provincial safety; front brake pads flagged."],
  [22, "mechanical", 0, 8, 1450, "Rough idle at cold start. Waiting on an ignition coil."],
  [29, "electrical", 0, 10, 620, "Intermittent infotainment reboot; diagnosing the wiring harness."],
  [40, "body_paint", 1, 12, 2100, "Rear bumper scuff and quarter-panel dent. Paint match in progress."],
];
/** Sold earlier this month: lot index → salesperson email. */
export const lotSales: [number, string][] = [
  [9, "salesperson@clairmount.example"], [42, "priya@clairmount.example"],
  [19, "daniel@clairmount.example"], [31, "sofia@clairmount.example"], [37, "daniel@clairmount.example"],
  [5, "marcus@clairmount.example"], [14, "emma@clairmount.example"], [26, "marcus@clairmount.example"],
];

export type LeadStageKey = "new" | "contacted" | "appointment" | "won" | "lost";
/**
 * `vehicle` is a lot stock number, or `H<n>` for the n-th most recent sale in the history.
 * `hours` is the inquiry age for open leads (won/lost leads are dated from the sale or the vehicle).
 */
export type LeadSpec = {
  name: string; stage: LeadStageKey; source: string; vehicle: string; hours?: number;
  unassigned?: "failed" | "manual"; appointment?: "no_show" | "cancelled"; emailFails?: boolean; message?: string; lostReason?: string;
};
export const leadSpecs: LeadSpec[] = [
  // New: four fresh, three past the 24-hour contact limit (one past 2×), two unassigned.
  { name: "Olivia Bennett", stage: "new", source: "website", vehicle: "CLA-002", hours: 1 },
  { name: "Ethan Clarke", stage: "new", source: "autotrader", vehicle: "CLA-007", hours: 3 },
  { name: "Maya Fischer", stage: "new", source: "facebook", vehicle: "CLA-013", hours: 6, message: "Is this still available? Would you take a trade-in?" },
  { name: "Noah Kowalski", stage: "new", source: "phone", vehicle: "CLA-019", hours: 20 },
  { name: "Hannah Moreau", stage: "new", source: "website", vehicle: "CLA-024", hours: 30 },
  { name: "Lucas Ferreira", stage: "new", source: "facebook", vehicle: "CLA-009", hours: 40, emailFails: true },
  { name: "Chloe Nguyen", stage: "new", source: "autotrader", vehicle: "CLA-028", hours: 56 },
  { name: "Isaac Romero", stage: "new", source: "website", vehicle: "CLA-005", hours: 2, unassigned: "failed" },
  { name: "Grace Okafor", stage: "new", source: "walk_in", vehicle: "CLA-037", hours: 26, unassigned: "manual" },
  // Contacted
  { name: "Jordan Taylor", stage: "contacted", source: "website", vehicle: "CLA-001", hours: 36, message: "Is the Grand Cherokee still available? I would like to arrange a test drive." },
  { name: "Aiden Walsh", stage: "contacted", source: "phone", vehicle: "CLA-003", hours: 48 },
  { name: "Sophie Laurent", stage: "contacted", source: "referral", vehicle: "CLA-011", hours: 72 },
  { name: "Liam O'Brien", stage: "contacted", source: "website", vehicle: "CLA-016", hours: 96 },
  { name: "Zara Ahmed", stage: "contacted", source: "facebook", vehicle: "CLA-018", hours: 120, message: "Does it have winter tires? Looking to finance." },
  { name: "Owen Mitchell", stage: "contacted", source: "walk_in", vehicle: "CLA-022", hours: 144 },
  { name: "Leah Goldberg", stage: "contacted", source: "autotrader", vehicle: "CLA-012", hours: 192 },
  { name: "Ryan Park", stage: "contacted", source: "website", vehicle: "CLA-026", hours: 240 },
  { name: "Nadia Petrova", stage: "contacted", source: "phone", vehicle: "CLA-031", hours: 288 },
  // Appointment booked this week
  { name: "Benjamin Scott", stage: "appointment", source: "website", vehicle: "CLA-033", hours: 26 },
  { name: "Emily Tremblay", stage: "appointment", source: "facebook", vehicle: "CLA-035", hours: 50 },
  { name: "Victor Kim", stage: "appointment", source: "autotrader", vehicle: "CLA-008", hours: 60 },
  { name: "Amelia Brooks", stage: "appointment", source: "website", vehicle: "CLA-036", hours: 74 },
  { name: "Samuel Osei", stage: "appointment", source: "referral", vehicle: "CLA-039", hours: 98 },
  { name: "Isabella Rossi", stage: "appointment", source: "website", vehicle: "CLA-040", hours: 122 },
  { name: "Mohammed Haddad", stage: "appointment", source: "phone", vehicle: "CLA-042", hours: 170 },
  { name: "Charlotte Dubois", stage: "appointment", source: "walk_in", vehicle: "CLA-044", hours: 50 },
  // Won: sold this month or last month
  { name: "Jack Thompson", stage: "won", source: "website", vehicle: "CLA-010" },
  { name: "Ava Martinez", stage: "won", source: "facebook", vehicle: "CLA-020" },
  { name: "William Hughes", stage: "won", source: "phone", vehicle: "CLA-027" },
  { name: "Mia Johansson", stage: "won", source: "autotrader", vehicle: "CLA-038" },
  { name: "Henry Wright", stage: "won", source: "referral", vehicle: "H0" },
  { name: "Ella Fraser", stage: "won", source: "website", vehicle: "H1" },
  { name: "Leo Santos", stage: "won", source: "walk_in", vehicle: "H3" },
  // Lost
  { name: "Natalie Price", stage: "lost", source: "website", vehicle: "H5", lostReason: "Vehicle sold to another customer before a visit." },
  { name: "Caleb Turner", stage: "lost", source: "facebook", vehicle: "H8", lostReason: "Vehicle sold to another customer; not interested in alternatives." },
  { name: "Ruby Anderson", stage: "lost", source: "autotrader", vehicle: "H12", lostReason: "Bought a newer model elsewhere." },
  { name: "Felix Wagner", stage: "lost", source: "website", vehicle: "CLA-025", hours: 500, appointment: "no_show", lostReason: "Missed the appointment and stopped replying." },
  { name: "Layla Hassan", stage: "lost", source: "phone", vehicle: "CLA-029", hours: 110, appointment: "no_show", lostReason: "No-show; financing was declined." },
  { name: "Gabriel Silva", stage: "lost", source: "walk_in", vehicle: "CLA-014", hours: 400, appointment: "cancelled", lostReason: "Cancelled the test drive; budget changed." },
  { name: "Stella Novak", stage: "lost", source: "referral", vehicle: "CLA-045", hours: 600, lostReason: "Price was above budget after trade-in." },
];

/** Default inquiry text by source when a spec gives none. */
export const sourceMessages: Record<string, (vehicle: string) => string> = {
  website: (vehicle) => `I am interested in the ${vehicle}. Please contact me about a viewing.`,
  phone: (vehicle) => `Called about the ${vehicle}; wants pricing and a test drive.`,
  walk_in: (vehicle) => `Visited the lot and looked at the ${vehicle}.`,
  facebook: (vehicle) => `Facebook Marketplace message: is the ${vehicle} still available?`,
  autotrader: (vehicle) => `AutoTrader inquiry about the ${vehicle}. What is your best price?`,
  referral: (vehicle) => `Referred by a past customer; interested in the ${vehicle}.`,
};
export const createdActivity: Record<string, string> = {
  website: "Website inquiry received.", phone: "Phone inquiry logged by staff.", walk_in: "Walk-in customer logged by staff.",
  facebook: "Facebook Marketplace inquiry received.", autotrader: "AutoTrader inquiry received.", referral: "Referral logged by staff.",
};
/** First contact by the salesperson, logged as a call or email (the Log call / Send email quick actions). */
export const contactNotes: { type: "call" | "email"; message: string }[] = [
  { type: "call", message: "Call logged. Keen on a test drive this week." },
  { type: "call", message: "Call logged. Left a voicemail, then reached them by text. Sent the CARFAX." },
  { type: "call", message: "Call logged. Wants financing options and a trade-in estimate." },
  { type: "email", message: "Emailed photos of the interior; customer replied with questions about warranty." },
  { type: "call", message: "Call logged. Called back within the hour. Comparing with one other car." },
];
