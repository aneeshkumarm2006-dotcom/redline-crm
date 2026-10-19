# REDLINE CRM application

## Local development

Use Node.js 24 LTS and npm (the lockfile is committed).

```powershell
cd site # from the repository root
npm ci
# Fresh checkout only; do not overwrite an existing .env.local:
Copy-Item .env.example .env.local
npm run dev
```

Open http://localhost:3000/inventory for customer inventory, or
http://localhost:3000/login for staff access. `/` redirects to public inventory.

## Environment

Keep these variables in `site/.env.local`, never in source control:

| Variable | Value |
| --- | --- |
| `MONGODB_URI` | Atlas driver URI with database credentials and the `redline` database name. |
| `AUTH_SECRET` | Random secret, at least 32 bytes, for session signing. |
| `RESEND_API_KEY` | Resend API key when real email delivery is enabled; may be empty during setup. |
| `APP_URL` | `http://localhost:3000` locally; the app's public origin when deployed. |
| `CRON_SECRET` | Random secret protecting `/api/cron` (scheduled reminders); Vercel Cron sends it as `Authorization: Bearer <CRON_SECRET>`. |
| `AUTOMATION_INTERVAL_MINUTES` | Optional. Minutes between in-process reminder runs on a long-running server (default 15 in development, off in production, where Vercel Cron calls `/api/cron`). `0` disables. Runs are idempotent, so it is safe alongside the cron. |
| `EMAIL_PROVIDER=smtp` + `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (`SMTP_FROM`, `EMAIL_REPLY_TO` optional) | Send through any SMTP account, e.g. Gmail with an app password (`smtp.gmail.com`, port 465). Mail goes out as the SMTP account with the Settings company name as the display name. Reserved demo domains (`example.com`, `*.example`, `*.test`, `*.invalid`) are never sent, only logged. |

Generate an auth secret locally:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Business settings, statuses, and branding belong in the database, not environment
variables. Auth UI strings are centralized in `src/modules/auth/copy.ts`.
Never prefix these secrets with `NEXT_PUBLIC_`.

## MongoDB Atlas

Use an existing Atlas cluster, or create a **Free (M0)** cluster in an Atlas
project. Create a database user with `readWrite` access to the `redline` database
and add your current development IP to the project's network access list.
In **Connect → Drivers**, copy the Node.js URI into `MONGODB_URI`; replace the
password placeholder (URL-encode special characters) and put `/redline` before
the query string. Do not commit the resulting URI.

See MongoDB's [free cluster setup](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/)
and [connection prerequisites](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/).

```powershell
npm run db:check
```

This loads Next.js development environment files, connects using Mongoose, sends
a read-only ping, and disconnects. Failure exits nonzero without printing the URI
or driver error. It does not create collections or seed data. The application uses
the shared cached connection helper in `src/lib/db.ts`.

## Foundation

See [ARCHITECTURE.md](ARCHITECTURE.md) for module boundaries, settings, events,
email adapters and cache semantics. Initialize the settings singleton once:

```powershell
npm run seed:settings
npm run foundation:check
```

The seed preserves existing settings. The check reads settings and delivers a
synthetic event to the console email provider; it sends no external email.
Demo opening hours and the booking time zone are provisional configuration.

## Staff authentication

Create the two Stage 3 demo accounts in the database configured by `.env.local`:

```powershell
npm run seed:auth
npm run dev
```

The seed initializes missing settings and inserts a demo owner
(`owner@clairmount.example`) and salesperson (`salesperson@clairmount.example`).
It generates separate random passwords and saves them in the gitignored
`site/.auth-demo-credentials.json`; passwords are never printed. Open that local
file to sign in. Re-running preserves existing accounts, passwords, roles and
settings. If an account already exists without matching saved credentials, the
script reports that its existing credentials must be used. Do not delete this file
unless you no longer need those demo passwords. It is a local secret, not a build
asset. For the complete Stage 4 database, use the reset command below instead.

Staff start at `/crm`; owners can open `/crm/team`. A salesperson opening that
URL is sent to `/crm/access-denied`. Both pages and the team service enforce
access. Public routes stay open. There is no signup page. Use the header's
**Account menu → Sign out** to end the browser session.

## App shell (Stage 5)

After login, `/crm` opens Dashboard. Dashboard, Leads, Inventory and Alerts are
empty workspace tabs ready for the later feature stages. Phones and tablets use
bottom navigation; desktop screens (1024px and wider) use a sidebar. The header
account menu shows the signed-in user and role, sign out, and owner-only team access.

Branding comes from `Settings.brand`: `companyName`, `primaryColor` (six-digit hex)
and `logoUrl` (HTTP(S) URL or null). Login and CRM share the logo and theme. A null
or failed logo uses the CarFront badge; the default settings make it red. Theme
foreground text automatically switches between black and white for contrast.
After changing settings through an authorized database/admin workflow, allow the
60-second settings cache to expire and refresh, or restart the server. There is no
settings editor yet. UI strings are in `src/components/shared/app-shell/copy.ts`.

The shell supports 375px layouts, 44px minimum tap targets, keyboard navigation
and device safe areas. Empty tabs deliberately show no invented counts or records.

For a repeatable browser check without touching Atlas, build first and run:

```powershell
npm run build
npm run auth:check -- --mongo-binary C:/path/to/mongod.exe --playwright-module C:/path/to/node_modules/playwright
```

This optional integration check needs a local MongoDB binary, Playwright and
installed Chrome. It starts its own loopback MongoDB and production server,
explicitly overrides the database URI and auth secret, seeds twice, and checks
login errors, owner/salesperson access, cookie flags, logout, deactivation, role
changes, safe redirects and open public routes. It also checks all four shell tabs,
active navigation, back/forward, direct reloads, 320/375/768/1440px layouts, tap
target sizes, keyboard account-menu behavior, custom branding, long names and
broken-logo fallback. All branding mutations stay in the disposable local DB.
It closes its processes afterward; screenshots, a result file and disposable database files
are retained under gitignored `.auth-check/`. `npm test` uses mocks and requires
neither MongoDB nor browser dependencies.

## Full demo database (Stage 4)

From `site/`, run:

```powershell
npm run seed
```

**This resets existing CRM data in the database selected by `MONGODB_URI`.** It
replaces settings, dealerships, users, vehicles, leads, appointments, notifications
and email templates, and clears login-attempt counters. It leaves unrelated
collections alone. Use it only against a disposable demo database. An explicit
database name in the URI is required; `admin`, `config`, and `local` are refused.
Existing environment variables take precedence over `.env.local`.

The result contains 3 placeholder locations, 1 owner, 6 salespeople (2 per
location), 27 vehicles, 10 leads across all five stages, 2 upcoming appointments,
9 read/unread notifications and 4 email templates. The demo vehicle is **CLA-001,
2022 Jeep Grand Cherokee Limited 4x4**, initially Available at the North location.
Location names/addresses, people and VINs are synthetic. Prices are illustrative
CAD amounts; mileage is in kilometres. Photo arrays are empty until actual
vehicle photos are supplied. Upcoming bookings use the configured Toronto zone's
weekday opening hours. No emails or automation events are sent during seeding.

Passwords are generated separately for all seven accounts and saved in the
gitignored `.auth-demo-credentials.json` with restricted creation permissions.
Existing saved passwords (including Stage 3 owner/salesperson logins) are reused.
Open that local file for credentials; they are never printed or stored in source.
The owner email is `owner@clairmount.example`; the first salesperson remains
`salesperson@clairmount.example`. Each reset creates fresh user IDs, invalidating
previous signed sessions. Sign in again after reseeding. Do not run `seed:auth`
after the full seed; that smaller bootstrap is only for isolated auth checks.

All fixtures and references are validated before resetting. The reset spans
multiple collections and is **not transactional**: a database failure can leave
partial data. Fix the failure and rerun with the same credentials file. Stop
other writers during a reset; restart the app afterward to clear the settings
cache (otherwise its normal TTL is 60 seconds).

Verify the destructive workflow in an isolated local MongoDB without touching
the configured Atlas database:

```powershell
npm run seed:check -- --mongo-binary C:/path/to/mongod.exe
```

This seeds twice, checks counts and references, verifies all passwords, exercises
unique indexes, verifies settings/stale-row resets, preserves an unrelated
collection, and checks that invalid credentials fail before writes. It retains
the result and disposable DB under gitignored `.seed-check/` and stops MongoDB.
Use `npm run seed -- --credentials-file PATH` to choose another local secret file
when working with a separate demo database; keep that file outside source control.

## Validation

### Inventory (Stage 6)

Open `/crm/inventory` after signing in. Owners can tap a card's status, then tap
HOLD to save immediately. Staff can browse all locations; creation, editing,
status and price changes require the owner role. Use the vehicle detail screen
for photos, linked leads and audit histories. Salespeople see only their own
assigned leads. Status and price changes notify that location's salespeople (Stage 8).

Filters are URL-backed, search covers make/model/stock number, and the stock
summary is independent of those filters. Add/edit supports basic specs and up
to 50 HTTP(S) photo URLs or local asset paths. Prices are CAD and mileage is km.
Concurrent edits are rejected with a refresh message so histories stay intact.

After `npm run build`, run the isolated browser check:

```powershell
npm run inventory:check -- --mongo-binary C:/path/to/mongod.exe --playwright-module C:/path/to/node_modules/playwright
```

The check starts local MongoDB on a free loopback port, seeds a dedicated test
database and runs headless Chrome against the production build. It overrides
environment configuration, never uses Atlas, and sends no emails. Temporary
credentials, screenshots and a result file are stored in gitignored
`.inventory-check/<timestamp>/`. The check covers the two-tap HOLD flow, history
persistence, filters, pagination, add/edit, stale tabs, photos, duplicate stock,
owner/salesperson access and 320/375/768/1440px layouts. `npm test` also covers
mutation authorization, concurrency, events and failed-handler semantics.

### General checks

```powershell
npm run lint
npm test
npm run typecheck
npm run build
npm run db:check
```

For a production smoke check, run `npm run start` after building.

Dependency audit on 2026-10-15: `npm audit --omit=dev` reports no
vulnerabilities. The full audit reports nine high-severity entries stemming from
the development tools' `braces` dependency
([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)).
The suggested forced fixes downgrade Next.js ESLint configuration and shadcn
across major versions, so they have not been applied. Recheck when upstream
tooling releases a compatible fix.

## UI primitives

shadcn/ui components are source-controlled in `src/components/ui`, with aliases
and styling configured in `components.json`. Button, Card, Badge, Sheet, Dialog,
Select, Table, Form, Input, and Sonner are installed, together with their supporting
components. The root layout mounts Sonner's toaster. Add components with
`npx shadcn@latest add <component>`; see the
[shadcn Next.js guide](https://ui.shadcn.com/docs/installation/next).

## Public inventory and inquiries (Stage 7)

Customers can browse `/inventory` (hero with the locations, location chips,
cards with "New arrival" / "Price drop" badges), and open `/inventory/[id]`
(gallery, key specs, trust strip, sticky Test drive / Inquire bar on phones)
without signing in. A `utm_source` on any public URL is saved on the inquiry. Vehicle pages show supplied photos (with
an empty/broken-image fallback), CAD price, km mileage, specifications and
location contact details. The demo seed gives each vehicle three photos of the
same model from Wikimedia Commons (stock images, not the actual units; licences
and file pages are in `scripts/seed/photo-credits.json`). Replace them with actual
photo URLs using the owner's vehicle editor. `npm run seed:photos` adds these
photos to vehicles that have none or only placehold.co placeholders, without
resetting any data.

Public visibility is controlled by `Settings.publicInventoryStatusKeys`, with
`["available"]` as the backward-compatible default for existing databases.
Only keys also present in `vehicleStatuses` and vehicles at active dealerships
are exposed. An empty array hides all stock. Direct links to hidden or missing
vehicles show a friendly unavailable page. A reseed is not required.

The standalone `InquiryForm` lives in `src/modules/leads/components/inquiry-form.tsx`.
Pass `vehicleId`; it uses the hosted server action by default. Its optional
`onSubmitAction` callback accepts `InquiryInput` and returns `InquiryResult`, so
another host can supply a transport later. This stage does not install an iframe
or cross-origin endpoint on the client's existing website.

The server validates name, email, phone and optional message, checks current
public availability, derives the dealership from the vehicle, and creates the
lead with an unassigned salesperson, the lowest-order configured lead stage,
`public_inventory` source and a cryptographically random booking token. It logs
the creation activity and awaits `lead.created`. The customer then sees a
thank-you state. Stage 8 automation then assigns the lead and sends the emails below.

Each form submission retains a UUID across retries. A sparse unique MongoDB
index prevents duplicate records for the same submission, including concurrent
requests. Retrying a saved submission does not emit another event. Reloading the
form creates a new submission identity; this is retry protection, not a spam
filter. Production abuse controls can be added before broad public exposure.

After building, verify without touching Atlas:

```powershell
npm run public:check -- --mongo-binary C:/path/to/mongod.exe --playwright-module C:/path/to/node_modules/playwright
```

This check starts a disposable local MongoDB and production server, submits the
Jeep inquiry in headless Chrome and verifies its database record. It also checks
public filtering, pagination, missing/hidden vehicles, inactive dealerships,
photos, 320/375/768/1440px layouts, 44px tap targets, validation, failed-request
recovery, duplicate POST replay, and a form left open while the Jeep goes on HOLD.
Artifacts are retained in gitignored `.public-check/<timestamp>/`. No external
email is sent. The unit suite additionally verifies event order, custom status
and stage configuration, forged-field rejection and post-save handler failures.

## Lead automation (Stage 8)

`src/instrumentation.ts` registers the event handlers once per Node server
process, so automation runs in `next dev`, `next start` and on Vercel. With the
seeded rules, a public inquiry:

1. is assigned round-robin to an active salesperson at the vehicle's location
   (`leadAssignmentStrategy: "manual"` leaves it unassigned);
2. emails the customer the `follow_up` template with a **Book an appointment**
   link to `APP_URL/book/<bookingToken>`;
3. emails the assigned salesperson (`new_lead`) and creates an in-app alert.

Vehicle status and price changes email and alert the location's salespeople.
Every event appends a readable entry to the lead's or vehicle's `activity[]`.
Who gets what is driven by `Settings.notificationRules` (event → recipients →
channels); wording comes from the stored email templates.

Email runs in console mode by default outside production (messages are printed,
nothing is sent). Live delivery needs `EMAIL_PROVIDER=resend` (or production),
`RESEND_API_KEY`, a valid `APP_URL` origin and `Settings.emailFrom` set to a
Resend-verified sender; otherwise email fails closed while in-app alerts still
arrive. A failed email never fails the inquiry or the inventory change.

Databases seeded before Stage 8 can gain the three new templates without a reset:

```powershell
npm run seed:automation
```

This inserts only missing templates and preserves edited ones. Verify the whole
workflow against a disposable local MongoDB (Atlas is not touched, no email sent):

```powershell
npm run automation:check -- --mongo-binary C:/path/to/mongod.exe
```

It covers assignment, both emails, in-app alerts, replay, 20 concurrent
inquiries, manual/inactive/empty teams, provider outage, rule deduplication,
all six event types, missing template/sender/unsafe `APP_URL`, and disabled
rules. Results go to gitignored `.automation-check/<timestamp>/`.

## Appointment booking (Stage 9)

The follow-up email links to `/book/<bookingToken>`. The page shows the next
`booking.daysAhead` days of free slots for the lead's assigned salesperson, built
from `booking.businessHours` and `booking.slotLengthMinutes` in `booking.timeZone`,
minus that salesperson's booked appointments and any time already passed. The
customer picks a day, then a time, then confirms (the confirm bar sticks to the
bottom on phones). Booking:

1. creates the appointment with the assigned salesperson;
2. moves the lead to `booking.appointmentStageKey` (default `appointment`), only
   forward, never back from a later stage;
3. emits `appointment.booked`, so Stage 8 sends the customer `booking_confirmation`,
   emails the salesperson `appointment_notice` and creates their in-app alert.

The link stays usable: after booking it shows the existing appointment, and after a
cancellation it allows rebooking. Unknown or malformed links show a friendly
"isn't valid" page; unassigned leads or inactive salespeople get a "call the
dealership" page. If someone takes a slot first, the customer sees "that time was
just taken" and the list refreshes. The page is `noindex` and sends no Referer.

Verify against a disposable local MongoDB (Atlas untouched, no email sent):

```powershell
npm run booking:check -- --mongo-binary C:/path/to/mongod.exe
```

It covers the booking side effects, replay, second-booking refusal, invalid
tokens, concurrent races (two customers for one slot; one customer for five
slots), off-grid/past times, stage rules, unassigned/inactive staff, configurable
stage and an email outage. Results go to gitignored `.booking-check/<timestamp>/`.
Slot maths (hours, closed days, DST, local "today") is unit-tested in
`tests/booking.test.ts`.

Databases seeded before Stage 9 keep working (`appointmentStageKey` defaults to
`appointment`), but their `booking_confirmation`/`appointment_notice` templates may
print "a.m.." after the time; a full `npm run seed` installs the corrected wording.


## Leads, dashboard and alerts (Stages 10–11)

- **Leads** (`/crm/leads`): salespeople see only their assigned leads; the owner sees
  all and can filter by location and assignee. Open a lead to call/email the
  customer, change the stage, add a note, see the vehicle, appointment and activity.
  The owner can reassign to an active salesperson at the same location.
- **Appointments** (`/crm/leads/appointments`): today and upcoming booked visits.
- **Dashboard** (`/crm`): for the owner, the Command Center (KPIs, units by status,
  Needs attention, team leaderboard, sales by month, lead funnel, aging buckets,
  inventory by location, today's appointments, recent activity) with a location
  filter. Salespeople see their open leads, today's appointments, sales and
  commission against target, reminders and activity. Every tile opens its board.
- **Alerts** (`/crm/alerts` and the header bell): unread count, mark one/all read.
  The bell checks every 20 seconds and toasts new alerts.
- **Home screen**: open `/crm` on a phone and use "Add to Home Screen" (iOS Share
  menu / Android install prompt). Name, colour and icon come from settings.

No new environment variables or reseed are needed. Unit tests cover lead
visibility, stage/reassign/note rules and alert ownership (`tests/leads-crm.test.ts`).
The existing `auth:check` and `inventory:check` cover the new header and the
collapsible filters.


## Extras (v2 Stage 9)

- **Week calendar:** Leads → Appointments → Week. Use the arrows to change weeks. Owners can filter
  by location and salesperson.
- **Settings** (owner, More → Settings):
  - branding
  - vehicle statuses and their workflow roles, and which statuses are public
  - repair types, lead stages and stage roles, lead sources
  - reminder thresholds, garages, email templates

  Entries still in use can't be removed.
- **CSV export:** an Export CSV button on every board (inventory, team, garages, salesperson
  profile) and on Leads (`/crm/leads/export`, using the current filters).
- **Saved views:** on Inventory and Leads, apply filters, then tap **Save view**. Views are personal
  and are cleared by `npm run seed`.
- **Drag and drop:** on desktop, drag a lead card to another pipeline column. Tapping a card still
  works everywhere.
