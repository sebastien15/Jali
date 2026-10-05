#!/usr/bin/env python3
"""Generate docs/ride-hailing/{stories/*.md, USER_STORIES.md} and scripts/create-ride-issues.sh.

Usage: python3 scripts/ride_backlog/generate.py   (edit stories here, never the generated files)
"""
import os, textwrap

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT = f"{ROOT}/docs/ride-hailing"
PLAN = "RIDE_HAILING_PLAN.md"

EPICS = [
    ("E0", "Foundations for on-demand rides", "phase-0",
     "Fix driver data that is silently lost today, persist driver mode, add ride permissions and a reusable push service, so the new products are built on solid ground."),
    ("E1", "Driver onboarding & verification", "phase-1",
     "Any verified person — taxi/moto driver or private car owner — can sign up to drive, upload documents and vehicles, and be approved by an admin."),
    ("E2", "Driver-set pricing", "phase-1",
     "Drivers set their own per-km rates (unlike Yego/Uber fixed tariffs), within guardrails set by the superadmin; the server computes and locks every quote."),
    ("E3", "Rider: discover nearby drivers & request a ride", "phase-1",
     "Riders enter a destination, see nearby drivers with *their* price for this trip (DiDi-style), and request one driver or broadcast to all."),
    ("E4", "Live trip experience", "phase-1",
     "From accept to rating, both sides see the same live status, with PIN-verified pickup, fair cancellation rules, payment confirmation and history."),
    ("E5", "Driver app: online mode & earnings", "phase-1",
     "Drivers go online, receive and accept requests, navigate, and track earnings and commission owed."),
    ("E6", "Hire a Driver", "phase-2",
     "Customers find and book a verified private driver to drive *their own* car — by the hour, day or trip."),
    ("E7", "Payments, receipts & commission", "phase-1",
     "Cash and MoMo at launch, commission ledger and driver payouts, then in-app MoMo and international cards."),
    ("E8", "Safety & trust", "phase-1",
     "Riders, drivers and families trust Jali: trip sharing, SOS, audit trail and quality monitoring."),
    ("E9", "International experience — feels like Uber/DiDi", "phase-1",
     "A visitor who uses Uber or DiDi at home opens Jali in Kigali and instantly knows what to do: familiar flow, their language, their phone number, their card, email receipts, airport pickup."),
    ("E10", "Admin operations for rides", "phase-1",
     "Admins can watch live operations, investigate rides, resolve disputes and see ride analytics."),
]

# (id, epic, title, labels, as_a, i_want, so_that, [acceptance criteria], [tech notes])
S = []
DEPS, SRC = {}, {}
def story(*a): S.append(a)

# ── E0 ──────────────────────────────────────────────────────────────────────
story("S0.1", "E0", "Fix: driver setup data is silently discarded", ["bug", "backend", "mobile"],
  "driver", "the car details I enter in *My Setup* to actually be saved",
  "I don't lose my work and riders see correct vehicle info",
  ["Given I fill car model, plate, seats, car type, insurance expiry, zones and amenities in `driver/setup.tsx`, when I tap Save, then every field is persisted (in `driver_profiles` / `vehicles`).",
   "When I reopen *My Setup*, all saved values are pre-filled from `GET /driver/profile`.",
   "Invalid input (e.g. empty plate, duplicate plate) returns `422` and the screen shows the field error instead of a generic alert.",
   "A success alert is shown only after the server confirms the save.",
   "Feature test covers save + reload round-trip."],
  ["Today `DriverController::updateProfile` validates only `name` and `fcm_token`; all other fields are dropped.",
   f"Introduce `driver_profiles` and `vehicles` tables ({PLAN} §7)."])

story("S0.2", "E0", "Driver mode survives app restarts", ["mobile"],
  "driver", "the app to remember that I'm in driver mode and which services I offer",
  "I don't have to re-enable it every time I open the app",
  ["Given I enabled driver mode, when I kill and reopen the app, then the Drive tab is still visible and my services are selected.",
   "Driver mode state is hydrated from the server (`GET /driver/profile`) and cached in AsyncStorage.",
   "Logging out clears the cached driver mode.",
   "`DriverType` supports `ride` and `hire` in addition to `private` and `rental`."],
  ["`lib/DriverModeContext.tsx` is in-memory only today."])

story("S0.3", "E0", "Seed ride-hailing permissions", ["backend", "security"],
  "superadmin", "new permissions for requesting, offering and managing rides",
  "every new endpoint follows Jali's guard rules",
  ["Permissions `request-rides`, `offer-rides`, `offer-driver-hire`, `verify-drivers`, `manage-rides`, `manage-ride-pricing` exist after `migrate` (migration) and `db:seed` (seeder).",
   "Role matrix matches the plan: users/drivers/admins can `request-rides`; drivers can `offer-rides` and `offer-driver-hire`; admins can `verify-drivers` and `manage-rides`; only superadmin has `manage-ride-pricing`.",
   "The roles & permissions screen shows the new permissions under a *Rides* category.",
   "`context.md` permission matrix is updated."],
  [f"{PLAN} §8. Follow the pattern of `add_manage_locations_permission` migration."])

story("S0.4", "E0", "Reusable push notification service", ["backend", "tech-debt"],
  "developer", "one `PushService` to send FCM notifications",
  "ride, hire and booking flows all notify users consistently",
  ["`App\\Services\\PushService::send(User $user, string $title, string $body, array $data = [])` exists and is used by `TicketController`.",
   "Missing `fcm_token` is a no-op (logged at debug), never an exception.",
   "Data payload supports deep links (e.g. `{\"screen\":\"ride\",\"id\":123}`) and the mobile app routes to that screen on tap.",
   "Unit test with a faked messaging client."],
  [])

# ── E1 ──────────────────────────────────────────────────────────────────────
story("S1.1", "E1", "Become a driver and choose services", ["mobile", "backend"],
  "private car owner or professional driver", "to sign up as a Jali driver and pick what I offer (rides, hire-a-driver, private seats, rentals)",
  "I can earn with my car or my driving skills",
  ["From Profile, *Become a driver* opens onboarding with a clear checklist: profile → documents → vehicle → rates → submit.",
   "I can select one or more services; the checklist adapts (e.g. hire-a-driver does not require a vehicle).",
   "Progress is saved after each step; I can leave and resume.",
   "Until verified, I see status *Under review* and cannot go online.",
   "Available in EN / FR / RW / SW."],
  [])

story("S1.2", "E1", "Upload driver documents", ["mobile", "backend", "security"],
  "driver applicant", "to upload my driving licence, national ID/passport, a selfie and vehicle insurance",
  "Jali can verify me and riders can trust me",
  ["I can take a photo or pick from gallery for: licence (front/back), national ID or passport, selfie, insurance certificate.",
   "Licence number, categories (A, B, C, D…) and expiry are required; expired licence is rejected with a clear message.",
   "Files are stored privately (not publicly readable URLs); only the owner and admins with `verify-drivers` can view them.",
   "Each document shows status: missing / uploaded / approved / rejected (with reason).",
   "Re-uploading a rejected document sets it back to *uploaded*."],
  ["`POST /driver/documents`; images compressed with `expo-image-manipulator` before upload."])

story("S1.3", "E1", "Register my vehicles", ["mobile", "backend"],
  "driver", "to add one or more vehicles with class, model, colour, plate and photos",
  "riders recognise my car and I can switch cars",
  ["Vehicle class is one of `moto`, `car`, `comfort`, `van`.",
   "Plate number is unique across Jali; duplicates return `422`.",
   "At least a front photo is required; up to 4 photos (front, side, interior, luggage).",
   "Insurance expiry is required; vehicles with expired insurance cannot be used to go online.",
   "I can mark one vehicle as active; only the active vehicle appears to riders."],
  ["`/driver/vehicles` CRUD. Reuse photo slots UI from `driver/setup.tsx`."])

story("S1.4", "E1", "Admin verification queue for drivers", ["admin", "backend", "mobile"],
  "admin", "a queue of driver applications to review documents and approve, reject or suspend",
  "only verified drivers can carry passengers",
  ["`(admin)/drivers` lists applicants filtered by status (pending / verified / rejected / suspended), oldest first.",
   "Detail screen shows every document full-screen, vehicle(s), and applicant info.",
   "Approve assigns the `driver` role and sets `verified_at`/`verified_by`; reject requires a reason.",
   "The driver receives a push notification for approve / reject / suspend.",
   "Suspended drivers are immediately set offline and cannot accept rides.",
   "Every action is written to `activity_logs`.",
   "Routes require `auth:sanctum` + `permission:verify-drivers`."],
  [])

# ── E2 ──────────────────────────────────────────────────────────────────────
story("S2.1", "E2", "Driver sets own per-km rates with live preview", ["mobile", "backend", "pricing"],
  "driver", "to set my own base fare, price per km, minimum fare and pickup charge",
  "I decide what my service is worth instead of a fixed platform tariff",
  ["Rates screen has fields: base fare, per km, per minute (optional), minimum fare, free pickup km, pickup per km, night multiplier.",
   "A live preview shows what a rider pays for sample trips (2 km, 5 km, 10 km) including Jali fee.",
   "Values outside the guardrails for my vehicle class are rejected with a message showing the allowed range.",
   "I can't go online until rates are set for my active vehicle.",
   "Rate changes apply only to new requests, never to rides already quoted."],
  [f"`GET/PUT /driver/rates`, `permission:offer-rides`. {PLAN} §3.1."])

story("S2.2", "E2", "Superadmin configures pricing guardrails & commission", ["admin", "backend", "pricing"],
  "superadmin", "to set min/max per-km and max minimum-fare per vehicle class, commission %, service fee, search radius and request timeout",
  "free pricing stays fair, legal and profitable",
  ["`(admin)/settings/rides` screen edits `payment_settings.config.rides`.",
   "Only `manage-ride-pricing` can read/write; others get `403`.",
   "Changing guardrails does not break existing driver rates — out-of-band drivers are flagged and notified to update.",
   "Defaults are seeded so the system works before configuration.",
   "Change is recorded in `activity_logs` with old/new values."],
  [f"{PLAN} §3.3. Check RURA regulations before setting production values."])

story("S2.3", "E2", "Server-side fare quote and price lock", ["backend", "pricing"],
  "rider", "the price I see to be the price I pay",
  "there are no surprises at the end of the trip",
  ["`FareService` computes the quote from the driver's rates, trip distance, pickup distance and night multiplier, rounded up to the nearest 100 RWF.",
   "The quote and a `rate_snapshot` are stored on the ride at request time; later rate changes don't affect it.",
   "Final fare equals the quoted fare unless the destination changes or actual distance exceeds the estimate by > 20% (adjustment requires rider confirmation).",
   "The client never sends a price that the server trusts.",
   "Unit tests cover min fare, pickup charge, night multiplier, rounding."],
  [f"{PLAN} §3.2, §3.4. Distance phase 1: haversine × road factor."])

# ── E3 ──────────────────────────────────────────────────────────────────────
story("S3.1", "E3", "\"Where to?\" — start a ride from Home", ["mobile", "ux"],
  "rider", "a big *Where to?* bar on Home with my pickup auto-detected",
  "booking a ride feels as fast as Uber",
  ["Home shows *Where to?* above existing bus/seat/rental content, plus *Ride now* and *Hire a driver* tiles.",
   "Pickup defaults to my GPS position (reverse-geocoded to a readable address); I can edit it or drop a pin.",
   "Destination search returns places in Rwanda with autocomplete in < 1 s on 3G.",
   "Saved places (Home, Work) and recent destinations appear before I type.",
   "If location permission is denied, I can still type my pickup manually."],
  ["Place search: Google Places or Nominatim/Photon (already used in `AppAccessController`)."])

story("S3.2", "E3", "See nearby drivers with their own price", ["mobile", "backend", "pricing"],
  "rider", "to see the drivers around me, each with their price for my exact trip",
  "I can choose the cheapest, closest or best-rated driver",
  ["`GET /rides/nearby` returns online, verified drivers within the configured radius, each with quote, ETA, distance, rating, trips count, vehicle (class, model, colour, seats, amenities, photo).",
   "Sort chips: Cheapest · Closest · Top rated; filter by vehicle class (Moto / Car / Comfort / Van).",
   "Driver positions are rounded to ~100 m; no phone numbers are exposed.",
   "Drivers whose last heartbeat is older than `presence_ttl_sec` are excluded.",
   "Empty state: *No drivers nearby right now* with options to widen radius or try broadcast.",
   "Response time < 500 ms with 500 online drivers (feature/perf test)."],
  [f"{PLAN} §4. Bounding-box + haversine."])

story("S3.3", "E3", "Map of nearby drivers", ["mobile", "ux", "phase-2"],
  "rider", "to see nearby drivers as car/moto icons on a map with prices on tap",
  "I get the same visual confidence as Uber/DiDi",
  ["Map shows my pickup pin and nearby drivers (vehicle-class icons) using approximate positions.",
   "Tapping a driver opens the same card as the list view; list ↔ map toggle keeps sort/filter.",
   "Icons refresh at least every 10 s without flicker.",
   "Works on Android (Google Maps key in `app.json`) and iOS."],
  ["Add `react-native-maps`; requires EAS rebuild."])

story("S3.4", "E3", "Request a specific driver", ["mobile", "backend"],
  "rider", "to tap a driver and send them my ride request",
  "I ride with the driver and price I chose",
  ["`POST /rides` with `mode=pick` creates a ride in `requested` and sends a push to the driver.",
   "I see a waiting screen with a 30 s countdown and can cancel for free.",
   "If the driver declines or the timeout passes, I'm offered the next best driver in one tap (`POST /rides/{id}/next-driver`).",
   "I cannot have two active rides at the same time (`409`).",
   "Pickup, dropoff and quote are validated server-side."],
  [])

story("S3.5", "E3", "Send request to all nearby drivers", ["mobile", "backend", "phase-2"],
  "rider in a hurry", "to send my request to all nearby drivers under a maximum price",
  "I get the fastest pickup without browsing",
  ["`mode=broadcast` with optional `max_fare` dispatches to up to N nearest drivers whose quote ≤ max fare.",
   "The first driver to accept wins; the others see *Ride taken* and the card disappears.",
   "The rider sees the winning driver's quote (always ≤ max fare).",
   "Dispatches are recorded in `ride_dispatches`."],
  [])

story("S3.6", "E3", "Fare estimate before choosing", ["mobile", "backend", "pricing"],
  "rider", "to see a price range for my trip per vehicle class before picking a driver",
  "I know what to expect, like Uber's price per class",
  ["After entering a destination, I see classes (Moto, Car, Comfort, Van) with a price range (min–max of nearby quotes) and nearest ETA.",
   "Classes with no available drivers are shown greyed out.",
   "Tapping a class opens the nearby driver list filtered to that class."],
  ["`POST /rides/estimate`."])

# ── E4 ──────────────────────────────────────────────────────────────────────
story("S4.1", "E4", "Track my driver until pickup", ["mobile", "backend"],
  "rider", "to see my driver's name, photo, car, plate, rating and ETA, and their position once accepted",
  "I can find the right car quickly and safely",
  ["After accept, the ride screen shows driver card, vehicle (colour, model, **plate in large text**), ETA and status.",
   "Status updates (accepted → arriving → arrived) appear within 5 s (polling phase 1, WebSocket phase 2).",
   "Push notifications for *Driver accepted* and *Driver has arrived*, even if the app is closed.",
   "Call driver button (masked number in phase 3).",
   "I can see the driver's exact position only after accept."],
  [])

story("S4.2", "E4", "Start the trip with a PIN", ["mobile", "backend", "security"],
  "rider", "to give the driver a 4-digit PIN to start the trip",
  "I'm sure I'm in the right car and the driver has the right passenger",
  ["Each ride gets a random 4-digit `start_pin` shown only to the rider.",
   "`POST /rides/{id}/start` requires the correct PIN; wrong PIN returns `422`; 5 wrong attempts lock and alert admins.",
   "Ride moves to `in_progress` only from `arrived`."],
  [])

story("S4.3", "E4", "Cancellation rules and fees", ["mobile", "backend"],
  "rider or driver", "clear and fair cancellation rules",
  "nobody is abused by no-shows or last-minute cancels",
  ["Rider can cancel free before the driver arrives; after `arrived` + 5 min waiting, a configurable cancel fee applies (shown before confirming).",
   "Driver can cancel with a reason; repeated driver cancels are counted and visible to admins.",
   "Cancellation reason is mandatory (pick list) and stored.",
   "Invalid transitions (e.g. cancel a completed ride) return `409`.",
   "The other party gets a push notification."],
  [f"{PLAN} §5.4 state machine."])

story("S4.4", "E4", "Complete trip and confirm payment", ["mobile", "backend", "payments"],
  "driver", "to end the trip and confirm how the rider paid",
  "both of us have a correct record",
  ["`POST /rides/{id}/complete` with `payment_method` (cash|momo) moves the ride to `completed` and sets `final_fare`.",
   "Rider sees a trip summary: route, distance, duration, fare breakdown (driver fare + Jali fee).",
   "Commission is written to the driver ledger.",
   "Only the assigned driver can complete, only from `in_progress`."],
  [])

story("S4.5", "E4", "Two-way rating", ["mobile", "backend"],
  "rider or driver", "to rate the other person 1–5 stars with optional tags and comment",
  "good drivers and riders are rewarded and bad behaviour is visible",
  ["Rating prompt appears after completion; can be skipped and done later from history.",
   "Tags: e.g. *Clean car, Safe driving, Friendly, Knows the way* / *On time, Polite*.",
   "One rating per person per ride (unique constraint).",
   "Driver's `rating_avg` and `rating_count` update; shown on nearby cards."],
  [])

story("S4.6", "E4", "Ride history in Trips tab", ["mobile", "backend"],
  "rider", "my rides listed with my bus/seat/rental bookings in the Trips tab",
  "all my Jali travel is in one place",
  ["Trips tab has a *Rides* filter; each item shows date, from → to, driver, fare and status.",
   "Tapping opens a detail with receipt and *Report an issue*.",
   "Paginated (`GET /rides`), cached with TanStack Query, skeleton while loading."],
  [])

# ── E5 ──────────────────────────────────────────────────────────────────────
story("S5.1", "E5", "Go online / offline", ["mobile", "backend"],
  "driver", "a big Online/Offline switch in the Drive tab",
  "I receive requests only when I'm ready to work",
  ["Switch is enabled only when: verified, active vehicle with valid insurance, rates set, and commission owed below the threshold; otherwise it explains what's missing.",
   "While online, the app sends a presence heartbeat every 5–10 s (`POST /driver/presence`) including in background, with the Android foreground-service notification.",
   "Going offline (or 60 s without heartbeat) removes me from nearby results.",
   "Background location stops immediately when offline.",
   "Store listing texts justify background location (`store_requirements.md`)."],
  ["`expo-location` + `expo-task-manager`."])

story("S5.2", "E5", "Receive and accept ride requests", ["mobile", "backend"],
  "online driver", "to see incoming requests with pickup area, destination, distance and **what I will earn**",
  "I can decide quickly",
  ["Request card shows pickup neighbourhood (not exact address), destination, trip km, pickup km, my earnings, and a 30 s countdown, with sound/vibration.",
   "Accept is atomic: if another driver already accepted, I get `409` and *Ride taken*.",
   "After accept I see the exact pickup and rider first name + rating.",
   "Decline is one tap and doesn't penalise me; ignoring repeatedly lowers my dispatch priority (configurable)."],
  [f"{PLAN} §5.2 race-safe update."])

story("S5.3", "E5", "Navigate to pickup and destination", ["mobile"],
  "driver", "one tap to open navigation to the pickup and then the destination",
  "I don't get lost",
  ["*Navigate* opens Google Maps or Waze (whichever is installed) with the coordinates.",
   "Buttons follow the trip state: Navigate to pickup → I've arrived → Enter PIN → Navigate to destination → Complete.",
   "Call rider button available after accept."],
  [])

story("S5.4", "E5", "Earnings and commission dashboard", ["mobile", "backend", "payments"],
  "driver", "to see my earnings today/this week/this month and what I owe Jali",
  "I manage my income and settle on time",
  ["`GET /driver/earnings` returns totals by period, trip count, commission owed and payout history.",
   "Drive tab reuses `WeekSummaryCard` with ride earnings included.",
   "When commission owed exceeds the threshold, I see a banner with how to settle (MoMo) and I can't go online."],
  [])

# ── E6 ──────────────────────────────────────────────────────────────────────
story("S6.1", "E6", "Driver sets hire-a-driver rates and skills", ["mobile", "backend", "pricing"],
  "professional driver", "to set hourly/daily rates and list my skills (manual/automatic, languages, licence categories, years of experience)",
  "customers who need a driver for their own car can find me",
  ["Fields: hourly rate + minimum hours, daily rate + hours included, overtime per hour, out-of-town fee per day.",
   "Skills: transmissions, languages (Kinyarwanda, English, French, Swahili, other), licence categories, years of experience.",
   "Validation against superadmin guardrails for hire rates.",
   "Requires `offer-driver-hire` and verification; no vehicle required."],
  [])

story("S6.2", "E6", "Driver availability calendar", ["mobile", "backend"],
  "driver", "to set my weekly working hours and block specific dates",
  "I only get hire requests when I'm free",
  ["Weekly schedule per weekday (start–end) and blocked dates.",
   "Accepted hires automatically block their time.",
   "Overlapping accepted hires are rejected server-side (`409`)."],
  [])

story("S6.3", "E6", "Find and book a driver for my car", ["mobile", "backend"],
  "car owner or visitor with a rented car", "to book a driver for a date, duration and trip type",
  "I can relax, attend an event, or travel upcountry without driving",
  ["Form: date/time, hours or days, pickup, trip type (city / out of town / airport), my car's transmission, notes.",
   "Results list available drivers who match transmission and are free, with total quote, rating, languages and experience.",
   "Booking creates a `driver_hire` in `requested` and notifies the driver; I see status updates.",
   "Clear terms on who is responsible for fuel, damage and driver meals (link to legal doc)."],
  ["Needs a legal clause in `legal/` (open question in plan §14)."])

story("S6.4", "E6", "Hire lifecycle: accept, check-in, check-out, overtime", ["mobile", "backend"],
  "driver and customer", "a clear lifecycle from request to completion",
  "time and money are recorded fairly",
  ["Driver can accept/decline within a configurable time; unanswered requests expire and the customer is told.",
   "Check-in and check-out record timestamps; overtime is computed automatically from the rate snapshot.",
   "Both sides get a summary and can rate each other.",
   "Cancellation policy (free until X hours before) is enforced."],
  [])

# ── E7 ──────────────────────────────────────────────────────────────────────
story("S7.1", "E7", "Cash and MoMo payment to driver (launch)", ["payments", "mobile", "backend"],
  "rider", "to pay my driver in cash or MoMo directly",
  "I can ride from day one without card setup",
  ["Rider picks preferred method before requesting; driver sees it on the request card.",
   "MoMo option shows the driver's MoMo number/name after completion.",
   "Driver confirms received method at completion; disputes can be reported from history."],
  [])

story("S7.2", "E7", "Commission ledger, settlement and driver payouts", ["payments", "backend", "admin"],
  "superadmin", "every ride and hire to record commission owed and earnings in a ledger",
  "Jali gets paid and drivers can cash out",
  ["`driver_ledger` entries are created on completion (earning, commission) with running balance.",
   "Drivers can settle commission via MoMo; admins confirm settlement.",
   "Drivers can request payouts through the existing `cashout_requests` flow (add `user_id` support).",
   "Ledger totals reconcile with completed rides in a test."],
  [f"{PLAN} §11."])

story("S7.3", "E7", "In-app MoMo and international card payments", ["payments", "phase-2", "international"],
  "visitor or resident", "to pay in the app with MoMo, Airtel Money or my Visa/Mastercard",
  "I don't need cash or a local SIM, just like Uber",
  ["Payment methods screen: add card (tokenised by a PCI-compliant provider), MoMo, Airtel Money.",
   "Card is charged at completion for the final fare; receipt sent.",
   "Failed payment falls back to asking for cash/MoMo and flags the ride.",
   "No raw card data ever touches Jali servers."],
  ["See `PAYMENT_POSSIBILITES.md` for providers."])

# ── E8 ──────────────────────────────────────────────────────────────────────
story("S8.1", "E8", "Share my trip", ["mobile", "backend", "safety", "phase-2"],
  "rider", "to share a live trip link with family or friends via WhatsApp/SMS",
  "someone knows where I am",
  ["*Share trip* creates a time-limited public link showing status, driver name/photo, car and plate, and approximate live position.",
   "Link expires when the ride ends.",
   "No rider personal data beyond first name is shown."],
  [])

story("S8.2", "E8", "SOS emergency button", ["mobile", "backend", "safety", "phase-2"],
  "rider or driver", "an SOS button during a trip",
  "I can get help fast in an emergency",
  ["SOS asks for confirmation, then calls 112 and sends my live location to my emergency contact.",
   "The ride is flagged in admin with a high-priority alert.",
   "I can set an emergency contact in Profile."],
  [])

story("S8.3", "E8", "Ride audit trail", ["backend", "admin", "safety"],
  "admin", "every ride state change recorded with who, when and where",
  "disputes and incidents can be investigated",
  ["Each transition writes a `ride_events` row (actor, type, payload, timestamp).",
   "Admin ride detail shows the timeline.",
   "Events are append-only (no update/delete endpoints)."],
  [])

story("S8.4", "E8", "Flag low-rated or high-cancel drivers", ["backend", "admin", "safety"],
  "admin", "drivers with low ratings or many cancellations flagged automatically",
  "quality stays high",
  ["Drivers below 4.0 average after 20 rated trips, or above a configurable cancel rate, appear in a *Needs review* list.",
   "Admin can warn or suspend from the list; driver is notified."],
  [])

# ── E9 ──────────────────────────────────────────────────────────────────────
story("S9.1", "E9", "Familiar Uber/DiDi-style ride flow (UX benchmark)", ["ux", "mobile", "international"],
  "visitor who uses Uber or DiDi at home", "Jali's ride flow to look and behave like the apps I know",
  "I can book my first ride in Kigali without learning anything new",
  ["Flow matches the standard pattern: *Where to?* → class cards with price & ETA → driver list/map → confirm pickup → waiting → driver card with plate → in-trip → receipt & rating.",
   "Bottom-sheet layout over map/list, one primary action per screen, ≤ 3 taps from Home to request.",
   "Usability test with at least 5 non-Rwandan users: ≥ 4 of 5 request a ride without help.",
   "Uses Jali theme (`C.xxx`), not copied brand assets."],
  [])

story("S9.2", "E9", "Language, international phone numbers and email login", ["mobile", "backend", "international"],
  "visitor", "the app in my language and to log in with my foreign phone number, email, Google or Apple",
  "I can start immediately after landing",
  ["App language defaults to the device language when supported (EN/FR/RW/SW), otherwise English; switchable in Profile.",
   "Phone login accepts any country code (+1, +33, +44, +254…), not only +250.",
   "Email and Google login work without a phone number; phone becomes optional but recommended for drivers to call.",
   "All new ride/hire strings exist in all four locale files."],
  [])

story("S9.3", "E9", "Sign in with Apple", ["mobile", "backend", "international"],
  "iPhone user", "to sign in with Apple",
  "I can log in privately — and Jali can be published on the App Store",
  ["*Sign in with Apple* button on iOS login screen.",
   "Backend verifies the Apple identity token (via Firebase) and returns a Sanctum token like Google login.",
   "Hidden-relay emails are supported."],
  ["Apple guideline 4.8 requires it when Google login is offered — listed as blocker in `store_requirements.md`."])

story("S9.4", "E9", "Show prices in my home currency too", ["mobile", "international"],
  "visitor", "to see an approximate USD/EUR equivalent next to RWF prices",
  "I instantly understand how much a ride costs",
  ["Optional setting *Show approx. price in* USD / EUR / GBP / KES / none (default from device locale).",
   "Prices show as `3,400 RWF (~$2.40)`; RWF stays the charged amount.",
   "Exchange rates refresh daily from the backend (cached); stale > 3 days hides the conversion."],
  [])

story("S9.5", "E9", "In-app chat with quick, translated phrases", ["mobile", "backend", "international", "phase-2"],
  "rider who doesn't speak Kinyarwanda", "to message my driver with quick phrases that appear in the driver's language",
  "we can coordinate pickup without a common language",
  ["Chat available between accept and completion only.",
   "Quick replies (*I'm here*, *Where are you?*, *I'm wearing…*, *Please wait 2 minutes*) are shown to each side in their app language.",
   "Free text is delivered as written; optional machine translation shown beneath.",
   "No phone numbers or links can be sent in chat (filtered)."],
  [])

story("S9.6", "E9", "Email receipts for every trip", ["backend", "international", "payments"],
  "business traveller", "a receipt by email after every ride and hire",
  "I can claim expenses",
  ["Receipt includes date, route, distance, duration, driver name and plate, fare breakdown, payment method and Jali company details.",
   "Sent automatically when an email is on file; can be re-sent from trip detail.",
   "Available as PDF download in the app."],
  [])

story("S9.7", "E9", "Airport pickup at Kigali International Airport", ["mobile", "backend", "international", "phase-2"],
  "visitor landing in Kigali", "to pre-book a ride or driver for my arrival with my flight number",
  "someone is waiting for me when I land",
  ["Airport is a preset pickup with a defined meeting point and instructions.",
   "I can schedule a pickup with flight number; the driver is notified of the time.",
   "Driver can display my name on a sign (*Meet & greet* option with configurable fee)."],
  [])

# ── E10 ─────────────────────────────────────────────────────────────────────
story("S10.1", "E10", "Live operations view", ["admin", "mobile", "backend"],
  "admin", "to see online drivers and active rides in real time",
  "I can spot problems and supply gaps",
  ["`GET /admin/rides/live` returns online drivers and active rides; screen refreshes every 10 s.",
   "Counters: drivers online by class, rides by status, requests expired in the last hour.",
   "Requires `manage-rides`."],
  [])

story("S10.2", "E10", "Rides list, detail and dispute handling", ["admin", "mobile", "backend"],
  "admin", "to search rides and act on reported issues",
  "riders and drivers get fair resolution",
  ["Filters: status, date range, rider, driver, flagged.",
   "Detail shows timeline (`ride_events`), fare breakdown, ratings and reports.",
   "Admin can adjust final fare / commission with a mandatory note (logged)."],
  [])

story("S10.3", "E10", "Ride analytics", ["admin", "backend", "analytics"],
  "superadmin", "ride metrics on the analytics screen",
  "I can steer growth and pricing",
  ["Metrics by day/week: requested, completed, cancellation rate (by side), expired rate, GMV, commission, average fare per km by class, average pickup ETA.",
   "Top drivers by trips and rating.",
   "Requires `view-analytics`; uses existing analytics screen patterns."],
  [])

exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'stories_level2_3.py')).read())

IDS = {s[0] for s in S}
for k, v in DEPS.items():
    assert k in IDS, k
    for d in v: assert d in IDS, (k, d)

# dependency waves (topological levels) — stories in the same wave can be built in parallel
WAVE = {}
def wave(sid, seen=()):
    if sid in WAVE: return WAVE[sid]
    assert sid not in seen, f"cycle at {sid}"
    WAVE[sid] = 1 + max((wave(d, seen + (sid,)) for d in DEPS.get(sid, [])), default=0)
    return WAVE[sid]
for s in S: wave(s[0])

UI = {"mobile", "ux"}

def story_body(s):
    sid, eid, title, labels, who, want, why, ac, tech = s
    b = f"## User story\n**As a** {who},\n**I want** {want},\n**so that** {why}.\n\n"
    b += "## Acceptance criteria\n" + "".join(f"- [ ] {a}\n" for a in ac)
    if UI & set(labels):
        b += "- [ ] Passes the UX quality checklist (`docs/ride-hailing/UX_QUALITY_CHECKLIST.md`)\n"
    if "backend" in labels:
        b += "- [ ] Routes inside `auth:sanctum` + `permission:<x>`, ownership checked in the controller, feature tests added\n"
    if tech:
        b += "\n## Notes\n" + "".join(f"- {t}\n" for t in tech)
    b += "\n## Planning\n"
    b += f"- **Story ID:** {sid} · **Epic:** {eid} · **Wave:** {WAVE[sid]}\n"
    deps = DEPS.get(sid, [])
    b += f"- **Depends on:** {', '.join(deps) if deps else 'nothing — can start anytime'}\n"
    if sid in SRC:
        b += f"- **Inspired by:** {SRC[sid]}\n"
    b += f"- **Architecture:** `{PLAN}`\n"
    return b

def epic_body(e):
    eid, title, phase, goal = e
    items = [s for s in S if s[1] == eid]
    b = f"## Goal\n{goal}\n\n## Stories\n" + "".join(f"- {s[0]} — {s[2]} (wave {WAVE[s[0]]})\n" for s in items)
    b += f"\n## Done when\n- [ ] All stories in this epic are closed\n- [ ] CI is green and the app builds with EAS\n\nArchitecture: `{PLAN}`\n"
    return b

def slug(t):
    out = "".join(c if c.isalnum() else "-" for c in t.lower())
    while "--" in out: out = out.replace("--", "-")
    return out.strip("-")[:50].strip("-")

import shutil
shutil.rmtree(f"{OUT}/stories", ignore_errors=True)
os.makedirs(f"{OUT}/stories", exist_ok=True)
os.makedirs(f"{ROOT}/scripts", exist_ok=True)

def sort_key(sid):
    a, b = sid[1:].split(".")
    return (int(a), int(b))
S.sort(key=lambda s: sort_key(s[0]))
EPICS.sort(key=lambda e: int(e[0][1:]))

manifest = []
for e in EPICS:
    fn = f"{e[0]}-epic.md"
    open(f"{OUT}/stories/{fn}", "w").write(epic_body(e))
    manifest.append(("epic", e[0], f"[Epic] {e[0]} — {e[1]}", ["epic", "ride-hailing", e[2]], fn, ""))
for s in S:
    fn = f"{s[0]}-{slug(s[2])}.md"
    open(f"{OUT}/stories/{fn}", "w").write(story_body(s))
    phase = next((l for l in s[3] if l.startswith("phase-")), next(e[2] for e in EPICS if e[0] == s[1]))
    labels = ["user-story", "ride-hailing", phase, f"wave-{WAVE[s[0]]}"] + [l for l in s[3] if not l.startswith("phase-")]
    manifest.append(("story", s[0], f"{s[0]} {s[2]}", labels, fn, s[1]))
FILE = {m[1]: m[4] for m in manifest}

# overview
nw = max(WAVE.values())
by_phase = {}
for m in manifest:
    if m[0] == "story":
        ph = m[3][2]; by_phase[ph] = by_phase.get(ph, 0) + 1
ov = ["# Jali Ride & Hire-a-Driver — User Stories", "",
      f"> Full backlog for the on-demand products described in `{PLAN}` — the best features of Uber, DiDi, Bolt, inDrive, Careem and Grab, plus Jali's own driver-set pricing.",
      "> Each story has acceptance criteria and becomes one GitHub issue (`scripts/create-ride-issues.sh`).", "",
      f"**{len(EPICS)} epics · {len(S)} stories · {nw} dependency waves**", "",
      "| Level | Phase label | Stories | Meaning |", "|---|---|---|---|",
      f"| 1 — MVP | `phase-0`, `phase-1` | {by_phase.get('phase-0',0) + by_phase.get('phase-1',0)} | Rides work end-to-end, safely, in one city |",
      f"| 2 — Uber parity | `phase-2` | {by_phase.get('phase-2',0)} | Everything a visitor expects from Uber/DiDi/Bolt |",
      f"| 3 — Beyond | `phase-3` | {by_phase.get('phase-3',0)} | Subscriptions, loyalty, fleets, partners, delivery, web |", "",
      "Working with several AI agents? Read `AI_AGENTS_GUIDE.md` first. Every UI story must pass `UX_QUALITY_CHECKLIST.md`.", "",
      "## Build order — dependency waves", "",
      "Stories in the same wave don't depend on each other and can be built **in parallel**. A story can start once everything in its *Depends on* list is merged.", ""]
for w in range(1, nw + 1):
    ids = [s[0] for s in S if WAVE[s[0]] == w]
    ov.append(f"- **Wave {w}** ({len(ids)}): " + ", ".join(f"[{i}](stories/{FILE[i]})" for i in ids))
ov.append("")
for e in EPICS:
    ov += [f"## {e[0]} — {e[1]}  `{e[2]}`", "", e[3], "", "| ID | Story | Wave | Depends on | Inspired by |", "|---|---|---|---|---|"]
    for s in S:
        if s[1] == e[0]:
            ov.append(f"| [{s[0]}](stories/{FILE[s[0]]}) | {s[2]} | {WAVE[s[0]]} | {', '.join(DEPS.get(s[0], [])) or '—'} | {SRC.get(s[0], '—')} |")
    ov.append("")
open(f"{OUT}/USER_STORIES.md", "w").write("\n".join(ov))

# issue creation script
sh = ['#!/usr/bin/env bash',
      '# Creates the Jali Ride user stories as GitHub issues (epics first, then stories linked to them).',
      '# Generated from docs/ride-hailing/stories — do not edit by hand.',
      '# Usage: scripts/create-ride-issues.sh [owner/repo]   (requires: gh auth login)',
      'set -euo pipefail',
      'REPO="${1:-sebastien15/Jali}"',
      'DIR="$(cd "$(dirname "$0")/.." && pwd)/docs/ride-hailing/stories"',
      '',
      'ensure_label() { gh label create "$1" --repo "$REPO" --color "$2" --force >/dev/null; }',
      'for l in epic:5319e7 user-story:0e8a16 ride-hailing:0055cc phase-0:c5def5 phase-1:bfd4f2 phase-2:d4c5f9 phase-3:e4e669 \\',
      '         backend:1d76db mobile:009e8e admin:7c3aed ux:fbca04 payments:00a63e pricing:ff5c00 \\',
      '         safety:b60205 security:b60205 international:0e8a16 analytics:c2e0c6 bug:d73a4a tech-debt:cccccc; do',
      '  ensure_label "${l%%:*}" "${l##*:}"',
      'done',
      f'for w in $(seq 1 {nw}); do ensure_label "wave-$w" ededed; done',
      '',
      'declare -A EPIC_NUM',
      'create() { # title labels file -> prints issue number',
      '  local url; url=$(gh issue create --repo "$REPO" --title "$1" --label "$2" --body-file "$3")',
      '  echo "${url##*/}"',
      '}',
      '']
for m in manifest:
    kind, sid, title, labels, fn, eid = m
    t = title.replace('"', '\\"').replace('$', '\\$').replace('`', '\\`')
    if kind == "epic":
        sh.append(f'EPIC_NUM[{sid}]=$(create "{t}" "{",".join(labels)}" "$DIR/{fn}"); echo "#${{EPIC_NUM[{sid}]}} {t}"')
    else:
        sh += [f'tmp=$(mktemp); {{ cat "$DIR/{fn}"; echo; echo "Part of #${{EPIC_NUM[{eid}]}}"; }} > "$tmp"',
               f'n=$(create "{t}" "{",".join(labels)}" "$tmp"); rm -f "$tmp"; echo "#$n {t}"',
               f'gh issue comment "${{EPIC_NUM[{eid}]}}" --repo "$REPO" --body "- [ ] #$n {sid}" >/dev/null']
sh.append('echo "Done."')
open(f"{ROOT}/scripts/create-ride-issues.sh", "w").write("\n".join(sh) + "\n")
os.chmod(f"{ROOT}/scripts/create-ride-issues.sh", 0o755)
print(len(EPICS), "epics,", len(S), "stories,", nw, "waves", by_phase)
