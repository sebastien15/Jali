# Level 2 (Uber parity) and Level 3 (beyond) stories + dependencies and sources — loaded by generate.py
EPICS += [
    ("E11", "Maps, places & routing", "phase-2",
     "Road-accurate distance and ETA, route lines, smooth car movement and pickup points that work in a city with few formal addresses."),
    ("E12", "Realtime infrastructure", "phase-2",
     "Instant, reliable updates for riders and drivers via WebSockets, with recovery after network loss or app restarts."),
    ("E13", "More ways to ride", "phase-2",
     "Every ride option people expect from Uber, Bolt, DiDi and inDrive: scheduled, for others, multi-stop, hourly, intercity, preferences."),
    ("E14", "Pricing, offers, wallet & rewards", "phase-2",
     "Rider price offers, promos, referrals, tipping, split fare, Jali Wallet, subscription and loyalty."),
    ("E15", "Rider account & convenience", "phase-2",
     "Favourites, business and family profiles, lost items, accessibility, onboarding and store-mandated account controls."),
    ("E16", "Communication & customer support", "phase-2",
     "Masked calls, help centre, support tickets, live agent chat, fare reviews and refunds."),
    ("E17", "Driver tools & growth", "phase-2",
     "Demand heatmap, destination filter, incentives, queues, fatigue limits, instant cashout and training — what keeps drivers loyal."),
    ("E18", "Advanced safety", "phase-2",
     "Identity checks, anomaly detection, audio recording, driving-behaviour alerts and a safety toolkit."),
    ("E19", "Fleets & business partners", "phase-3",
     "Fleet owners, company accounts, hotel concierge booking and a partner API."),
    ("E20", "Jali Send — package delivery", "phase-3",
     "Send packages across the city by moto or car with proof of delivery."),
    ("E21", "Platform quality, security & compliance", "phase-1",
     "Monitoring, CI, staging with simulated drivers, load tests, fraud prevention, data protection and an API contract that allows a future Rust backend."),
    ("E22", "Growth & marketing", "phase-3",
     "Deep links, campaigns, app-store ratings and a web booking page."),
]

# ── E10 additions ───────────────────────────────────────────────────────────
story("S10.4", "E10", "Service areas, cities & geofences", ["admin", "backend", "phase-2"],
  "superadmin", "to define service areas per city with their own guardrails and on/off switch",
  "we can launch Kigali first and add Musanze, Rubavu, Huye later",
  ["Admin draws or uploads polygons for service areas and special zones (airport, stadium).",
   "Requests with pickup outside an active area get a clear *Not available here yet* message.",
   "Guardrails, commission and features can be overridden per city.",
   "Zones are reused by airport queue, pickup points and heatmap."], [])

# ── E11 Maps ────────────────────────────────────────────────────────────────
story("S11.1", "E11", "Road-based distance and ETA", ["backend", "pricing"],
  "rider", "prices and ETAs computed on real roads, not straight lines",
  "quotes are fair and arrival times are believable",
  ["`GeoService` gets route distance/duration from a routing engine (self-hosted OSRM with Rwanda OSM data, or Google Directions behind an interface).",
   "Results cached by rounded origin/destination for 10 min.",
   "If routing fails, falls back to haversine × road factor and logs it.",
   "Quotes in S2.3 use route km; existing tests updated."], ["Interface lets us switch provider without touching `FareService`."])
story("S11.2", "E11", "Route line on the map", ["mobile"],
  "rider or driver", "to see the route drawn on the map during pickup and trip",
  "I know where we are going",
  ["Polyline from driver → pickup while arriving, pickup → destination during trip.",
   "Route refreshes when the driver deviates by more than 200 m.",
   "Passed and remaining parts are styled differently."], [])
story("S11.3", "E11", "Smooth moving car on the map", ["mobile", "ux"],
  "rider", "the driver's car to glide smoothly and turn in the right direction",
  "the app feels alive and precise like Uber",
  ["Marker interpolates between location updates (no jumps) at 60 fps on a mid-range Android.",
   "Marker rotates with heading; snaps to road when routing data is available.",
   "Camera follows the car without fighting manual pan/zoom."], [])
story("S11.4", "E11", "Suggested pickup points and landmarks", ["mobile", "backend", "admin"],
  "rider", "the app to suggest the nearest good pickup point (gate, main road, landmark)",
  "the driver finds me fast even without a street address",
  ["When I set a pin, up to 3 nearby suggested points appear (admin-curated + learned from past successful pickups).",
   "Admin can create named pickup points for malls, hotels, hospitals, airport, stadium.",
   "Venue zones force the venue's official pickup point."], [])
story("S11.5", "E11", "Saved places with labels and driver notes", ["mobile", "backend"],
  "rider", "to save places like *Home – blue gate after the church* with a note for drivers",
  "repeat trips need zero explanation",
  ["Unlimited saved places with label, icon and optional note shown to the driver.",
   "Edit/delete; synced across devices via the account.",
   "Notes are shown to the driver only after accept."], [])
story("S11.6", "E11", "Describe or photograph my pickup spot", ["mobile", "backend"],
  "rider", "to add a short note or a photo of where I'm standing",
  "the driver recognises the spot",
  ["Optional text (140 chars) and one photo per ride, visible to the driver after accept.",
   "Photo deleted 24 h after ride completion."], [])
story("S11.7", "E11", "Live ETA countdown", ["mobile", "backend"],
  "rider", "an ETA that updates continuously while the driver approaches and during the trip",
  "I know exactly when to go outside and when I'll arrive",
  ["ETA recalculated at least every 30 s from the driver's position and route.",
   "Shows arrival clock time during the trip (*Arrive 14:32*).",
   "Push when the driver is 1 minute away."], [])

# ── E12 Realtime ────────────────────────────────────────────────────────────
story("S12.1", "E12", "WebSockets with Laravel Reverb", ["backend", "mobile"],
  "developer", "ride status, driver location and new requests pushed over WebSockets",
  "updates are instant and battery/data usage drops versus polling",
  ["Private channels `ride.{id}` (rider + assigned driver) and `driver.{id}` with Sanctum auth.",
   "Events: ride status changed, driver location, new dispatch, dispatch withdrawn.",
   "Polling remains as automatic fallback when the socket is down.",
   "Load test: 2,000 concurrent connections on one VPS."], [])
story("S12.2", "E12", "Recover trip state after network loss or app kill", ["mobile", "backend"],
  "rider or driver", "my active trip to reappear exactly where it was after reopening the app or regaining network",
  "a bad connection never breaks a trip",
  ["On launch, app calls `/rides/active` and routes to the active trip screen.",
   "Offline banner during network loss; queued actions (e.g. *arrived*) retried with idempotency keys.",
   "No duplicate state transitions from retries (test)."], [])
story("S12.3", "E12", "Reliable notifications", ["backend", "mobile"],
  "driver", "ride request notifications that always arrive and ring loudly",
  "I never miss a request",
  ["High-priority FCM with a dedicated Android channel and custom sound for ride requests.",
   "Delivery and open rates tracked per notification type.",
   "SMS fallback for critical rider events (driver arrived) when push isn't opened within 60 s (configurable)."], [])

# ── E13 More ways to ride ───────────────────────────────────────────────────
story("S13.1", "E13", "Schedule a ride in advance", ["mobile", "backend"],
  "rider", "to book a ride for a future date and time",
  "early flights and important meetings are covered",
  ["Schedule from 30 min to 30 days ahead; quote shown and locked at booking.",
   "Driver can accept in advance, or dispatch starts 15 min before pickup if unassigned.",
   "Reminders to rider and driver; free cancellation until 60 min before (configurable)."], [])
story("S13.2", "E13", "Book a ride for someone else", ["mobile", "backend"],
  "rider", "to book a ride for a parent, friend or guest",
  "they travel safely even without the app",
  ["Pick a contact; the passenger gets an SMS with driver name, car, plate and live link.",
   "The PIN is sent to the passenger; I can track and pay."], [])
story("S13.3", "E13", "Multiple stops", ["mobile", "backend", "pricing"],
  "rider", "to add up to 3 stops on my trip",
  "I can drop a friend or pick up something on the way",
  ["Stops added before or during the trip; quote recalculated and confirmed.",
   "Wait time at a stop beyond 3 min charged with the driver's per-minute rate."], [])
story("S13.4", "E13", "Change destination during the trip", ["mobile", "backend", "pricing"],
  "rider", "to change my destination mid-trip",
  "plans can change without ending the ride",
  ["New destination produces a new quote that I confirm; the driver is notified.",
   "Fare = distance already travelled at the old rate snapshot + new segment."], [])
story("S13.5", "E13", "Ride preferences", ["mobile", "backend"],
  "rider", "to set preferences like quiet ride, AC on, help with luggage",
  "the ride feels personal",
  ["Preferences saved on profile and shown to the driver on accept.",
   "Drivers can mark which preferences they support; filter in nearby list."], [])
story("S13.6", "E13", "Women-only option", ["mobile", "backend", "safety"],
  "woman rider", "to choose to be matched only with women drivers",
  "I feel safer, especially at night",
  ["Option visible only to riders whose profile gender is female; only women drivers are shown or dispatched.",
   "Driver gender is verified during onboarding (S1.2).",
   "Legal review of the feature before launch."], [])
story("S13.7", "E13", "Hourly ride with driver's car", ["mobile", "backend", "pricing"],
  "rider", "to book a driver with their car for several hours and multiple stops",
  "errands, business days and tours are simple",
  ["Packages of 2/4/8 hours with km allowance, priced from driver's hourly rates.",
   "Extra time and km beyond allowance charged automatically."], ["Reuses hourly rates from S6.1."])
story("S13.8", "E13", "On-demand intercity rides", ["mobile", "backend", "pricing"],
  "rider", "to request a private car to another city now, with the driver's own price",
  "I can travel upcountry immediately",
  ["Intercity destinations show drivers who accept intercity trips, with their quote (including empty return if set).",
   "Links to existing scheduled private seats as a cheaper alternative."], [])
story("S13.9", "E13", "Child seat, wheelchair-friendly and pet-friendly vehicles", ["mobile", "backend"],
  "rider", "to filter for vehicles with a child seat, wheelchair access or that accept pets",
  "families, people with disabilities and pet owners can ride",
  ["Vehicle capabilities are tags set by drivers and verified by admin photos.",
   "Filters on nearby list and estimate screen; optional surcharge set by the driver."], [])
story("S13.10", "E13", "Wait & save / priority pickup", ["mobile", "backend", "pricing"],
  "rider", "to choose a cheaper ride if I can wait, or pay more for the closest driver",
  "I control the trade-off between time and money",
  ["*Wait & save* broadcasts to drivers willing to give a discount for flexible pickup (≤ 15 min).",
   "*Priority* picks the nearest driver with a driver-set premium."], [])

# ── E14 Pricing, offers, wallet, rewards ────────────────────────────────────
story("S14.1", "E14", "Rider offers a price, drivers accept or counter", ["mobile", "backend", "pricing"],
  "rider", "to propose my own price and receive driver counter-offers",
  "price is negotiated fairly, inDrive-style",
  ["Rider sets an offer within guardrails; nearby drivers see it and can accept or counter once.",
   "Rider sees offers with driver rating, ETA and car, and picks one within 60 s.",
   "Offers recorded in `ride_offers`; accept is atomic."], [])
story("S14.2", "E14", "Promo codes", ["backend", "admin", "mobile"],
  "marketing admin", "to create promo codes with amount/percent, expiry, usage limits and target segments",
  "we can run launch campaigns",
  ["Rider enters a code or it is auto-applied from a deep link; discount shown before requesting.",
   "Discount funded by Jali: driver earnings unaffected; ledger records it.",
   "Abuse limits: one per user/device, max uses, min fare."], [])
story("S14.3", "E14", "Referral program", ["backend", "mobile"],
  "rider or driver", "a personal invite code that rewards me and my friend",
  "Jali grows through word of mouth",
  ["Rider referral: credit for both after the friend's first completed ride.",
   "Driver referral: bonus after the referred driver completes N trips.",
   "Fraud checks: same device/phone/payment cannot self-refer."], [])
story("S14.4", "E14", "Tipping", ["mobile", "backend", "payments"],
  "rider", "to tip my driver after the trip",
  "I can reward great service",
  ["Preset amounts and custom; available up to 24 h after the trip.",
   "100% of tips go to the driver (no commission); ledger records them."], [])
story("S14.5", "E14", "Split fare", ["mobile", "backend", "payments"],
  "rider", "to split the fare with friends in the car",
  "sharing a ride is easy",
  ["Invite Jali users by phone; each pays their share via in-app payment.",
   "If someone doesn't accept before trip end, the requester pays their share."], ["Needs in-app payments (S7.3 / S14.6)."])
story("S14.6", "E14", "Jali Wallet", ["mobile", "backend", "payments"],
  "rider", "a Jali Wallet I can top up with MoMo or card and use for rides, receiving refunds and cashback",
  "paying is one tap and refunds are instant",
  ["Top-up via MoMo/card; balance and transaction history.",
   "Rides, hires and deliveries can be paid from wallet; partial wallet + other method supported.",
   "Double-entry ledger; reconciliation report for finance."], [])
story("S14.7", "E14", "Jali Pass subscription", ["mobile", "backend", "payments", "phase-3"],
  "frequent rider", "a monthly subscription with discounts and no service fee",
  "riding often is cheaper",
  ["Plans configurable by superadmin (price, discount %, perks).",
   "Auto-renewal from wallet; cancel anytime; benefits applied at quote time."], [])
story("S14.8", "E14", "Loyalty points and member levels", ["mobile", "backend", "phase-3"],
  "rider", "to earn points on every trip and unlock levels with perks",
  "I'm rewarded for staying with Jali",
  ["Points per RWF spent; levels (e.g. Silver/Gold/Platinum) with perks (priority support, free cancellations).",
   "Points redeemable for ride discounts; expiry rules."], [])

# ── E15 Rider account ───────────────────────────────────────────────────────
story("S15.1", "E15", "Favourite drivers", ["mobile", "backend"],
  "rider", "to save drivers I liked and request them first when they're online",
  "I can ride with people I trust",
  ["Heart a driver after a trip; favourites shown at top of nearby list when online.",
   "Can send a request directly to a favourite even slightly outside the radius."], [])
story("S15.2", "E15", "Business profile and expense reports", ["mobile", "backend"],
  "professional", "to switch between personal and business profiles",
  "work rides are separated and reported automatically",
  ["Business profile with its own payment method and receipt email.",
   "Monthly CSV/PDF report of business rides."], [])
story("S15.3", "E15", "Family profile", ["mobile", "backend", "phase-3"],
  "parent", "to pay for my family members' rides and see their trips",
  "my family travels safely",
  ["Invite members; their rides are charged to my payment method; I get trip notifications."], [])
story("S15.4", "E15", "Notification preferences", ["mobile", "backend"],
  "user", "to choose which notifications I get (trip, promotions, news) and on which channel",
  "I only receive what I want",
  ["Trip-critical notifications cannot be disabled; marketing is opt-in and respected by campaigns."], [])
story("S15.5", "E15", "Report a lost item", ["mobile", "backend"],
  "rider", "to report an item I left in the car and contact the driver",
  "I get my things back",
  ["Available for 72 h after a trip; masked call or message to driver.",
   "Return delivery fee (driver-set) can be paid in-app; admin can follow up."], [])
story("S15.6", "E15", "Delete my account and export my data", ["mobile", "backend", "security", "phase-1"],
  "user", "to delete my account and download my data from inside the app",
  "my privacy rights are respected (required by Apple and Google)",
  ["*Delete account* in Profile with confirmation; data anonymised/deleted per retention rules; financial records kept as legally required.",
   "*Download my data* produces a JSON/PDF export by email."], [])
story("S15.7", "E15", "Dark mode and accessibility", ["mobile", "ux"],
  "user", "dark mode, large text and screen-reader support",
  "the app works for everyone in any light",
  ["All ride screens support system dark mode via theme tokens.",
   "Every touchable has an accessibility label; layouts work at 200% font scale.",
   "Contrast ratio ≥ 4.5:1 for text."], [])
story("S15.8", "E15", "First-time onboarding", ["mobile", "ux"],
  "first-time rider", "a 3-screen intro explaining driver-set prices and how to ride",
  "I understand what makes Jali different",
  ["Shown once; skippable; available again from Help.",
   "Explains: choose your driver's price, PIN to start, safety features."], [])

# ── E16 Support ─────────────────────────────────────────────────────────────
story("S16.1", "E16", "Masked phone calls", ["backend", "mobile", "security"],
  "rider or driver", "to call the other party without seeing their real number",
  "my phone number stays private",
  ["Calls routed through a telephony provider's proxy number valid only during the trip + 2 h.",
   "Fallback to in-app chat if the provider is down."], [])
story("S16.2", "E16", "Help centre with trip-specific help", ["mobile", "backend"],
  "user", "help articles relevant to my last trips",
  "I solve most problems myself",
  ["Help topics are managed by admins in all 4 languages.",
   "From a trip detail, I see contextual topics (charged wrong, driver behaviour, lost item)."], [])
story("S16.3", "E16", "Support tickets and live chat with an agent", ["mobile", "backend", "admin"],
  "user", "to open a ticket or chat with a Jali agent about a trip",
  "a human helps me when needed",
  ["Ticket linked to ride/hire; status updates by push.",
   "Admin support inbox with assignment, SLA timers and canned replies.",
   "Safety tickets are prioritised."], [])
story("S16.4", "E16", "Fare review and refunds", ["backend", "admin", "payments"],
  "rider", "to request a fare review when I was overcharged",
  "I trust the prices",
  ["Automatic adjustment rules (e.g. route 30% longer than estimate without stop) issue refunds to wallet.",
   "Manual reviews by admin with reason; driver notified of adjustments."], [])

# ── E17 Driver tools ────────────────────────────────────────────────────────
story("S17.1", "E17", "Demand heatmap for drivers", ["mobile", "backend"],
  "driver", "a map showing where ride requests are high right now",
  "I go where riders are and earn more",
  ["Hexagon heatmap of requests in the last 15 min and unserved requests.",
   "Refreshes every minute; no individual rider location is exposed."], [])
story("S17.2", "E17", "Destination filter — going home", ["mobile", "backend"],
  "driver", "to receive only trips heading toward my destination",
  "I can earn on my way home",
  ["Set a destination; only requests ending closer to it are dispatched.",
   "Usage limit per day configurable."], [])
story("S17.3", "E17", "Driver incentives and quests", ["backend", "admin", "mobile"],
  "operations admin", "to create bonus challenges (e.g. 20 trips this weekend = 10,000 RWF)",
  "we can grow supply when and where it's needed",
  ["Admin creates quests by city/zone/period; drivers see progress in the Drive tab.",
   "Bonus credited to ledger automatically on completion."], [])
story("S17.4", "E17", "Driver levels and rewards", ["backend", "mobile", "phase-3"],
  "driver", "levels based on rating, acceptance and trips with perks",
  "being a great driver pays off",
  ["Levels recalculated monthly; perks like lower commission or priority dispatch."], [])
story("S17.5", "E17", "Airport and venue queue", ["backend", "mobile"],
  "driver", "a fair first-in-first-out queue when waiting at the airport",
  "waiting drivers are served in order",
  ["Queue position shown when inside the airport geofence (S10.4); leaving the zone removes me.",
   "Airport requests dispatched in queue order."], [])
story("S17.6", "E17", "Fatigue limit", ["backend", "mobile", "safety"],
  "driver", "to be required to rest after long driving",
  "everyone stays safe",
  ["After 12 h online (configurable) the driver must go offline for 6 h; warnings at 10 h and 11 h."], [])
story("S17.7", "E17", "Document expiry reminders", ["backend", "mobile"],
  "driver", "reminders before my licence or insurance expires",
  "I'm never blocked unexpectedly",
  ["Reminders at 30, 7 and 1 day before expiry; automatic block on expiry until re-upload is approved."], [])
story("S17.8", "E17", "Instant cashout to MoMo", ["backend", "mobile", "payments"],
  "driver", "to withdraw my in-app earnings to MoMo instantly",
  "I get my money when I need it",
  ["Available balance minus commission owed; small configurable fee; daily limit.",
   "Payout status tracked; failures returned to balance."], [])
story("S17.9", "E17", "Next trip before finishing the current one", ["backend", "mobile"],
  "driver", "to receive a nearby next request near the end of my current trip",
  "I spend less time empty",
  ["Only requests whose pickup is close to my drop-off, offered in the last 3 min of the trip."], [])
story("S17.10", "E17", "Driver training and quiz", ["mobile", "backend"],
  "new driver", "short training videos and a quiz before my first trip",
  "I know the rules, safety and app",
  ["Must pass the quiz (≥ 80%) before going online the first time; content managed by admin."], [])

# ── E18 Advanced safety ─────────────────────────────────────────────────────
story("S18.1", "E18", "Driver selfie check before going online", ["mobile", "backend", "safety", "security"],
  "rider", "the driver to be the verified person",
  "nobody else drives with someone's account",
  ["Random selfie check when going online (at least daily); face match against verified selfie via a provider.",
   "Failure blocks going online and alerts admin; manual review path."], [])
story("S18.2", "E18", "Trip anomaly detection", ["backend", "mobile", "safety"],
  "rider", "Jali to check on me if the trip stops unusually long or goes off route",
  "help reaches me if something goes wrong",
  ["Detects stops > 5 min, route deviation > 1 km, unexpected early end.",
   "Both parties get an *Are you OK?* prompt with SOS / Report / I'm fine; no answer escalates to support."], [])
story("S18.3", "E18", "Audio recording during the trip", ["mobile", "backend", "safety", "phase-3"],
  "rider or driver", "to record trip audio, encrypted and only accessible if I report an incident",
  "there is evidence when something happens",
  ["Opt-in per trip or always; stored encrypted; nobody can listen unless attached to a safety report.",
   "Auto-deleted after 7 days if not reported; legal review required."], [])
story("S18.4", "E18", "Trusted contacts auto-share", ["mobile", "backend", "safety"],
  "rider", "to automatically share trips with trusted contacts (e.g. at night)",
  "my family always knows",
  ["Up to 5 trusted contacts; rules: all trips / night trips only.",
   "Uses the share-trip link from S8.1."], [])
story("S18.5", "E18", "Driving behaviour alerts", ["mobile", "backend", "safety"],
  "admin", "to detect speeding and harsh braking during trips",
  "unsafe drivers are coached or removed",
  ["Speed vs road limit (when available) and accelerometer events recorded per trip.",
   "Weekly safety score for drivers; repeated issues flagged."], [])
story("S18.6", "E18", "Rider verification for driver safety", ["backend", "mobile", "safety"],
  "driver", "to know riders are verified, especially for cash rides at night",
  "I feel safe accepting requests",
  ["Verified phone required for all riders; ID verification required for cash rides at night (configurable).",
   "Verified badge shown on request card."], [])
story("S18.7", "E18", "Safety toolkit", ["mobile", "ux", "safety"],
  "rider or driver", "one shield button that opens every safety feature",
  "help is always one tap away",
  ["Contains SOS, share trip, trusted contacts, report incident, safety tips; visible on every trip screen."], [])

# ── E19 Fleets & business ───────────────────────────────────────────────────
story("S19.1", "E19", "Fleet owner portal", ["mobile", "backend", "admin"],
  "fleet owner with several motos or cars", "to add vehicles, assign drivers and see earnings per vehicle",
  "I can run my transport business on Jali",
  ["Fleet owner role; vehicles owned by the fleet; drivers invited and linked.",
   "Earnings split between fleet owner and driver per configurable rule.",
   "Fleet dashboard: online vehicles, trips, earnings, documents expiring."], [])
story("S19.2", "E19", "Jali for Business", ["backend", "admin", "mobile"],
  "company", "a company account where employees ride on company billing with policies",
  "staff transport is easy to manage and invoice",
  ["Company admin invites employees; policies (hours, max fare, vehicle classes).",
   "Monthly invoice; employee rides use business profile (S15.2)."], [])
story("S19.3", "E19", "Hotel and concierge booking", ["backend", "mobile"],
  "hotel receptionist", "to book rides for guests who don't have the app",
  "guests get reliable transport",
  ["Partner dashboard to book for a guest by name and phone; guest gets SMS with driver details.",
   "Billing to partner account or guest pays driver."], [])
story("S19.4", "E19", "Partner API", ["backend", "phase-3"],
  "partner app", "an API to request and track Jali rides",
  "other businesses can integrate Jali",
  ["OAuth client credentials; endpoints for estimate, request, status, cancel; webhooks; sandbox environment."], [])

# ── E20 Jali Send ───────────────────────────────────────────────────────────
story("S20.1", "E20", "Send a package", ["mobile", "backend", "pricing"],
  "sender", "to send a package by moto or car with recipient details",
  "I can deliver things across the city quickly",
  ["Pickup + drop-off, recipient name/phone, size category, notes; driver quotes from their own rates.",
   "Photo at pickup and at delivery; recipient gets a tracking link."], [])
story("S20.2", "E20", "Delivery PIN for recipient", ["mobile", "backend", "security"],
  "sender", "the recipient to give a PIN to the driver",
  "the package reaches the right person",
  ["PIN sent to recipient by SMS; delivery can only be completed with the PIN or a photo + admin override."], [])
story("S20.3", "E20", "Package categories and prohibited items", ["mobile", "backend", "admin"],
  "admin", "to define package sizes and a prohibited items list that senders must accept",
  "deliveries are legal and safe",
  ["Sizes (envelope, small, medium, large) mapped to vehicle classes; prohibited list in 4 languages."], [])

# ── E21 Platform quality ────────────────────────────────────────────────────
story("S21.1", "E21", "Crash reporting and performance monitoring", ["mobile", "backend"],
  "developer", "crashes and slow screens reported automatically with context",
  "we fix problems before users complain",
  ["Sentry (or equivalent) in mobile and backend with release tracking and source maps.",
   "Alerts for new crash types and crash-free rate < 99.5%."], [])
story("S21.2", "E21", "Backend monitoring and alerts", ["backend"],
  "developer", "uptime, error rate, queue and latency monitoring with alerts",
  "outages are detected in minutes",
  ["Health endpoint; uptime monitor; alerts by email/Telegram/WhatsApp.",
   "Dashboards for p95 latency of `/rides/nearby` and accept."], [])
story("S21.3", "E21", "Automated checks on every pull request", ["backend", "mobile"],
  "developer or AI agent", "tests, type checks and lint to run on every PR",
  "parallel work by many agents never breaks main",
  ["GitHub Actions: `php artisan test`, `tsc --noEmit`, lint; required to merge.",
   "PR template with story ID and acceptance-criteria checklist."], [])
story("S21.4", "E21", "Staging environment with simulated drivers", ["backend"],
  "developer or tester", "a staging server with seed data and a script that moves fake drivers around Kigali",
  "every feature can be tested end-to-end without real drivers",
  ["`php artisan sim:drivers --count=50` moves drivers along real roads and auto-accepts requests (configurable).",
   "Staging app build points to staging API."], [])
story("S21.5", "E21", "Load testing", ["backend"],
  "developer", "repeatable load tests for nearby search, presence and dispatch",
  "we know our limits before launch",
  ["k6 scripts for 2,000 online drivers sending presence every 5 s and 200 requests/min; results documented."], [])
story("S21.6", "E21", "Fraud prevention", ["backend", "mobile", "security"],
  "admin", "detection of fake GPS, multiple accounts and promo abuse",
  "Jali doesn't lose money to fraud",
  ["Mock-location detection on Android; impossible-speed checks server-side.",
   "Device fingerprint limits accounts per device; suspicious patterns flagged for review."], [])
story("S21.7", "E21", "Rate limiting and abuse protection", ["backend", "security"],
  "developer", "rate limits on auth, OTP, nearby and request endpoints",
  "the API can't be abused or scraped",
  ["Per-IP and per-user limits with `429` responses; OTP limited to 5/hour per phone."], [])
story("S21.8", "E21", "Data protection compliance", ["backend", "security"],
  "Jali as a company", "to comply with Rwanda's personal data protection law",
  "we operate legally with location and ID data",
  ["Verify requirements of the current law (believed to be Law No. 058/2021) and registration with the regulator.",
   "Consent screens, privacy policy update, retention rules (e.g. location breadcrumbs 90 days), processing register."], ["Needs legal advice; acceptance criteria to refine after review."])
story("S21.9", "E21", "API contract (OpenAPI) as source of truth", ["backend", "mobile"],
  "developer or AI agent", "an OpenAPI spec for every ride/hire endpoint with generated TypeScript types",
  "agents build mobile and backend in parallel, and the backend can later be rewritten (e.g. in Rust) without breaking the app",
  ["`docs/api/openapi.yaml` covers all new endpoints; CI fails if implementation and spec diverge (contract tests).",
   "Mobile uses generated types for requests/responses."], [])
story("S21.10", "E21", "Feature flags and remote config", ["backend", "mobile"],
  "superadmin", "to turn features on per city, user group or percentage",
  "we can release safely and test with a few users first",
  ["Flags evaluated server-side and delivered with `/me`; mobile hides disabled features."], [])
story("S21.11", "E21", "Backups and disaster recovery", ["backend"],
  "Jali as a company", "automatic database and file backups with a tested restore",
  "we never lose rides, money or documents",
  ["Daily encrypted off-site backups; quarterly restore drill documented."], [])
story("S21.12", "E21", "Performance on low-end Android", ["mobile"],
  "rider with a cheap phone", "the app to start fast and stay smooth",
  "Jali works for everyone in Rwanda",
  ["Cold start < 3 s on a 2 GB RAM device; ride screens at 60 fps with map; app size budget documented."], [])

# ── E22 Growth ──────────────────────────────────────────────────────────────
story("S22.1", "E22", "Deep links and sharing", ["mobile", "backend"],
  "user", "links that open a promo, driver profile or trip directly in the app",
  "sharing Jali is effortless",
  ["Universal links / app links; fallback to store page if not installed."], [])
story("S22.2", "E22", "Segmented push campaigns", ["admin", "backend"],
  "marketing admin", "to send push campaigns to segments (new users, inactive 30 days, city)",
  "we re-engage users",
  ["Respects notification preferences (S15.4); schedule and track opens."], [])
story("S22.3", "E22", "In-app store rating prompt", ["mobile"],
  "product owner", "happy riders to be asked to rate Jali on the store",
  "store ratings grow",
  ["Native review prompt after a 5-star trip, max once per 90 days."], [])
story("S22.4", "E22", "Web booking page", ["backend", "phase-3"],
  "visitor before installing", "to request a ride from a web page",
  "I can ride even before downloading the app",
  ["Mobile web flow: phone verification, destination, nearby drivers, request, tracking."], [])

DEPS.update({
  # MVP
  "S0.2": ["S0.1"], "S1.1": ["S0.1", "S0.3"], "S1.2": ["S1.1"], "S1.3": ["S0.1"], "S1.4": ["S1.2", "S0.4"],
  "S2.1": ["S1.3", "S2.2"], "S2.2": ["S0.3"], "S2.3": ["S2.1"],
  "S3.2": ["S2.3", "S5.1"], "S3.3": ["S3.2"], "S3.4": ["S3.2", "S0.4"], "S3.5": ["S3.4"], "S3.6": ["S3.2"],
  "S4.1": ["S3.4", "S5.2"], "S4.2": ["S4.1"], "S4.3": ["S3.4"], "S4.4": ["S4.2"], "S4.5": ["S4.4"], "S4.6": ["S4.4"],
  "S5.1": ["S1.4", "S2.1"], "S5.2": ["S5.1", "S3.4"], "S5.3": ["S5.2"], "S5.4": ["S7.2"],
  "S6.1": ["S1.4"], "S6.2": ["S6.1"], "S6.3": ["S6.2"], "S6.4": ["S6.3"],
  "S7.1": ["S4.4"], "S7.2": ["S4.4"], "S7.3": ["S7.1"],
  "S8.1": ["S4.1"], "S8.2": ["S4.1"], "S8.3": ["S3.4"], "S8.4": ["S4.5"],
  "S9.1": ["S3.1"], "S9.4": ["S3.6"], "S9.5": ["S4.1"], "S9.6": ["S4.4"], "S9.7": ["S13.1", "S11.4"],
  "S10.1": ["S5.1"], "S10.2": ["S8.3"], "S10.3": ["S4.4"], "S10.4": ["S0.3"],
  # Level 2/3
  "S11.1": ["S2.3"], "S11.2": ["S3.3", "S11.1"], "S11.3": ["S3.3", "S12.1"], "S11.4": ["S3.1", "S10.4"],
  "S11.5": ["S3.1"], "S11.6": ["S4.1"], "S11.7": ["S11.1", "S4.1"],
  "S12.1": ["S4.1"], "S12.2": ["S4.1"], "S12.3": ["S0.4"],
  "S13.1": ["S3.4"], "S13.2": ["S3.4"], "S13.3": ["S2.3", "S3.4"], "S13.4": ["S4.4"], "S13.5": ["S3.2"],
  "S13.6": ["S3.2", "S1.2"], "S13.7": ["S6.1", "S3.4"], "S13.8": ["S3.4", "S11.1"], "S13.9": ["S1.3", "S3.2"], "S13.10": ["S3.5"],
  "S14.1": ["S3.5"], "S14.2": ["S2.3", "S7.2"], "S14.3": ["S14.2"], "S14.4": ["S14.6"], "S14.5": ["S14.6"],
  "S14.6": ["S7.3"], "S14.7": ["S14.6"], "S14.8": ["S14.6"],
  "S15.1": ["S4.5"], "S15.2": ["S9.6"], "S15.3": ["S14.6"], "S15.4": ["S0.4"], "S15.5": ["S16.1"], "S15.8": ["S3.1"],
  "S16.1": ["S4.1"], "S16.3": ["S16.2"], "S16.4": ["S14.6", "S10.2"],
  "S17.1": ["S3.4"], "S17.2": ["S5.2"], "S17.3": ["S7.2"], "S17.4": ["S17.3"], "S17.5": ["S10.4", "S5.2"],
  "S17.6": ["S5.1"], "S17.7": ["S1.2"], "S17.8": ["S7.2", "S7.3"], "S17.9": ["S5.2"], "S17.10": ["S1.4"],
  "S18.1": ["S1.2", "S5.1"], "S18.2": ["S4.2", "S11.1"], "S18.3": ["S4.2"], "S18.4": ["S8.1"], "S18.5": ["S4.2"],
  "S18.6": ["S5.2"], "S18.7": ["S8.1", "S8.2"],
  "S19.1": ["S1.3", "S7.2"], "S19.2": ["S15.2"], "S19.3": ["S13.2"], "S19.4": ["S21.9"],
  "S20.1": ["S3.4"], "S20.2": ["S20.1"], "S20.3": ["S20.1"],
  "S21.4": ["S5.1"], "S21.5": ["S3.2"], "S21.6": ["S5.1"], "S21.10": ["S0.3"],
  "S22.1": ["S14.2"], "S22.2": ["S15.4"], "S22.3": ["S4.5"], "S22.4": ["S3.4", "S21.9"],
})

SRC.update({
  "S3.2": "inDrive (driver offers)", "S3.3": "Uber, DiDi, Bolt", "S3.5": "inDrive", "S3.6": "Uber, Bolt",
  "S4.2": "Uber (PIN verification)", "S6.3": "Chauffeur services", "S8.1": "Uber, Bolt", "S8.2": "Uber, Bolt, DiDi",
  "S9.5": "Uber (translated messages)", "S9.7": "Uber Reserve",
  "S11.3": "Uber", "S11.4": "Uber, Bolt", "S11.7": "Uber",
  "S13.1": "Uber Reserve, Bolt", "S13.2": "Uber", "S13.3": "Uber, Bolt", "S13.4": "Uber", "S13.5": "Uber Comfort",
  "S13.6": "DiDi Mujer, Bolt (some markets)", "S13.7": "Uber Hourly", "S13.8": "inDrive Intercity",
  "S13.9": "Careem (child seat), Uber Pet, Uber WAV", "S13.10": "Uber Wait & Save, Lyft Priority Pickup",
  "S14.1": "inDrive", "S14.2": "all", "S14.3": "all", "S14.4": "Uber", "S14.5": "Uber", "S14.6": "GrabPay, Careem Pay",
  "S14.7": "Uber One, Careem Plus", "S14.8": "DiDi Rewards, GrabRewards",
  "S15.2": "Uber business profile", "S15.3": "Uber Family", "S15.5": "Uber",
  "S16.1": "Uber, Bolt", "S16.2": "Uber",
  "S17.1": "Uber, Bolt", "S17.2": "Uber", "S17.3": "Uber Quests", "S17.4": "Uber Pro", "S17.5": "Uber airport queue",
  "S17.6": "Uber", "S17.9": "Uber",
  "S18.1": "Uber Real-Time ID Check", "S18.2": "Uber RideCheck", "S18.3": "DiDi, Uber", "S18.5": "Uber", "S18.7": "Uber Safety Toolkit",
  "S19.1": "Bolt Fleet", "S19.2": "Uber for Business", "S19.3": "Uber Central", "S19.4": "Uber API",
  "S20.1": "Uber Connect, Bolt Send, inDrive Courier",
})
