# Foundation contract

`src/app` owns routing and thin entry points. `(public)` will contain customer
inventory and booking routes; `(crm)` will contain authenticated staff routes.
Route groups do not add URL prefixes or enforce authentication. All staff pages
live under `(crm)/crm` (`/crm/...`) and use the auth service guards described below.

## Module shape

Every folder in `src/modules` follows the same contract:

| File | Responsibility |
| --- | --- |
| `model.ts` | Server-only Mongoose schema and hot-reload-safe model registration. |
| `schema.ts` | Shared Zod input schemas and inferred DTO types; safe for forms. |
| `service.ts` | Business logic, authorization, database access, event emission. Only this module's service imports its model. |
| `actions.ts` | Future `"use server"` actions: validate, call an authorized service, revalidate the affected routes/cache, return a serializable result. |
| `components/` | Module-owned UI. |
| `events.ts` | Event types or explicit, keyed handler registration when the module needs them. |

Modules interact through services or events, never another module's model.
Shared schemas/types may be imported by forms and shared presentation components.
Keep service results plain and serializable. Credentials belong to the users model;
`auth/model.ts` stores expiring login-attempt counters. Scaffolds export no fake
business operations. Settings administration and mutation actions remain future work.

`src/components/ui` contains shadcn primitives; `src/components/shared` contains
shared app presentation. `scripts/seed` owns demo values. Application code must
never import seed files. CLI scripts also go through module services. Unit tests
may import models to substitute the database boundary.

## Authentication and authorization

Staff routes use `/crm` so public `/inventory` and `/book/[token]` cannot collide
with staff pages. `src/proxy.ts` checks signed sessions on `/crm/:path*` only.
Next.js 16 renamed the deprecated `middleware.ts` convention to `proxy.ts`.
Proxy is an early redirect, not the authorization boundary: every protected service
must call `requireRole()` (any active staff member) or `requireRole("owner")` before
reading or mutating private data. `listTeam()` demonstrates the owner guard.
Pages use `requirePageUser()` to translate 401/403 into login/access-denied redirects.
Layouts alone are insufficient to protect independent service/action entry points.

`getCurrentUser()` verifies the JWT and reads the active user from MongoDB on every
call. Roles are never taken from form inputs or JWT claims, and user data is not
globally cached. Account removal, deactivation, and role changes therefore apply
to existing sessions on their next server request. DTOs omit `passwordHash`;
Mongoose also excludes it unless the internal credential lookup opts in explicitly.
User emails are normalized and have a unique database index. Owners may have a
null dealership ID; the full seed assigns each salesperson a location. Authorization by location belongs in the
relevant business services when those are implemented.

Passwords use bcrypt cost 12. Creation requires 12–72 characters and at most 72
UTF-8 bytes; login also rejects passwords that bcrypt would silently truncate.
JWTs use HS256 with a fixed issuer/audience, validated subject and required issue/
expiration times. Sessions last eight hours in an httpOnly, SameSite=Lax, path `/`
cookie with Secure enabled in production. `AUTH_SECRET` must be at least 32 bytes.
Cookies are written only by POST server actions, with Next's same-origin checks.
Login return URLs are restricted to canonical `/crm` paths. Logout expires the
browser cookie and refreshes the router cache. Sessions are stateless: logout does
not revoke a separately copied token; that token expires after eight hours or can
be invalidated by deactivating the account/rotating the signing secret.

Login allows ten attempts per normalized email per fixed 15-minute bucket. Atomic
MongoDB counters work across instances; TTL indexes expire old buckets. Missing,
inactive, and wrong-password accounts use the same error and bcrypt comparison.
The limiter is per-account, not a global/IP abuse filter. No public signup or user
mutation endpoint is exposed. `initializeUser()` is an internal CLI-only bootstrap
that only inserts missing accounts, just like settings initialization.

Auth components read strings from the module's `copy.ts` and branding from settings.
Runtime session reads sit behind Suspense for Cache Components.

## Staff app shell (Stage 5)

`components/shared/app-shell` owns the shared server layout, navigation, account
popover, branding and empty tab screens. `/crm`, `/crm/leads`, `/crm/inventory` and
`/crm/alerts` began as guarded route scaffolds; inventory now uses the Stage 6
module screens below. The remaining scaffolds do not yet query business data or
claim that seeded records are absent. Each page calls `requirePageUser()` as well
as the layout. Future module screens replace the scaffolds and continue enforcing
authorization in their services.

Navigation uses Next links and pathname-based active states, including nested
routes. It becomes a left sidebar at 1024px; smaller screens use a fixed bottom
bar with safe-area padding and matching content clearance. A route loading
boundary preserves the shell during navigation. Visible controls are at least
44px; keyboard users have a skip link, focus indicators and an accessible account
popover with Escape/close controls and focus restoration. Owner team access lives
in the account menu, while the existing owner service guard remains authoritative.

Login and CRM share the settings brand. A missing or failed `brand.logoUrl` uses
the CarFront badge; the default seed colour is red. Logo images load directly from
the configured HTTP(S) URL without a deployment-time Next Image host allowlist.
`brand.primaryColor` sets CSS custom properties for primary, focus and sidebar
colours. Relative luminance selects black or white foreground text. The account
popover receives the variables explicitly because its portal is outside the shell.
Settings retain their normal 60-second cache; an already-mounted layout needs a
refresh to pick up changes. Shell copy and route labels live in `app-shell/copy.ts`.

## Database and settings

`connectDb()` shares an in-flight connection on `globalThis`, reuses an established
Mongoose connection, and permits retries after a failure. Models and services are
marked `server-only`. Use the Node runtime for MongoDB routes, not Edge.

Settings uses the fixed string `_id: "singleton"`; MongoDB's primary-key index
prevents duplicate settings. All service inputs and reads are Zod-validated.
`initializeSettings()` inserts only if absent; it does not replace existing settings.
There is no unauthenticated HTTP bootstrap endpoint or settings editor.

`getSettings()` coalesces concurrent reads and caches a validated value for 60 seconds
per process, across hot reloads. Each caller receives a defensive copy. Errors are
not cached. `invalidateSettingsCache()` clears the local cache; other serverless
instances pick up changes within the TTL. Future settings writes must invalidate
locally and revalidate relevant Next routes. This cache is independent of Next's
page cache. With Cache Components enabled, database-dependent server components
belong under Suspense or an explicitly configured `use cache` boundary.

Booking hours are local `HH:mm` values with a required IANA time zone; `null` means
closed. Seed hours and `America/Toronto` are demo assumptions to confirm with the
client. Status keys are data; only labels/colours from settings are displayed.
`StatusBadge` loads settings on the server. `StatusBadgeView` accepts settings for
client forms. Unknown keys display the raw key with neutral styling, so historical
records remain readable. Colour is a dot alongside readable text, not the sole cue.

## Events and email

The six event contracts live in `lib/event-contract.ts`, which is safe to import
for validation and types. The bus lives in server-only `lib/events.ts`.

```ts
const unsubscribe = on("lead.created", "notifications:follow-up", async (event) => {
  // Resolve records through services and await the provider.
});
await emit("lead.created", { leadId, vehicleId, dealershipId });
```

Call `emit` after persistence and always await it. Handler keys replace prior
registrations on hot reload; an old unsubscribe cannot remove its replacement.
Handlers all run even when one fails; the caller receives an `AggregateError`.
Registration is explicit, not an import side effect: `lib/automation.ts` registers
all handlers with stable keys, called from `src/instrumentation.ts` (and by CLI checks).
Each registration is tracked individually, so re-registering the same function
cannot be removed by an earlier registration's unsubscribe.

This is an in-process bus, not a durable queue: no cross-instance delivery, replay,
retry, transaction rollback, or exactly-once guarantee. A handler failure can occur
after the originating write commits. Future workflows must account for that before
retrying a whole operation; use durable jobs/outbox when reliability requires it.

`EmailProvider.send()` accepts a sender, recipients and rendered content.
`getEmailProvider()` selects console outside production and Resend in production;
production requires `RESEND_API_KEY`. The caller supplies the verified sender
address (future email configuration), never a hardcoded application fallback.
Console output includes email content: use demo data during local development.

Templates use `{{placeholder}}` with flat names. Missing values throw. HTML values
are escaped; subjects reject newlines. Template markup must be trusted. HTML escaping
does not validate URLs: future booking URLs must be built from validated `APP_URL`
and encoded tokens, never arbitrary customer URLs. Stored email templates are owned
by `modules/email-templates`; automatic notifications are Stage 8. The smoke check explicitly uses ConsoleProvider
regardless of environment and never sends a real email.

## Verification

```powershell
npm test
npm run lint
npm run typecheck
npm run build
npm run seed:settings
npm run foundation:check
```

`seed:settings` writes only a missing settings singleton to the database in
`.env.local`; repeated runs preserve existing configuration. `npm run seed` is the
separate destructive full-demo reset. `foundation:check` reads settings and emits a synthetic
event to a temporary console-email handler without creating leads or vehicles.
The Node CLI/test commands use `--conditions=react-server` to load server-only
modules outside Next. Tests mock database access and require no credentials.

## Data models and demo reset (Stage 4)

Dealership, Vehicle, Lead, Appointment, Notification and EmailTemplate have strict,
timestamped Mongoose models plus JSON-safe Zod input/record schemas. The field
`vin` stores the VIN; stock numbers/VINs normalize to uppercase. Prices are CAD
decimal amounts with at most two fractional digits, mileage is kilometres, and
dates are BSON Dates in MongoDB / ISO strings in DTOs. ObjectId references connect
records to their dealership, vehicle, lead and staff member. Histories include
previous/new values, change time and actor; lead activity includes type, message,
time and nullable actor. Photo arrays accept HTTP(S) URLs or local asset paths.

Stock numbers, VINs, booking tokens and email-template keys have unique indexes.
Lead tokens contain 32 random bytes, are URL-safe and excluded from default
Mongoose queries; booking workflows must explicitly select them. Appointment
statuses are `booked`, `completed`, `cancelled`, `no_show`, with end after start.
One lead can have at most one `booked` appointment, and one salesperson at most one
`booked` appointment per start time (partial unique indexes; see Stage 9). Compound
indexes support dealership/status inventory filters, assigned lead lists, upcoming
appointments and unread notifications.

Vehicle status and lead stage are settings keys, never hardcoded Mongoose enums.
The CLI import checks membership; the whole seed plan also checks all references,
location assignments and appointment consistency before resetting any data. Model
save/validate hooks enforce shape using Zod. Future query-based updates must run
service validation explicitly: Mongoose query updates do not run these hooks.
Future runtime services must enforce references, settings membership and staff
authorization on every mutation. Stage 4 exposes no new HTTP actions or CRUD UI.

## Staff inventory (Stage 6)

`/crm/inventory` supports literal case-insensitive make/model/stock-number search,
combined dealership/status filters, 24-record pagination, mobile cards and a desktop
table. Query-string filters survive reloads and pagination. Its dealership/status
summary covers all stock, independently of the list filters, and includes configured
statuses with zero counts. Labels and colours come from settings; UI copy lives in
`modules/inventory/copy.ts`. Missing or broken photo URLs show a vehicle placeholder.

All active staff can read stock across locations. Only owners can create, edit,
change status or change price; every mutation service enforces this independently
of the UI. `/new` and `/[id]/edit` also have owner page guards. Vehicle detail shows
specs, photos, audit histories with staff attribution and linked lead contact/stage
information. Owners see all linked leads; salespeople see only assigned leads.
Lead detail navigation remains in Stage 10, when those routes exist.

Form schemas exclude histories and actors. Services validate settings membership,
dealership existence/active state, money precision and photo protocols. Existing
inactive locations or retired status keys may be retained on general edits, but
cannot be newly assigned. Stock/VIN uniqueness is enforced by database indexes.
The model's `__v` is exposed as a revision and included in a compare-and-swap update;
one atomic write changes fields, appends histories and increments the revision.
Stale tabs fail with a refresh message instead of overwriting a newer change.
No-op changes append no history and emit no events. Both dedicated controls and
the full edit form follow this same path, including edits that change price and
status together. Status changes append `statusHistory`; price changes append
`priceHistory`, each with previous/new values, timestamp and authenticated actor.

After persistence, services await the corresponding event handlers. A handler
failure returns a saved-with-warning result, avoiding an instruction to repeat a
committed write. Actions revalidate inventory list/detail routes and return safe
errors. The bus is still in-process and non-durable; Stage 8 owns handler registration
and real notification delivery. No notification/email side effects are introduced
by Stage 6. The status sheet opens from the card and immediately saves a selected
status, meeting the two-tap demo requirement without a confirmation step.

`scripts/seed/data.ts` owns fixtures and plan validation. The CLI writes only
through module `replace*ForSeed()` services, which are internal and destructive;
never call them from actions/routes. No event handlers or email providers run.
The reset clears only the nine CRM collections listed in the README. It is
repeatable, but not atomic across collections; rerun after an interrupted reset.
New user IDs invalidate prior sessions. Local generated passwords persist across
runs in the gitignored credentials file. Settings initialization remains
non-destructive; only the full seed replaces configuration.

Email templates use keys `follow_up`, `booking_confirmation`, `new_lead`, and
`status_change`; resolve them with `getEmailTemplate(key)` and render through
`renderEmailTemplate`. Their required flat placeholders are visible in
`scripts/seed/templates.ts`. Only trusted administration should edit template
HTML. Customer names/messages are escaped by the renderer; workflows must build
safe booking/CRM URLs and format appointment times in the configured time zone.

## Public inventory and inquiry intake (Stage 7)

Public pages are thin routes under `(public)/inventory`, with runtime reads under
Suspense. The branded shell uses settings; UI strings are centralized in
`inventory/public-copy.ts` and `leads/copy.ts`. `/` redirects to `/inventory`.
`listPublicVehicles` and `getPublicVehicle` are explicit unauthenticated reads,
separate from the guarded staff services. They query only configured public status
keys and active dealerships, select an allowlist of fields, and validate a public
DTO that excludes audit histories, staff identities and revisions. Public
location reads return only name, address, phone and ID. Pagination is capped at
24 records; invalid filters display a recoverable message.

`Settings.publicInventoryStatusKeys` defaults to `["available"]` when missing for
compatibility with Stage 4 databases. The seed now supplies it explicitly.
Unknown keys never expose vehicles, and an empty array disables public inventory.
Status labels/colours still come from `vehicleStatuses`; there are no UI status
comparisons. The first lead stage is determined by lowest configured `order`.

`leads.service.create` is the sole public intake write. Its strict schema accepts
only customer fields, a vehicle ID and an inquiry UUID. The service derives the
dealership, stage, source, assignment, token and activity itself; it rejects a
missing/hidden vehicle or inactive location. The form reuses the shared schema,
keeps entered fields on failure, disables submission while pending, and focuses
the thank-you heading after success. A transport prop supports future embedding;
no cross-origin endpoint is exposed in this stage. Server Actions retain Next's
same-origin protections. The public result contains no lead ID, booking token,
customer record or database diagnostics.

A sparse unique `inquiryId` index allows existing seeded leads without a UUID and
makes concurrent/repeated requests idempotent. The service checks that a replay
matches the original normalized customer fields and vehicle, returns success
without re-emitting, and handles duplicate-key races. Availability is checked on
new submissions, not on a retry of an already saved inquiry. This is intake, not
a vehicle reservation: a status change racing between the availability read and
lead insert can still produce an inquiry, and a new form identity can create
another lead. Abuse throttling/CAPTCHA is outside this demo stage.

After persistence, `lead.created` is awaited with vehicle and dealership IDs.
Handler failures log the lead ID without customer data and preserve customer
success; cache revalidation failures also cannot report a committed write as a
failed submission. This retains the existing in-process bus limitations: a crash
between insert and emission or a failed handler has no durable replay. Stage 8
must register handlers and decide on delivery retries/outbox behavior. No emails,
assignment or appointment workflow is introduced here.

**v2 polish (Stage 8 of the v2 plan):** `/inventory` has a hero (brand, location
cards with address, phone and live counts from `countPublicVehiclesByDealership`)
and location chips instead of the select form. Public listings
(`listPublicVehicles`, `getPublicVehicle`) now return `PublicListing`: the public DTO
plus a server-derived `badge` (`price_drop` when the last price change was a cut
within 30 days, else `new_arrival` within 14 days of acquisition). Acquisition date
and price history are read to derive it but never leave the service. The vehicle
page has a client gallery (arrows, swipe, thumbnails), a key-specs grid, a trust
strip (fictional copy in `public-copy.ts`) and, on phones, a sticky price + Test
drive / Inquire bar that hides while the form is visible. `?intent=test-drive`
re-keys the form with a test-drive title and pre-filled message.

Inquiries still record `settings.publicInquirySourceKey` (default `website`). They
also carry an optional `utmSource`: `UtmCapture` (in the public shell) stores a
landing `utm_source` in sessionStorage for the tab, the form sends it, and the lead
stores it (schema `nullish`, so older leads validate). It shows on the lead detail
as "Website · facebook" and in the creation activity.

## Lead automation (Stage 8)

`registerAutomation()` (`lib/automation.ts`) wires the handlers to the bus; Next
calls it once per Node process from `instrumentation.ts`. Since v2 Stage 6 most
handlers are **recipes**, registered with `onRecipe(event, recipeKey, handler)`:
a recipe runs only while `Settings.automations[recipeKey]` is not `false`, and
every outcome (`success`, `skipped`, `failed`) is written to `automation_runs`,
one run per (event ID, recipe). Delivery for each event's `notificationRules` is
split by audience (customer vs staff) so each half belongs to one recipe:

| Key | Event(s) | Does |
| --- | --- | --- |
| `recipe:lead_auto_assign` | `lead.created` | Applies `leadAssignmentStrategy`; round-robin emits `lead.assigned`. |
| `recipe:lead_follow_up_email` | `lead.created` | Emails the customer, unless staff already spoke with them. |
| `recipe:<alert recipe>` | the other events | Customer or staff half of `notificationRules` (see `alertRecipes`). |
| `recipe:appointment_stage_update` | `appointment.booked` | Moves the lead to `booking.appointmentStageKey`. |
| `notifications:<audience>` | events without a recipe for that audience | Plain rule delivery, not listed on the Automations page. |
| `notifications:activity` | all except `lead.created` | Appends a readable entry to the lead's or vehicle's `activity[]`. |
| `leads:won` | `vehicle.sold` | Moves the linked lead to the won stage. |

Scheduled reminders live in `modules/automations/reminders.ts`
(`runScheduledAutomations(now)`), triggered by `/api/cron` (`CRON_SECRET`) or the
owner's **Run now**. Each reminder claims a deterministic run key first, so
repeats on the same day send nothing.

Round-robin uses an atomic per-dealership counter (`lead_assignment_cursors`)
over active salespeople at the vehicle's location, ordered by ID, so concurrent
inquiries and multiple instances distribute evenly. Assignment is a conditional
update (`assignedTo: null`), so it never overwrites a manual assignment. With
`manual` or no active staff the lead stays unassigned; the customer is still emailed.
The full seed clears the cursors.

Recipients are `customer`, `assigned_salesperson` (must still be an active
salesperson at that location), `dealership_salespeople` and `owners`. Overlapping
rules are merged per recipient, and customers never receive in-app alerts. The
customer gets `follow_up` (lead events) or `booking_confirmation` (appointments);
staff get `new_lead`, `status_change`, `price_change`, `stage_change` or
`appointment_notice`. Labels, money and times come from settings (CAD,
`booking.timeZone`). Links come only from `emailUrl()`, which accepts a bare
HTTP(S) `APP_URL` origin; the booking token appears only in the customer's email.

Channels are isolated: each in-app write and each email settles independently, so
an email failure (provider outage, missing template, unset `emailFrom`, unsafe
`APP_URL`) cannot suppress in-app alerts. Failures are logged with the event ID
only (no customer data) and re-thrown as an `AggregateError`; intake and inventory
already treat post-save handler failures as warnings. In-app notifications carry
the event ID under a unique `(eventId, userId)` index, and activity entries skip a
repeated event ID, so re-dispatching an event does not duplicate alerts or audit.

Limits carried from the bus: no durable retry. An email lost to a provider outage
is not resent; a durable outbox is the upgrade path. Alert links point at the
lead detail (`/crm/leads/<id>`) or the vehicle.
`seed:automation` inserts missing templates non-destructively for older databases.

## Appointment booking (Stage 9)

`/book/[token]` is a thin public route over `appointments/components/booking-screen`.
The bearer token is the lead's 32-byte `bookingToken`; `leads.getLeadForBooking()`
validates its format before querying and never returns it. The page DTO carries no
IDs, emails or tokens. Metadata sets `noindex` and `referrer: no-referrer`.

`slots.ts` is pure: `buildSlotDays(booking, now, booked)` walks `daysAhead` local
dates from "today" in `booking.timeZone`, converts each day's `HH:mm` hours to UTC
with a two-pass offset correction (correct across DST), cuts `slotLengthMinutes`
slots, and drops slots that have started or overlap a booked interval.
`getAvailableSlots(salespersonId)` feeds it the salesperson's booked appointments.
Availability is per salesperson: the appointment is always with the lead's assigned,
active salesperson at the lead's location; otherwise online booking is unavailable.

`book()` re-derives availability on the server and accepts only a start time that is
currently a free slot (the client's slot list is never trusted). Two partial unique
indexes make concurrent requests safe without transactions: `{leadId}` and
`{salespersonId, startsAt}` for `status: "booked"`. On a duplicate key the service
reports "already booked" or "taken"; a repeat of the lead's own booked time is a
replay and succeeds with no side effects. Because every slot comes from the same
grid, the start-time index covers real races; an overlap with a misaligned older
appointment (after a slot-length change) is still excluded by the availability check,
leaving only a narrow window if the setting changes during a booking.

After the insert, `leads.advanceLeadForBooking()` moves the lead to
`booking.appointmentStageKey` only if its current stage has a lower `order`, using a
conditional update so a concurrent staff change wins, and appends a stage activity
(actor `null`: the customer). It does not emit `lead.stage_changed`, whose contract
requires a staff actor. Then `appointment.booked` is emitted; Stage 8 handlers send
the emails/alerts and log the activity. Stage and handler failures are logged by
appointment ID and do not fail the committed booking. The action does not revalidate:
staff pages render per request, and revalidating would re-render the customer's page
into its "already booked" state, replacing the confirmation they are reading.

Public pages that read the database call `connection()` so Next renders them per
request. The settings cache uses `performance.now()` for its TTL, which avoids
reading `Date.now()` during render.


## Leads CRM screens (Stage 10)

`/crm/leads` lists leads (mobile cards, desktop table) with stage badges, linked
vehicle, assignee, location and age; filters are search (name/email/phone), stage,
and for owners dealership and assignee (including "unassigned"). `/crm/leads/[id]`
shows tap-to-call/email, details, the linked vehicle card, booked appointments,
a note form and the activity timeline. `/crm/leads/appointments` lists booked
appointments for today and upcoming days in `booking.timeZone`.

Visibility lives in `leads.service`: every staff read and write adds the same scope
(salespeople: `assignedTo = self`; owners: all). Out-of-scope leads read as missing.
`getLeadSummaries`, `listRecentLeadActivity` and `countLeadsSince` apply that scope
for the appointment and dashboard screens; `listStaffAppointments` scopes by
salesperson.

Mutations carry the value the user saw and update conditionally on it, so a
concurrent change returns "refresh and try again" instead of overwriting:
`changeLeadStage` (any assigned staff, settings stages only, emits
`lead.stage_changed` with `changedBy`), `reassignLead` (owner only, target must be
an active salesperson at the lead's location, emits `lead.assigned` with
`previousSalespersonId` and the optional `changedBy`), and `addLeadNote` (pushes a
`note` activity attributed to the author). Stage/assignment activity is written by
the existing `notifications:activity` handler; a handler failure returns a
saved-with-warning result. Reassigning does not move an existing booked appointment.
Staff stage changes may move a lead in any direction (bookings still only advance).

Notification and email links now point at `/crm/leads/<id>`.

## Dashboard, alerts and polish (Stage 11)

`/crm` shows new leads since local midnight, today's appointments, a per-status stock
count for every configured vehicle status (each tile links to the filtered
inventory, so HOLD is not hardcoded), today's appointment list and the ten newest
lead + vehicle activity entries. Counts follow the same role scopes.

**v2 (Stage 7):** `modules/dashboard/service.ts` builds both dashboards from other
services only (`inventory.listStockSnapshot`, `leads.countLeadsByStage` /
`countLeadsSince`, `sales.getSalesSummary`, `automations.getNeedsAttention`,
appointments and recent activity). The owner's Command Center takes
`?dealershipId=` (unknown IDs fall back to all locations), which every read,
including Needs attention, honours. Salespeople get their own figures
(`getSalespersonDashboard`). Definitions: inventory value, average days and aging
buckets cover unsold cars; Sold counts this month only (the board's rule); the lead
funnel counts leads from the last 6 months at each open stage or further (lost
leads count only as received), and conversion is won ÷ (won + lost) over the
same window. Every tile and chart mark links to its filtered board; the inventory
board gained `minDays`/`maxDays` (unsold, whole days in stock) and `soldBy` for
those links, shown as removable chips.

`notifications.service` exposes the signed-in user's own alerts only
(`listMyNotifications`, `getUnreadSummary`, `markNotificationRead`,
`markAllNotificationsRead`). The header bell shows the unread count; it polls a
server action every 20 s while the tab is visible and on navigation, and toasts
"New alert" with a View action when a newer unread alert appears. Opening an alert
marks it read and follows its link. Polling is the demo trade-off for push.

Route `loading.tsx` files render `ScreenSkeleton`; lists use `EmptyState`; lead and
alert actions toast success, warnings and errors. Search/filter forms on leads and
inventory sit in a collapsible `FilterDisclosure` (open while filters are active)
so lists start near the top of a phone screen. Server components read the clock
through `lib/clock.ts` (`requestNow()`).

`app/manifest.ts` serves an installable manifest (`start_url` and `id` `/crm`,
standalone) named and coloured from the settings brand. `/app-icon/{180,192,512}`
renders a brand-coloured CarFront PNG (one image for `any` and `maskable`); the
CRM layout sets the Apple touch icon and web-app metadata. Both read settings per
request and fall back to neutral values if the database is unavailable. A
configured `brand.logoUrl` is not used for home-screen icons yet. No service worker
or offline mode is included.


## Extras (v2 Stage 9)

**Appointments week view.** `/crm/leads/appointments?view=week&week=YYYY-MM-DD` shows Monday to
Sunday in the settings time zone (`localWeek`, and `addDays` is now exported from `slots.ts`). It
reads `listAppointmentsBetween` (booked + completed), so salespeople only get their own calendar.
Owners can add `&dealershipId=` and `&salespersonId=`; unknown IDs are ignored. Closed days come from
`booking.businessHours`.

**Settings admin** (`/crm/settings?tab=brand|inventory|leads|thresholds|garages|templates`, owner).
- `settings/admin-service.saveSettingsSection` validates one section (`settingsSectionSchema`). It
  refuses to remove a key that records still use: `inventory.findVehicleKeysInUse`,
  `leads.findLeadKeysInUse` and `garages.findGarageSpecialtiesInUse`. It then calls
  `settings.replaceSettings`, which re-validates the whole document and its cross-references
  (`settingsReferenceProblems`: status roles, public statuses, won/lost/appointment stages, inquiry
  source) and invalidates the cache. Saved keys are immutable in the UI. New entries take a typed key
  or one derived from the label. Stage order is the list order.
- `settings/service` still imports no other module; the orchestration lives in `admin-service.ts`.
- Garages: `garages.createGarage` / `updateGarage` (owner; specialties must be repair-type keys).
  Deactivated garages stop being offered for new repairs, and their history is kept.
- Email templates: `listEmailTemplates` / `updateEmailTemplate` (owner). Keys are fixed. An edit may
  use only the placeholders every send path supplies (`commonPlaceholders`) plus those the stored
  template already uses, because rendering throws on a missing value. The preview is a `sandbox=""`
  iframe.

**CSV export.** `Board` takes `exportName` and renders an Export CSV button. The export is built in
the browser from the board's own columns and visible groups (`components/shared/board/csv.ts`):
labels instead of keys, plain numbers for money. The inventory, team, garages and salesperson
boards use it. Leads have `GET /crm/leads/export` with the board/list filters (the stage applies in
list view), through `leads.exportLeads`. All CSV goes through `lib/csv.ts` (BOM, quoting, formula
guard), which the commission report now shares.

**Saved views** (`modules/views`, collection `board_views`): personal named filter sets for the
inventory board and the leads screen. They are stored per user, so they follow the owner across
devices. Queries are normalised to each board's known keys (pagination is never saved). Saving
under an existing name replaces that view, with at most 20 per board. `npm run seed` clears them,
because user IDs change on reseed.

**Pipeline drag and drop.** `PipelineDndProvider` / `PipelineDropColumn` / `useDraggableLead` use
native HTML drag and drop. A drop calls `changeLeadStageAction` with the card's stage as the
conflict check. Cards are `role="button"` elements, because Firefox won't start a drag from a
`<button>`. Tap-to-move stays the keyboard and phone path.
