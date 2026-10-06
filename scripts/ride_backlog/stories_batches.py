# Release-batch restructure (2026-10-06) — loaded by generate.py after stories_level2_3.py.
#
# Aligns the backlog with docs/RELEASE_PLAN.md (batch order, zero Jali fees, cargo, modular
# architecture, connected customer/provider app) and the module layout delivered by the
# architecture migration (docs/migration/MIGRATION_LOG.md). Story IDs and issue numbers of
# existing stories never change; new epics/stories get new IDs.

RELEASE = "docs/RELEASE_PLAN.md"
RUNBOOK = "docs/ARCHITECTURE_MIGRATION_RUNBOOK.md"

# ── Tracks: where a story sits in the release plan ─────────────────────────
# Dependency waves are implementation order; tracks are the public release order.
TRACKS = [
    ("F",  "Shared foundations & connected app", "Needed by every batch: identity, provider onboarding, notifications, support, safety basics, payments without Jali fees, modular architecture, platform quality and release readiness."),
    ("B1", "Batch 1 — Car rental", "First intended public batch: real cars, dates, clear prices and terms, owner confirmation, cancellation, handover/return, support."),
    ("B2", "Batch 2 — Scheduled private drivers", "Hire a verified driver for the customer's own car; car-and-driver packages may follow when selected."),
    ("B3", "Batch 3 — Private shared journeys", "Drivers publish routes with seats and stops; passengers request seats; capacity is checked per route segment."),
    ("B4", "Batch 4 — Nearby drivers with their own cars and fares", "On-demand rides with driver-set prices, live trip, safety and admin operations."),
    ("B5", "Batch 5+ — Bus ticketing & further passenger services", "Operator departures, seat inventory, tickets, cancellation and operator tools. Internal order not fixed."),
    ("C",  "Cargo / freight — batch TBD", "Goods-vehicle booking and return-load matching. Owner-approved scope; launch position not assigned."),
    ("L",  "Later — after the core batches", "Growth, business and partner products. Not scheduled; needs its own readiness check."),
    ("D",  "Deferred — needs an owner decision", "Conflicts with the zero-Jali-fee policy or needs funding/subsidy decisions. Not to be built until the owner records a decision in the release plan."),
    ("X",  "Out of scope", "Excluded by the release plan (courier/parcel delivery). Kept for history; the matching issues can be closed as not planned."),
]
TRACK_NAME = {t[0]: t[1] for t in TRACKS}

EPICS += [
    ("E23", "Connected app & modular architecture", "foundation",
     "Finish the architecture migration (runbook M06–M09) so every service plugs into one app: server-side service availability, a customer/provider mode switch that never changes server state, one Activity and Inbox for both personas, provider availability that survives navigation, and a deploy pipeline that works every time."),
    ("E24", "Car rental — launch-ready", "batch-1",
     "Batch 1. A customer finds a real car for their dates, sees the full price and terms, requests it, gets the owner's confirmation, picks it up and returns it — with no double booking and support at every step."),
    ("E25", "Private shared journeys", "batch-3",
     "Batch 3. A driver going to Gisenyi offers spare seats with stops along the way; passengers book the whole route or an allowed part of it, and seats are never double-booked on overlapping segments."),
    ("E26", "Bus ticketing", "batch-5",
     "Batch 5+. Reliable operator departures with dated seat inventory, ticket confirmation, cancellation and operator tools, replacing the legacy trip tables safely."),
    ("E27", "Cargo & freight", "batch-tbd",
     "Batch TBD. Book a goods vehicle (e.g. a utility truck) with a clear quote, or fill a carrier's empty return journey — with proof of pickup and delivery and clear responsibility for goods."),
    ("E28", "Release readiness & store submission", "foundation",
     "Every batch launches on evidence: a readiness audit, real provider supply, device testing, accurate store listings, reviewer access and a post-launch review before the next batch."),
]

# Track of each epic (stories inherit it unless STORY_TRACK overrides)
EPIC_TRACK = {
    "E0": "F", "E1": "F", "E2": "B4", "E3": "B4", "E4": "B4", "E5": "B4", "E6": "B2", "E7": "F",
    "E8": "B4", "E9": "F", "E10": "B4", "E11": "B4", "E12": "F", "E13": "B4", "E14": "D", "E15": "F",
    "E16": "F", "E17": "B4", "E18": "B4", "E19": "L", "E20": "X", "E21": "F", "E22": "L",
    "E23": "F", "E24": "B1", "E25": "B3", "E26": "B5", "E27": "C", "E28": "F",
}
STORY_TRACK = {
    "S9.7": "B4",                    # airport pickup is a ride option
    "S10.4": "F",                    # service areas gate every service by region
    "S11.5": "F", "S11.4": "F",      # saved places and pickup points are shared location tools
    "S13.7": "B2",                   # hourly ride with the driver's car = car-and-driver package (Batch 2)
    "S14.1": "B4",                   # rider price offers: provider-set pricing, no Jali fee
    "S15.1": "B4", "S15.2": "L", "S15.3": "D",
    "S19.1": "F",                    # fleet tools support rental owners/drivers from Batch 1 (release plan)
}

# Backend module / mobile feature that owns the work (one agent per module at a time)
EPIC_MODULE = {
    "E0": "`Modules/Identity`, `Modules/Notifications`, `Modules/Providers`",
    "E1": "`Modules/Providers` · `core/session` (provider setup screens)",
    "E2": "`Modules/Pricing`, `Modules/NearbyRides` · `features/nearby-rides`",
    "E3": "`Modules/NearbyRides` · `features/nearby-rides`",
    "E4": "`Modules/NearbyRides` · `features/nearby-rides`",
    "E5": "`Modules/NearbyRides`, `Modules/Payments` · `features/nearby-rides`",
    "E6": "`Modules/DriverHire` · `features/driver-hire`",
    "E7": "`Modules/Payments`, `Modules/Pricing`",
    "E8": "`Modules/Safety` · `features/nearby-rides`",
    "E9": "`Modules/Identity`, `Modules/Notifications` · `core/session`, shared `lib/`",
    "E10": "`Modules/NearbyRides` · `app/(admin)`",
    "E11": "`Modules/Locations`, `Modules/NearbyRides` · `features/nearby-rides`",
    "E12": "`Modules/Notifications` · `core/notifications`",
    "E13": "`Modules/NearbyRides` · `features/nearby-rides`",
    "E14": "`Modules/Payments`, `Modules/Pricing`",
    "E15": "`Modules/Identity` · `core/session`",
    "E16": "`Modules/Notifications` (support) · `core/`",
    "E17": "`Modules/NearbyRides`, `Modules/Providers` · `features/nearby-rides`",
    "E18": "`Modules/Safety` · `features/nearby-rides`",
    "E19": "`Modules/Providers` · `core/session` (provider)",
    "E20": "— (out of scope)",
    "E21": "platform (CI, infra, `backend/app/Http`, `mobile/lib`)",
    "E22": "`Modules/Notifications` · `core/`",
    "E23": "`core/*`, `Modules/Identity`, `Modules/Notifications`, `Modules/Providers`, CI/deploy",
    "E24": "`Modules/Rentals` · `features/rentals`",
    "E25": "`Modules/SharedJourneys` · `features/shared-journeys`",
    "E26": "`Modules/Bus`, `Modules/LegacyBookings` · `features/bus`",
    "E27": "`Modules/Cargo` (new) · `features/cargo` (new)",
    "E28": "release/ops — no code module",
}
STORY_MODULE = {
    "S10.4": "`Modules/Locations` · `app/(admin)`",
    "S13.7": "`Modules/DriverHire` · `features/driver-hire`",
    "S19.1": "`Modules/Providers`, `Modules/Rentals` · `core/session` (provider)",
}
EPIC_ARCH = {e: f"`{RUNBOOK}`" for e in ("E23", "E24", "E25", "E26", "E27", "E28")}

# ── Status (as of 2026-10-06, develop @ migration merge) ───────────────────
# built   = code merged to develop/main, not yet tested by the owner
# partial = some of the acceptance criteria exist in code
# todo    = not started
BUILT = """S0.1 S0.2 S0.3 S0.4 S1.1 S1.2 S1.3 S1.4 S2.1 S2.2 S2.3 S3.1 S3.2 S3.3 S3.4 S3.5 S3.6
S4.2 S4.3 S4.4 S4.5 S4.6 S5.1 S5.2 S5.3 S5.4 S6.1 S6.2 S6.3 S6.4 S7.1 S7.2 S8.1 S8.2 S8.3 S8.4
S9.1 S9.2 S9.3 S9.4 S9.5 S9.6 S10.1 S10.2 S10.3 S21.3 S21.7 S21.9
S7.4 S10.4 S21.13 S24.1 S24.2 S24.3 S24.4 S24.5 S24.6 S24.7 S24.8 S24.9""".split()
PARTIAL = {
    "S4.1": "Rider screen polls trip status; live driver position on a map is not shown yet.",
    "S15.6": "Account deletion exists (`Modules/Identity` AccountDeletion); data export not verified.",
    "S19.1": "Owners already manage several rental cars and driver vehicles; no fleet portal or multi-driver management.",
    "S23.3": "M05 made persona view-only and per account; no visible mode switch or cross-mode active-job indicator yet.",
    "S23.10": "Provider setup/onboarding/vehicles/earnings screens still live in `app/driver` and `components/driver`.",
    "S25.1": "Drivers publish listings (`/driver/listings`) with from/to, date, seats and price; no intermediate stops or per-segment fares.",
    "S25.3": "Catalogue search by route/date exists (`/private-seats`); no partial-route matching.",
    "S26.2": "Bus booking with quantity and passenger names exists through the legacy booking dispatcher.",
    "S26.3": "Admins upload ticket files and mark bookings delivered; no ticket code or validation.",
    "S26.5": "Station admins manage agencies, routes and daily departures; no dated capacity or boarding list.",
    "S28.3": "Android APK is built by GitHub Actions on every push to main; no Play closed test yet.",
}

# Notes added to existing stories by the release plan (history kept; text appended)
AC_ADD = {
    "S2.2": ["Commission and service fee default to **0** for every service (zero Jali fees, release plan). A nonzero value requires a recorded owner decision in `docs/RELEASE_PLAN.md`."],
    "S5.4": ["With zero Jali fees the *owed* amount stays 0 and the settle banner never blocks going online."],
    "S7.2": ["The ledger keeps recording provider earnings; commission entries are 0 while the free-platform policy applies."],
}
NOTE_ADD = {
    "S2.2": ["2026-10-06: release plan sets zero Jali fees. Code defaults are still 8% + 200 RWF (rides) and 10% + 500 RWF (hire) in `Modules/Pricing/Application/RideSettings.php` — fixed by S7.4."],
    "S7.3": ["Paying the *provider's* fare in-app is allowed under the zero-fee policy; payment-provider fees need an owner decision on who pays them."],
    "S14.7": ["Deferred: a paid subscription is platform monetization (release plan, *Initial free-platform policy*)."],
    "S20.1": ["Out of scope: courier/parcel delivery is excluded by the release plan. Goods transport is covered by E27 (cargo)."],
}
for _sid in ("S14.2", "S14.3", "S14.4", "S14.5", "S14.6", "S14.8", "S15.3"):
    NOTE_ADD.setdefault(_sid, []).append("Deferred: needs an owner decision (subsidy, wallet or loyalty funding) under the zero-fee policy.")
for _sid in ("S20.2", "S20.3"):
    NOTE_ADD.setdefault(_sid, []).append("Out of scope: courier/parcel delivery is excluded by the release plan.")

# ── New stories in existing epics ──────────────────────────────────────────
story("S6.5", "E6", "Hire cancellations, no-shows and disputes", ["mobile", "backend"],
  "customer or hired driver", "clear rules when a hire is cancelled late, a side doesn't show up, or the hours are disputed",
  "both sides know what happens before they commit",
  ["Terms screen states free-cancellation window, late-cancellation and no-show rules before booking (provider terms, no Jali fee).",
   "Customer can report a no-show after the start time + grace; the driver can do the same; the hire moves to a terminal state with the reason.",
   "Either side can dispute recorded hours from the hire summary; the dispute reaches admins with the hire timeline.",
   "Feature tests cover late cancel, both no-show paths and a dispute."], [])

story("S6.6", "E6", "Admin hire operations", ["admin", "backend", "mobile"],
  "ops admin", "to see, search and investigate driver hires like rides",
  "I can resolve hire problems quickly",
  ["`app/(admin)` hires list with status/date/customer/driver filters and a detail view with timeline, quote snapshot and ratings.",
   "Admin can correct check-in/check-out times with a required note; the change is logged in `activity_logs`.",
   "Requires `manage-rides` (or a new `manage-hires` permission appended to the seeder)."], [])

story("S7.4", "E7", "Zero Jali fees across every service", ["backend", "mobile", "payments", "pricing"],
  "customer or provider", "Jali to charge no commission, booking fee or service fee",
  "the free-platform promise is true everywhere I see a price",
  ["Rides and hire settings default to 0% commission and 0 service fee (`RideSettings` defaults and any saved `platform_settings`); legacy bus/private/rental bookings send `service_fee = 0` and the app's `serviceFee.ts` shows none.",
   "Quotes, booking totals, receipts, earnings, the commission ledger and debt-based restrictions (`COMMISSION_OWED` eligibility) are verified with zero fees in feature tests.",
   "Customer copy says *No Jali fees; transport prices are set by providers.* in the price breakdowns.",
   "Changing a fee away from 0 is possible only for `manage-ride-pricing` and is logged; the release plan records why."],
  ["Release plan § Initial free-platform policy. Saved runtime settings in production must be checked too, not only code defaults."])

story("S21.13", "E21", "Fix: production backend deploy fails after upload", ["backend", "bug"],
  "owner", "every merge to main to deploy completely and run migrations",
  "the server never runs new code against an old database",
  ["`deploy-backend.yml` uploads and runs post-deploy steps over one SSH session (or retries with backoff) so the server's connection limit doesn't cut it off.",
   "`php artisan migrate --force` and cache rebuild always run after upload; a failure marks the run red and keeps the previous release active.",
   "The workflow can be re-run safely (idempotent) and prints which release is live."],
  ["Runs 22–24 failed with `dial tcp …:25552: i/o timeout` after the tar was extracted, so code was updated but migrations did not run."])

# ── E23 Connected app & modular architecture ───────────────────────────────
story("S23.1", "E23", "Server-side service availability (M06)", ["backend", "security"],
  "owner", "to switch each service (rental, hire, shared journeys, rides, bus, cargo) on or off per region and app version",
  "only released services take new work, while existing bookings stay reachable",
  ["A service-access resolver combines release flags, region (S10.4), permissions and provider eligibility; a client persona is never an input.",
   "`/me` (or a new endpoint) returns an additive `services` contract; old clients keep working with documented defaults.",
   "A disabled service rejects new requests/bookings server-side but still serves history, active work and support.",
   "OpenAPI updated; tests cover enabled, disabled-with-active-work and old-client cases."],
  [f"{RUNBOOK} M06."])

story("S23.2", "E23", "Service registry and gated queries in the app (M06)", ["mobile"],
  "customer", "Home to show only services available to me, without loading the others",
  "the app is simple and fast as services are added",
  ["A registry in `core/navigation` lists features and reads the `services` contract; Home shows only released, available services.",
   "Hidden services make no API calls (verified with a request log); deep links to a disabled service show a clear *not available yet* screen.",
   "Adding a feature to the registry needs no change in other features (boundary check stays green)."],
  [f"{RUNBOOK} M06."])

story("S23.3", "E23", "Customer/provider mode switch", ["mobile", "ux"],
  "person who both books and provides services", "a visible switch between *Book transport* and *Offer services*",
  "I use one app for both without losing my work",
  ["The switch appears only when the account has an approved provider capability; it changes the view only (no server call, no offline, no service-set change).",
   "An active booking or job indicator stays visible in both modes and opens the right detail screen.",
   "Mode is remembered per account; logout or account switch resets it.",
   "Labels follow the agreed UX; until agreed, current labels are kept."],
  [f"{RELEASE} § Unified account, modes and shared UX; {RUNBOOK} §5."])

story("S23.4", "E23", "One Activity for bookings and jobs (M07)", ["mobile", "backend"],
  "customer and provider", "one Activity list of my bookings and my provider jobs across services",
  "I find any trip or job in one place",
  ["Read-only projection of customer ownership and provider assignment, per service, with service/role/status labels; it never writes domain state.",
   "Each row opens the service-owned detail screen; pagination and filters (role, service, status).",
   "Ownership tests: no one sees another account's bookings or jobs."],
  [f"{RUNBOOK} M07."])

story("S23.5", "E23", "Notification taps open the right screen, always (M07)", ["mobile"],
  "user", "a notification tap to open the right booking or job even after a cold start or login",
  "notifications are trustworthy",
  ["A root resolver in `core/notifications` maps legacy `screen,id` payloads and new ones to service-owned routes.",
   "Handles cold start, tap before login (resumes after login), duplicates, deleted entities and entities of another account (safe fallback).",
   "Does not depend on the current customer/provider mode."],
  [f"{RUNBOOK} M07."])

story("S23.6", "E23", "In-app inbox (M07)", ["mobile", "backend"],
  "user", "an inbox of my recent notifications with customer/provider/service filters",
  "I don't miss updates when push is off",
  ["Durable notification records with retention and deduplication; read/unread.",
   "Important status updates are always visible in-app even if push permission is denied.",
   "Respects notification preferences (S15.4)."],
  [f"{RUNBOOK} M07."])

story("S23.7", "E23", "Provider availability that survives navigation (M08)", ["mobile", "backend"],
  "driver", "my online status and location updates to keep working while I use other screens or customer mode",
  "I don't miss requests or go offline by accident",
  ["Presence heartbeat lives in a root coordinator, not in the Drive screen; one source for the header availability.",
   "Switching to customer mode does not take the driver offline; going offline is an explicit control.",
   "Background behaviour is explicit and documented (what runs when the app is backgrounded)."],
  [f"{RUNBOOK} M08."])

story("S23.8", "E23", "Request and polling budget (M08)", ["mobile", "backend"],
  "user on a slow network", "the app to fetch only what the current screen needs",
  "it stays fast and cheap as services are added",
  ["Measured request counts for Home, Activity and Drive before/after; no all-service fan-out.",
   "Polling intervals and prefetching are reviewed per screen; list pagination everywhere.",
   "Results recorded in the migration log."],
  [f"{RUNBOOK} M08."])

story("S23.9", "E23", "Split the shared BookingSheet per service", ["mobile", "tech-debt"],
  "developer", "rental and shared-journey booking sheets owned by their features",
  "each agent can change one service without touching another",
  ["`components/BookingSheet.tsx` is replaced by `features/rentals` and `features/shared-journeys` sheets; Home imports them through feature entry points.",
   "Behaviour, payloads and query keys unchanged; boundary check green."],
  ["Migration log, M04 part 2 known gaps."])

story("S23.10", "E23", "Provider screens move to shared provider infrastructure", ["mobile", "tech-debt"],
  "developer", "driver setup, onboarding, vehicles and earnings screens in `core/session/provider`",
  "provider foundations are shared by rental owners, drivers and carriers",
  ["Screens and components move behind facades with unchanged routes; service-specific subforms come from feature exports.",
   "Full offered-services set is preserved on every save."],
  ["Migration log, M04 part 2 known gaps."])

story("S23.11", "E23", "Mobile test harness", ["mobile", "tech-debt"],
  "developer", "Jest + React Native Testing Library with the first feature tests",
  "agents prove behaviour instead of relying on typecheck only",
  ["`npm test` runs in Mobile Checks CI; at least one test per feature module and for session teardown.",
   "Test helpers for API mocking and query client."], ["Runbook M01 gap."])

story("S23.12", "E23", "Staging rehearsal and recovery (M09)", ["backend", "security"],
  "owner", "each release rehearsed on staging with production-like data and a tested rollback",
  "production changes are safe",
  ["Data reconciliation checks before/after migrations; recovery from a failed deploy is rehearsed.",
   "Release notes state what was enabled, tested and approved."],
  [f"{RUNBOOK} M09."])

# ── E24 Car rental (Batch 1) ───────────────────────────────────────────────
story("S24.1", "E24", "Browse available cars for my dates", ["mobile", "backend"],
  "customer", "to see real cars available for my pickup and return dates with photos, seats, transmission and daily price",
  "I only consider cars I can actually get",
  ["Search by pickup date/time, return date/time and area; results exclude cars booked or blocked in that range.",
   "Car detail shows photos, owner rating, pickup area, deposit (caution) and terms summary.",
   "Empty and error states follow the UX checklist."], [])

story("S24.2", "E24", "Rental calendar and no double booking", ["backend"],
  "rental owner", "each car to have a calendar of reservations and blocked days",
  "a car is never promised to two customers",
  ["Reservations hold a date range; overlapping confirmed or pending requests are rejected atomically (tested with concurrent requests on MySQL).",
   "Owners can block dates (maintenance, personal use).",
   "Car status (`available`/`rented`/`maintenance`) follows reservations instead of being only a manual flag."],
  ["Launch gate from the migration log: today only same-date capacity of 1 exists."])

story("S24.3", "E24", "Clear price and rental terms before I request", ["mobile", "backend", "pricing"],
  "customer", "the full price for my dates and the owner's terms before I request",
  "there are no surprises at pickup",
  ["Price = days × daily price (+ owner extras), deposit shown separately; *No Jali fees* line.",
   "Terms: mileage limit, fuel policy, driver age/licence, cancellation rules, damage responsibility.",
   "The quote is snapshotted on the request."], [])

story("S24.4", "E24", "Request a car and get the owner's confirmation", ["mobile", "backend"],
  "customer", "to send a rental request and be told quickly if the owner accepts",
  "I can plan my trip",
  ["Request is labelled *Requested* until the owner accepts; owner accepts/declines within a set time or it expires.",
   "Both sides get push + in-app updates; the dates are held while pending.",
   "Accepted rental shows owner contact and pickup instructions."], [])

story("S24.5", "E24", "Cancel a rental", ["mobile", "backend"],
  "customer or owner", "to cancel with the agreed rules",
  "plans can change fairly",
  ["Customer and owner cancellation follow the terms snapshot; reason required; dates released.",
   "Both sides notified; history shows who cancelled and when."], [])

story("S24.6", "E24", "Handover and return", ["mobile", "backend"],
  "owner and customer", "to record pickup and return with photos, fuel and odometer",
  "disputes about damage or fuel are rare and easy to settle",
  ["Check-out at pickup and check-in at return with photos, fuel level, odometer and notes from both sides.",
   "Late return is flagged; extra days follow the terms.",
   "Completed rental can be rated both ways."], [])

story("S24.7", "E24", "Owner rental dashboard", ["mobile", "backend"],
  "rental owner", "one place for my cars, calendar, requests and income",
  "I manage my rental business from the app",
  ["Request inbox with accept/decline; calendar per car; upcoming handovers.",
   "Income summary per car (provider income, no Jali commission)."], [])

story("S24.8", "E24", "Rental owner and car verification", ["admin", "backend", "mobile"],
  "superadmin", "rental owners and their cars verified before they appear to customers",
  "customers can trust the cars they book",
  ["Reuses provider onboarding (E1): identity, ownership/registration and insurance documents for each car.",
   "Unverified cars are hidden from search; expiry reminders reuse S17.7."], [])

story("S24.9", "E24", "Admin rental operations and support", ["admin", "backend", "mobile"],
  "ops admin", "to see rentals, investigate problems and help both sides",
  "rental issues are resolved quickly",
  ["Rentals list/detail with timeline, terms snapshot, handover records and ratings.",
   "Support entry from the rental detail for customer and owner (uses E16)."], [])

# ── E25 Shared journeys (Batch 3) ──────────────────────────────────────────
story("S25.1", "E25", "Publish a journey with stops and segment fares", ["mobile", "backend"],
  "driver", "to publish a route with departure time, seats, stops and the fare between stops",
  "passengers along my route can join",
  ["Ordered stops (from existing stations/places) with times; fare per segment or per stop pair.",
   "Seats offered and pickup rules (custom pickup allowed or not)."], [])

story("S25.2", "E25", "Seat capacity per route segment", ["backend"],
  "driver", "seats counted per segment of my route",
  "I never carry more passengers than seats",
  ["A→C bookings occupy the seat on A→B and B→C; a passenger leaving at B frees the seat for B→C only.",
   "Overlapping requests are rejected atomically (concurrency test on MySQL)."],
  ["Release plan § What a private shared journey means."])

story("S25.3", "E25", "Find journeys including part of a route", ["mobile", "backend"],
  "passenger", "to search by my origin, destination and date and see journeys that pass through them",
  "I find a seat even when the driver goes further",
  ["Matches journeys whose stop order covers my origin before my destination; shows my segment fare and pickup point.",
   "Sorted by departure; empty state suggests nearby dates."], [])

story("S25.4", "E25", "Request a seat and get confirmed", ["mobile", "backend"],
  "passenger", "to request seats and receive the driver's confirmation",
  "I know my seat is guaranteed",
  ["Request labelled *Requested* until the driver accepts; expiry if unanswered; seats held while pending.",
   "Confirmed passengers see the pickup agreement and driver contact; the driver sees a passenger list per stop."], [])

story("S25.5", "E25", "Journey cancellation rules", ["mobile", "backend"],
  "passenger or driver", "clear cancellation rules for seats and whole journeys",
  "everyone is treated fairly",
  ["Passenger cancels per the snapshot rules; driver cancelling the journey notifies every passenger.",
   "Seats are released per segment."], [])

story("S25.6", "E25", "Complete the journey and rate", ["mobile", "backend"],
  "passenger and driver", "to mark pickups, drop-offs and completion and rate each other",
  "journeys are recorded and trust grows",
  ["Driver marks each passenger picked up/dropped off; journey completes when the last stop is done.",
   "Ratings update the provider reputation shared with other services."], [])

story("S25.7", "E25", "Admin journey oversight", ["admin", "backend", "mobile"],
  "ops admin", "to see published journeys, bookings and problems",
  "I can help passengers and drivers",
  ["Journeys list/detail with stops, seat map per segment and booking timeline; support entry."], [])

# ── E26 Bus ticketing (Batch 5+) ───────────────────────────────────────────
story("S26.1", "E26", "Dated departures with seat inventory", ["backend"],
  "bus operator", "each departure on each date to have its own seat count",
  "tickets are never oversold",
  ["Seats are tracked per departure and date; bookings decrement atomically; sold-out departures are shown as such.",
   "Existing daily departure definitions keep working."], [])

story("S26.2", "E26", "Book bus seats", ["mobile", "backend"],
  "passenger", "to book one or more seats on a departure with passenger names",
  "I travel with a guaranteed seat",
  ["Quantity, passenger names, date and payment method; server-side price; no Jali fee.",
   "Clear confirmation state (requested vs confirmed) depending on the operator's flow."], [])

story("S26.3", "E26", "Tickets I can show at boarding", ["mobile", "backend"],
  "passenger", "a ticket with a code the operator can check",
  "boarding is quick",
  ["Ticket with reference and QR code in the app (offline available); operator can validate it."], [])

story("S26.4", "E26", "Bus ticket cancellation", ["mobile", "backend"],
  "passenger", "to cancel a ticket under the operator's rules",
  "I'm not stuck when plans change",
  ["Rules shown before booking; seats returned to inventory; refunds (if any) recorded."], [])

story("S26.5", "E26", "Operator tools: departures, capacity and boarding list", ["admin", "mobile", "backend"],
  "station admin or operator", "to manage departures and see who is booked on each one",
  "operations run smoothly",
  ["Manage capacity per departure/date; boarding list with validation status; station scope enforced."], [])

story("S26.6", "E26", "Retire legacy trip and bus tables", ["backend", "tech-debt"],
  "developer", "the legacy `trips` and `buses` paths removed safely",
  "there is one source of truth for departures",
  ["Readers moved to `agency_routes`/`trip_departures`; data reconciled; migration reversible; tests prove no reference is lost."],
  ["Migration log M03-Bus: no legacy Trip deletion without evidence."])

# ── E27 Cargo (batch TBD) ──────────────────────────────────────────────────
story("S27.1", "E27", "Cargo scope, rules and operating requirements", ["backend"],
  "owner", "the cargo service scope, responsibilities and operating/insurance requirements agreed",
  "we build the right thing legally and safely",
  ["Written decision in the release plan: vehicle types, whole-vehicle jobs vs return loads, damage/loss responsibility, insurance, prohibited goods.",
   "`Modules/Cargo` and `features/cargo` scaffolds with boundary entries."], [])

story("S27.2", "E27", "Carrier and goods-vehicle onboarding", ["mobile", "backend"],
  "carrier", "to register my goods vehicles with payload, body type and documents",
  "customers can book my vehicle",
  ["Reuses provider onboarding; vehicle payload (kg), usable volume/dimensions, body type; verification by admins."], [])

story("S27.3", "E27", "Request a cargo job", ["mobile", "backend"],
  "customer", "to describe my load, pickup, drop-off and time window",
  "a suitable vehicle can move my goods",
  ["Load description, weight/size, handling needs, photos; pickup/drop-off locations and time windows."], [])

story("S27.4", "E27", "Carrier quotes and confirmation", ["mobile", "backend", "pricing"],
  "customer", "quotes from suitable carriers and to confirm one before the job starts",
  "the price is clear and agreed",
  ["Carriers quote; customer compares and confirms; quote snapshotted; no Jali fee."], [])

story("S27.5", "E27", "Pickup and delivery evidence", ["mobile", "backend"],
  "customer and carrier", "photos and recipient confirmation at pickup and delivery",
  "responsibility for the goods is clear",
  ["Pickup photos/notes, delivery photos and recipient name/PIN; timeline visible to both sides."], [])

story("S27.6", "E27", "Return-load listings and matching", ["mobile", "backend"],
  "carrier returning empty", "to offer my return journey's capacity (e.g. Kigali → Kabarondo)",
  "I earn on the way back",
  ["Carrier posts direction, date window, free capacity and allowed detour; customers' compatible jobs are suggested; a match is an opportunity, not an automatic acceptance."], [])

story("S27.7", "E27", "Cargo cancellation, damage and support", ["mobile", "backend"],
  "customer or carrier", "clear cancellation and damage/loss procedures",
  "problems are handled fairly",
  ["Cancellation rules per quote; damage/loss report with evidence reaches support/admins."], [])

# ── E28 Release readiness ──────────────────────────────────────────────────
story("S28.1", "E28", "Batch readiness audit", ["admin"],
  "owner", "a readiness audit for the chosen batch against the release-plan gates",
  "we launch on evidence, not feature count",
  ["Checklist per batch: full customer/provider flow incl. rejected/cancelled/interrupted cases, availability accuracy, provider supply, verification, zero fees, support, device tests, store requirements.",
   "Result recorded with implemented vs tested vs released status."], [])

story("S28.2", "E28", "Store listing, privacy disclosures and reviewer access", ["mobile"],
  "owner", "accurate store metadata, privacy labels and a reviewer account for the released scope",
  "the app passes review",
  ["Listing describes only released services; privacy nutrition/data safety forms match the code; reviewer demo account with working backend."], [])

story("S28.3", "E28", "Google Play closed test", ["mobile"],
  "owner", "a closed test with at least 12 testers opted in for 14 days",
  "the personal developer account can request production access",
  ["AAB built in CI, testers invited, feedback tracked, crash-free rate reviewed."], [])

story("S28.4", "E28", "iOS TestFlight and App Store submission", ["mobile"],
  "owner", "an iOS build tested on TestFlight and submitted",
  "iPhone users can install Jali",
  ["EAS iOS build, Sign in with Apple configured, TestFlight testers, submission with release notes."], [])

story("S28.5", "E28", "Post-launch review before the next batch", ["admin", "analytics"],
  "owner", "a review of bookings, provider responsiveness, cancellations, support load and performance",
  "we choose the next batch with data",
  ["Metrics per service (reusing admin analytics); findings recorded in the release plan decision log."], [])

DEPS.update({
  "S6.5": ["S6.4"], "S6.6": ["S6.4"], "S7.4": ["S2.2", "S7.2"],
  "S23.1": ["S10.4"], "S23.2": ["S23.1"], "S23.3": ["S23.2"], "S23.4": ["S23.2"], "S23.5": ["S12.3"],
  "S23.6": ["S23.5", "S15.4"], "S23.7": ["S5.1"], "S23.8": ["S23.2"], "S23.12": ["S21.4", "S21.13"],
  "S24.2": ["S24.1"], "S24.3": ["S24.1", "S7.4"], "S24.4": ["S24.2", "S24.3"], "S24.5": ["S24.4"],
  "S24.6": ["S24.4"], "S24.7": ["S24.4"], "S24.8": ["S1.4"], "S24.9": ["S24.6", "S16.2"],
  "S25.2": ["S25.1"], "S25.3": ["S25.1"], "S25.4": ["S25.2", "S25.3"], "S25.5": ["S25.4"],
  "S25.6": ["S25.4"], "S25.7": ["S25.4"],
  "S26.2": ["S26.1"], "S26.3": ["S26.2"], "S26.4": ["S26.2"], "S26.5": ["S26.1"], "S26.6": ["S26.1"],
  "S27.2": ["S27.1", "S1.4"], "S27.3": ["S27.1"], "S27.4": ["S27.2", "S27.3"], "S27.5": ["S27.4"],
  "S27.6": ["S27.2"], "S27.7": ["S27.4"],
  "S28.1": ["S7.4"], "S28.2": ["S28.1"], "S28.3": ["S28.1"], "S28.4": ["S28.1"], "S28.5": ["S28.2"],
})

# Critical path to the first public batch (car rental) — a recommendation, not authorization.
NEXT_UP = [
    ("Unblock releases", ["S21.13", "S7.4"]),
    ("Only released services visible", ["S10.4", "S23.1", "S23.2"]),
    ("Car rental end to end", ["S24.1", "S24.2", "S24.3", "S24.4", "S24.5", "S24.6", "S24.7", "S24.8", "S24.9"]),
    ("Shared support & notifications", ["S16.2", "S16.3", "S12.3", "S23.5"]),
    ("Launch", ["S28.1", "S28.2", "S28.3", "S28.4"]),
]
