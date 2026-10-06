# JALI: On-Demand Rides & Hire-a-Driver — Architecture Plan

> **Status:** Draft — for review before implementation
> **Date:** 2026-10-05
> **Scope:** Backend (Laravel 11) + Mobile (Expo) + Admin portal

---

## 1. What We Want (Product Summary)

Jali today books **scheduled** transport (buses, intercity private seats, car rentals).
This plan adds **on-demand** transport, inspired by Uber / DiDi / Yego, with one key difference:

| | Yego / Uber | **Jali** |
|---|---|---|
| Who sets the price per km? | The platform (fixed tariff) | **Each driver sets their own rates** |
| What the rider sees | One price | **A list/map of nearby drivers, each with their own price** — pick cheapest, closest, best-rated, or nicest car |
| Who can drive? | Registered taxi/moto drivers | Taxi/moto drivers **and private car owners** |
| Need a driver for *your own* car? | Not offered | **Hire-a-Driver** (hourly / daily / per trip) |

Three new products:

1. **Jali Ride** — request a ride now from a nearby driver, priced by the driver's own per-km rates.
2. **Nearby** — see drivers around you (map + list) with their custom price for *your* trip, DiDi-style.
3. **Hire a Driver** — find a verified private driver to drive *your* car (wedding, airport, long trip, night out, business day).

---

## 2. Audit — What Exists Today

| Area | Current state | Reuse? |
|---|---|---|
| Driver role | `driver` role, permission `create-private-seats` | ✅ extend with new permissions |
| Driver mode (mobile) | `lib/DriverModeContext.tsx` — **in-memory only**, resets on restart; `driverType: "private" \| "rental"` | ⚠️ must persist + add `"ride"` / `"hire"` |
| Private seats | Scheduled intercity carpool, driver sets a **fixed seat price** per listing | ✅ keep as-is (different product) |
| Car rentals | Self-drive, **daily price** + caution | ✅ keep; later offer "rental + driver" combo |
| **Hire-a-driver / chauffeur** | **Does not exist** — no table, route, or screen | 🆕 new |
| Per-km pricing | **Does not exist** (`price` is flat everywhere) | 🆕 new |
| Driver live location | **Does not exist** | 🆕 new |
| Geo helpers | `haversineDistance()` in `mobile/lib/serviceFee.ts`; lat/lng on `locations`, `admin_stations`, `app_accesses` | ✅ port haversine to PHP |
| Push | FCM via `fcm_token` on users (`TicketController::sendPush`) | ✅ reuse for ride requests |
| Payouts | `cashout_requests` table + `users.cashout_*` fields | ✅ reuse for driver earnings |
| Config/fees | `PAYMENT_SYSTEM_PLAN.md` → `payment_settings` JSON | ✅ add `rides` section there |
| Maps | No map library installed (`expo-location` only) | 🆕 `react-native-maps` (phase 2) |
| Realtime | None (no Reverb/Pusher/WebSockets) | Polling first, Reverb later |

### 🐞 Bug found during audit (fix first)

`mobile/app/driver/setup.tsx` sends `car_model, plate, seats, car_type, price_day, caution,
insurance_expiry, allowed_zones, docs_url, amenities` to `PATCH /driver/profile`, but
`DriverController::updateProfile` only validates `name` and `fcm_token` — **everything else
is silently discarded**. Drivers think their setup is saved; it isn't. The new
`driver_profiles` + `vehicles` tables below are where this data belongs.

---

## 3. Pricing Model — Driver-Set Rates

### 3.1 What a driver configures (per service, per vehicle)

```
base_fare        RWF   flat amount when trip starts           e.g. 500
per_km           RWF   price per km of the trip               e.g. 400
per_min          RWF   optional, waiting/traffic time         e.g. 0
min_fare         RWF   minimum charge                          e.g. 1500
pickup_free_km   km    distance to rider they'll cover free    e.g. 2
pickup_per_km    RWF   charge per km beyond pickup_free_km     e.g. 200
night_multiplier x     optional 22:00–05:00                    e.g. 1.2
```

For **Hire-a-Driver** the driver sets instead:

```
hourly_rate      RWF/hour  (min_hours e.g. 2)
daily_rate       RWF/day   (up to N hours, overtime_per_hour)
out_of_town_fee  RWF/day   (meals/lodging when trip leaves Kigali)
```

### 3.2 Quote formula (computed server-side, never trust the client)

```
trip_km   = route distance (phase 1: haversine × 1.3 road factor; phase 2: OSRM/Google)
pickup_km = distance driver → rider
quote = max(min_fare,
            base_fare
          + per_km × trip_km
          + per_min × est_minutes
          + max(0, pickup_km − pickup_free_km) × pickup_per_km)
quote = quote × (night_multiplier if night)
quote = round_up_to_100(quote)
rider_total = quote + jali_service_fee
```

### 3.3 Platform guardrails (superadmin-configurable)

Free pricing must not become price gouging, and regulators (RURA) set rules for
taxi-moto/cab fares — **verify the current regulations before launch**. Guardrails live in
`payment_settings.config.rides`:

```json
"rides": {
  "vehicle_classes": {
    "moto":    { "per_km_min": 150, "per_km_max": 600,  "min_fare_max": 1500 },
    "car":     { "per_km_min": 300, "per_km_max": 1200, "min_fare_max": 5000 },
    "comfort": { "per_km_min": 500, "per_km_max": 2000, "min_fare_max": 8000 }
  },
  "road_factor": 1.3,
  "commission_pct": 8,
  "service_fee": { "type": "flat", "amount": 200 },
  "nearby_radius_km": 5,
  "presence_ttl_sec": 60,
  "request_timeout_sec": 30
}
```

Rates outside the allowed band are rejected on save (`422`) with a clear message.

### 3.4 Price lock

The quote is **snapshotted** into the ride (`rate_snapshot` JSON + `quoted_fare`) at request
time. Final fare = quoted fare, unless the rider changes destination mid-trip (re-quote) or
actual distance exceeds estimate by > 20% (driver may submit adjustment; rider confirms).

---

## 4. "See People Near You" — Nearby Discovery

### 4.1 Rider view (main feature)

`GET /rides/nearby?lat=&lng=&dest_lat=&dest_lng=&class=car`

Returns online, verified drivers within `nearby_radius_km`, each with **their quote for this
exact trip**:

```json
[
  { "driver_id": 12, "name": "Jean P.", "photo": "...", "rating": 4.8, "trips": 312,
    "vehicle": { "class": "car", "model": "Toyota RAV4", "color": "White", "seats": 4, "amenities": ["AC"] },
    "eta_min": 4, "distance_km": 1.1,
    "approx_location": { "lat": -1.9441, "lng": 30.0619 },
    "quote": 3400, "per_km": 400 }
]
```

Mobile shows sort chips: **Cheapest · Closest · Top rated**, plus a map (phase 2).

### 4.2 Driver view

Online drivers see **open ride requests nearby** (broadcast mode, §5.2) — pickup area,
destination, distance, and what they would earn at their own rates.

### 4.3 Privacy rules

- Driver positions shown to riders are **rounded to ~100 m** until a ride is accepted.
- Rider exact pickup is shown to a driver **only after accept**; before that, neighbourhood only.
- Presence older than `presence_ttl_sec` → driver treated as offline.
- Never expose phone numbers in nearby lists; use in-app call/masked number later.

### 4.4 Geo query (scales from SQLite → MySQL → Redis)

Phase 1 (works on SQLite/MySQL as-is): bounding-box prefilter on indexed `lat`/`lng`, then
exact haversine in PHP.

```php
$dLat = $radiusKm / 111.0;
$dLng = $radiusKm / (111.0 * cos(deg2rad($lat)));
DriverPresence::query()
    ->where('is_online', true)
    ->where('last_seen_at', '>=', now()->subSeconds($ttl))
    ->whereBetween('lat', [$lat - $dLat, $lat + $dLat])
    ->whereBetween('lng', [$lng - $dLng, $lng + $dLng])
    ->with('driver.driverProfile', 'vehicle', 'rates')
    ->limit(50)->get()
    ->map(fn ($p) => [...quote + haversine...])
    ->filter(fn ($p) => $p['distance_km'] <= $radiusKm);
```

Phase 3 (high volume): Redis `GEOADD drivers:online` / `GEOSEARCH`, presence in Redis only.

---

## 5. Ride Flows

### 5.1 Mode A — "Pick your driver" (default, DiDi-style)

```
Rider enters destination
   → GET /rides/nearby  (list of drivers + their quotes)
   → Rider taps a driver → POST /rides { driver_id, pickup, dropoff, class }
   → FCM push to that driver; driver sees request card (30 s countdown)
   → Driver accepts → POST /rides/{id}/accept
        ↳ else timeout/decline → rider is offered the next best driver (one tap)
```

### 5.2 Mode B — "Send to all nearby" (fastest pickup)

```
Rider sets max price (optional) → POST /rides { mode: "broadcast", max_fare? }
   → Server picks up to N nearest online drivers whose quote ≤ max_fare
   → FCM push to all; first to accept wins
```

**Race safety:** accept is an atomic conditional update:

```php
$won = Ride::whereKey($id)->where('status', 'requested')
        ->update(['status' => 'accepted', 'driver_id' => $driver->id, 'accepted_at' => now()]);
if (!$won) return response()->json(['message' => 'Ride already taken'], 409);
```

### 5.3 Mode C — Counter-offer (phase 3, inDrive-style, optional)

Driver can answer a broadcast with a different price; rider picks among offers
(`ride_offers` table). Only if Mode A/B prove insufficient.

### 5.4 Ride state machine

```
requested ──accept──▶ accepted ──arrive──▶ arrived ──start(PIN)──▶ in_progress ──complete──▶ completed ──▶ rated
    │                    │                    │
    ├─ timeout ─▶ expired│                    │
    └─ cancel ──▶ cancelled_by_rider ◀────────┤   (cancel fee if after `arrived` + 5 min)
                  cancelled_by_driver ◀───────┘
```

- **Start PIN:** rider shows a 4-digit PIN, driver types it to start → proves the right person is in the car.
- Every transition is a dedicated endpoint, validated against the current state (no generic `PATCH status`).
- Each transition writes a `ride_events` row (audit trail for disputes).

---

## 6. Hire-a-Driver Flow

Different from rides: the **customer owns the car**, the driver provides the service.

```
Customer: "Hire a Driver" → date/time, duration (hours | days), pickup, trip type
          (city / out-of-town / airport), car details (transmission! manual/automatic)
   → GET /driver-hire/available?start_at=&hours=&transmission=automatic
       (list: driver, rating, years experience, languages, licence categories, hourly/daily rate, total quote)
   → POST /driver-hire { driver_id, ... }  → status: requested
   → Driver accepts/declines (push) → accepted
   → On day: driver checks in (started) → checks out (completed) → overtime auto-calculated
   → Rating both ways
```

Driver availability: weekly schedule + blocked dates (`driver_availability`). Overlapping
accepted hires are rejected server-side.

Driver profile shows: licence categories (B, C, D…), **can drive manual/automatic**,
years of experience, languages (Kinyarwanda / English / French / Swahili), background-check badge.

---

## 7. Data Model

```
driver_profiles            (one per driver user)
  id, user_id (unique FK), services JSON ["ride","hire","private_seat","rental"],
  national_id_no, licence_no, licence_categories JSON, licence_expiry,
  licence_photo_url, id_photo_url, selfie_url,
  transmissions JSON ["automatic","manual"], languages JSON, years_experience,
  verification_status (pending|verified|rejected|suspended), verified_by, verified_at, rejection_reason,
  rating_avg decimal(2,1), rating_count, trips_count, timestamps

vehicles                   (replaces the data setup.tsx currently loses)
  id, user_id FK, class (moto|car|comfort|van), make, model, color, year, plate (unique),
  seats, amenities JSON, photos JSON, insurance_expiry, inspection_doc_url,
  is_active, verified_at, timestamps

driver_rates
  id, user_id FK, vehicle_id FK nullable, service (ride|hire),
  base_fare, per_km, per_min, min_fare, pickup_free_km, pickup_per_km, night_multiplier,
  hourly_rate, min_hours, daily_rate, daily_hours, overtime_per_hour, out_of_town_fee,
  is_active, timestamps
  UNIQUE(user_id, vehicle_id, service)

driver_presence            (hot table, 1 row per driver, upserted every ~5–10 s while online)
  user_id PK, vehicle_id, is_online, lat decimal(10,7), lng decimal(10,7), heading, speed,
  last_seen_at, current_ride_id nullable
  INDEX(is_online, last_seen_at), INDEX(lat), INDEX(lng)

rides
  id, rider_id FK, driver_id FK nullable, vehicle_id nullable, mode (pick|broadcast),
  vehicle_class, status, pickup_lat, pickup_lng, pickup_address,
  dropoff_lat, dropoff_lng, dropoff_address, est_distance_km, est_minutes,
  rate_snapshot JSON, quoted_fare, final_fare, service_fee, commission,
  max_fare nullable, start_pin, payment_method (cash|momo), paid_at,
  cancel_reason, cancelled_by, requested_at, accepted_at, arrived_at,
  started_at, completed_at, cancelled_at, timestamps
  INDEX(status), INDEX(rider_id, created_at), INDEX(driver_id, created_at)

ride_dispatches            (who was offered the ride — for broadcast + "next driver")
  id, ride_id, driver_id, quote, status (sent|seen|declined|expired|won), sent_at, responded_at

ride_events                (append-only audit trail)
  id, ride_id, actor_id, type, payload JSON, created_at

ride_locations             (optional breadcrumbs during in_progress, pruned after 30 days)
  id, ride_id, lat, lng, recorded_at

driver_hires
  id, customer_id, driver_id, start_at, end_at, duration_type (hours|days), duration_value,
  pickup_lat, pickup_lng, pickup_address, trip_type (city|out_of_town|airport),
  car_description, transmission, rate_snapshot JSON, quoted_total, final_total,
  overtime_minutes, service_fee, commission, status
  (requested|accepted|declined|started|completed|cancelled|expired),
  payment_method, paid_at, checked_in_at, checked_out_at, timestamps

driver_availability
  id, user_id, weekday (0–6) nullable, date nullable, start_time, end_time, is_blocked

ratings                    (polymorphic: rides + hires; replaces need for separate tables)
  id, rateable_type, rateable_id, from_user_id, to_user_id, stars (1–5), tags JSON, comment, created_at
  UNIQUE(rateable_type, rateable_id, from_user_id)

driver_ledger              (commission owed / earnings, feeds existing cashout_requests)
  id, user_id, source_type, source_id, type (earning|commission|payout|adjustment), amount, balance_after, created_at
```

**Note on `cashout_requests`:** its FK column is `admin_id`; either rename to `user_id`
(migration) or add a nullable `user_id` so drivers can request payouts too.

---

## 8. API (all inside `auth:sanctum`, per context.md guard rules)

### New permissions (add to `RolesAndPermissionsSeeder` + a migration like `add_manage_locations_permission`)

| Permission | superadmin | admin | driver | user |
|---|---|---|---|---|
| `request-rides` | ✅ | ✅ | ✅ | ✅ |
| `offer-rides` | ✅ | | ✅ | |
| `offer-driver-hire` | ✅ | | ✅ | |
| `verify-drivers` | ✅ | ✅ | | |
| `manage-rides` | ✅ | ✅ | | |
| `manage-ride-pricing` | ✅ | | | |

> A regular user who becomes a driver gets the `driver` role **after** verification — until
> then they can fill the profile but cannot go online (controller check `driverProfile->isVerified()`).
> Drivers keep `request-rides` so they can also ride.

### Rider — `permission:request-rides`

```
GET    /rides/nearby                     nearby drivers + per-driver quote
POST   /rides/estimate                   price range for a trip (min/median/max of nearby quotes)
POST   /rides                            create request (mode pick|broadcast)
GET    /rides                            my ride history
GET    /rides/active                     current ride (or null) — polled during a trip
GET    /rides/{id}                       detail incl. driver live location when accepted+
POST   /rides/{id}/cancel
POST   /rides/{id}/rate
POST   /rides/{id}/next-driver           re-send to next best driver after decline/timeout

GET    /driver-hire/available            drivers available for a time window
POST   /driver-hire                      request a hire
GET    /driver-hire                      my hires
GET    /driver-hire/{id}
POST   /driver-hire/{id}/cancel
POST   /driver-hire/{id}/rate

GET    /drivers/{id}                     public driver card (rating, vehicle, rates, reviews)
```

### Driver onboarding — any auth user (become a driver)

```
GET    /driver/profile                   driver_profile + vehicles + verification status
PUT    /driver/profile                   personal/licence data (fixes the setup.tsx bug)
POST   /driver/documents                 upload licence / ID / selfie / insurance
GET    /driver/vehicles   POST /driver/vehicles   PATCH /driver/vehicles/{id}   DELETE ...
```

### Driver — `permission:offer-rides`

```
GET    /driver/rates      PUT /driver/rates          my per-km rates (validated vs guardrails)
POST   /driver/presence                  { online, lat, lng, heading, vehicle_id } — heartbeat
GET    /driver/ride-requests             open requests near me (broadcast + direct)
POST   /rides/{id}/accept                atomic, 409 if taken
POST   /rides/{id}/decline
POST   /rides/{id}/arrive
POST   /rides/{id}/start                 { pin }
POST   /rides/{id}/complete              { payment_method }
POST   /rides/{id}/driver-cancel
POST   /rides/{id}/rate-rider
GET    /driver/earnings                  ledger summary (today/week/month), commission owed
```

### Driver — `permission:offer-driver-hire`

```
GET/PUT  /driver/hire-settings           hourly/daily rates, transmissions, languages
GET/PUT  /driver/availability
GET      /driver/hires                   incoming + upcoming
POST     /driver-hire/{id}/accept | decline | check-in | check-out
```

### Admin

```
permission:verify-drivers
  GET   /admin/drivers?status=pending
  GET   /admin/drivers/{id}
  POST  /admin/drivers/{id}/verify   POST /admin/drivers/{id}/reject   POST /admin/drivers/{id}/suspend

permission:manage-rides
  GET   /admin/rides?status=&from=&to=      GET /admin/rides/{id} (with ride_events timeline)
  GET   /admin/rides/live                   online drivers + active rides (map)
  GET   /admin/driver-hires

permission:manage-ride-pricing
  GET/PUT /admin/settings/rides             guardrails, commission, radius, timeouts
```

Controllers (defense-in-depth): every ride action also checks ownership —
rider actions require `$ride->rider_id === $user->id`, driver actions require
`$ride->driver_id === $user->id` (or a pending `ride_dispatches` row for accept).

### Backend file layout

```
app/Models/        DriverProfile, Vehicle, DriverRate, DriverPresence, Ride, RideDispatch,
                   RideEvent, DriverHire, DriverAvailability, Rating, DriverLedgerEntry
app/Services/      GeoService (haversine, bbox, road factor)
                   FareService (quote from rates + guardrails, snapshot)
                   RideDispatchService (nearby search, send, expire, next driver)
                   PushService (extract FCM code from TicketController for reuse)
app/Http/Controllers/
                   RideController, DriverRideController, DriverPresenceController,
                   DriverOnboardingController, DriverRateController,
                   DriverHireController, DriverHireDriverController
                   Admin/AdminDriverController, Admin/AdminRideController
app/Console/       ExpireRideRequests (scheduler every minute: requested > timeout → expired,
                   stale presence → offline)
```

---

## 9. Realtime Strategy (cheap first, upgrade later)

| Phase | Mechanism | Why |
|---|---|---|
| 1 | **FCM push** for new request / accepted / arrived / cancelled + **TanStack Query polling** (`refetchInterval` 3–5 s) on `/rides/active` and `/driver/ride-requests` only while a ride is live; driver sends presence every 5–10 s while online | Zero new infra; fits the Hetzner VPS budget |
| 2 | **Laravel Reverb** (first-party WebSockets) + `laravel-echo` on mobile; private channels `ride.{id}`, `driver.{id}` | Smoother tracking, less battery/data than polling |
| 3 | Redis GEO for presence; queue workers for dispatch | High volume |

Driver background location: `expo-location` + `expo-task-manager`
(`startLocationUpdatesAsync`) while **online**, with the required foreground-service
notification on Android and the background-location justification in store listings
(see `store_requirements.md`). Stop updates immediately when the driver goes offline.

---

## 10. Mobile Architecture

### New routes

```
app/
├── (tabs)/
│   └── index.tsx              + "Ride now" and "Hire a driver" entry tiles on Home
├── ride/
│   ├── _layout.tsx            <ProtectedRoute> wrapper
│   ├── index.tsx              where to? (pickup = GPS, destination search / pin)
│   ├── nearby.tsx             nearby drivers list (+ map in phase 2), sort chips, per-driver quote
│   ├── [id].tsx               active ride: status, driver card, PIN, ETA, call, cancel, share
│   └── rate/[id].tsx
├── hire/
│   ├── _layout.tsx            <ProtectedRoute>
│   ├── index.tsx              when / how long / car transmission / pickup
│   ├── drivers.tsx            available drivers + total quote
│   └── [id].tsx               hire detail / status
├── driver/                    (existing, already protected)
│   ├── setup.tsx              → save to /driver/profile + /driver/vehicles (fix)
│   ├── documents.tsx          🆕 licence / ID / selfie upload + verification status
│   ├── rates.tsx              🆕 my per-km rates with live "example 5 km trip = X RWF" preview
│   ├── hire-settings.tsx      🆕 hourly/daily rates, availability calendar
│   └── ride/[id].tsx          🆕 active ride (driver side): navigate, arrive, PIN, complete
└── (admin)/
    ├── drivers/index.tsx      🆕 verification queue
    ├── drivers/[id].tsx       🆕 documents viewer, verify/reject/suspend
    ├── rides/index.tsx        🆕 rides list + filters
    └── settings/rides.tsx     🆕 pricing guardrails (superadmin)
```

### Drive tab changes (`(tabs)/drive.tsx`)

- **Online / Offline** big toggle (only when verified + rates set + active vehicle).
- When online: incoming request cards (pickup area, destination, km, **"You earn X RWF"**, countdown, Accept/Decline).
- Service switcher: Rides · Hire · Private seats · Rentals (driver may offer several).
- `DriverModeContext` → persist `driverMode` and services in AsyncStorage and hydrate from `GET /driver/profile`.

### Hooks / libs

```
lib/useRideNearby.ts       TanStack query, keyed by rounded pickup/dest coords
lib/useActiveRide.ts       polling while status ∈ {requested, accepted, arrived, in_progress}
lib/useDriverPresence.ts   start/stop background location + heartbeat
lib/fare.ts                client-side preview only (server is source of truth)
lib/queryKeys.ts           + rides.*, driverHire.*, driver.*
```

All calls via `lib/api.ts`; colors via `C.xxx`; add strings to `locales/{en,fr,rw,sw}.json`.

### Maps

Phase 1 ships **list-first** (no map key needed) with "Open in Google Maps" deep link for
drivers' navigation. Phase 2 adds `react-native-maps` (requires Google Maps API key in
`app.json` → `android.config.googleMaps.apiKey` and an EAS rebuild) and place search
(Google Places, or Nominatim/Photon to stay free — the backend already calls Nominatim
in `AppAccessController`).

---

## 11. Payments & Commission

- **Phase 1:** rider pays driver directly (cash or MoMo to driver's number). Driver marks
  payment method on complete. Jali commission (`commission_pct` of fare) is recorded as
  **owed** in `driver_ledger`; driver settles weekly via MoMo; drivers with balance owed above
  a threshold are blocked from going online until settled.
- **Phase 2:** in-app MoMo collection (per `PAYMENT_POSSIBILITES.md` / `PAYMENT_SYSTEM_PLAN.md`)
  → Jali holds funds → driver earnings paid out via existing `cashout_requests` flow.
- Service fee and commission values come from `payment_settings` — nothing hardcoded.

---

## 12. Safety & Trust

| Feature | Phase |
|---|---|
| Driver verification (licence, national ID, selfie, vehicle insurance) — admin approves | 1 |
| Start PIN (right rider, right car) | 1 |
| Two-way ratings; drivers below 4.0 after 20 trips flagged for review | 1 |
| Share trip link (status + driver + plate) via WhatsApp/SMS | 2 |
| SOS button → calls 112 + notifies emergency contact + flags ride in admin | 2 |
| Masked phone calls | 3 |
| Ride audit timeline (`ride_events`) for disputes | 1 |

---

## 13. Delivery Phases

> The complete backlog (all services, grouped by release track with build status) is in `docs/ride-hailing/USER_STORIES.md` — it supersedes the checklists below.

### Phase 0 — Foundations (fix + prep)
- [ ] `driver_profiles`, `vehicles` tables; fix `PUT /driver/profile` so setup.tsx data is saved
- [ ] Persist `DriverModeContext` (AsyncStorage + hydrate from server)
- [ ] Extract FCM sending into `PushService`
- [ ] New permissions + seeder + migration

### Phase 1 — Jali Ride MVP (list-first, polling)
- [ ] Driver documents + admin verification queue
- [ ] Driver rates screen + guardrail validation (`FareService`)
- [ ] Presence heartbeat + online toggle
- [ ] `GET /rides/nearby` with per-driver quotes; rider nearby list (Cheapest/Closest/Top rated)
- [ ] Ride request (pick mode) → push → accept (atomic) → arrive → PIN start → complete
- [ ] Cancel + timeout scheduler + "next driver"
- [ ] Ratings, ride history (merge into Trips tab), driver earnings + commission ledger
- [ ] Admin rides list + ride settings
- [ ] Feature tests: quote math, guardrails, accept race (two drivers), state-transition guards, ownership checks

### Phase 2 — Hire-a-Driver + Map
- [ ] Hire settings, availability, search, request/accept/check-in/out, overtime
- [ ] `react-native-maps` nearby map + live driver marker
- [ ] Broadcast mode with `max_fare`
- [ ] Share trip, SOS
- [ ] Laravel Reverb for live tracking

### Phase 3 — Scale & growth
- [ ] Counter-offers, scheduled rides, promo codes, in-app MoMo, Redis GEO, surge-free "busy area" hints for drivers

---

## 14. Open Questions for Sebastien

1. **Vehicle classes:** launch with Moto + Car only, or also Comfort/Van?
2. **Commission:** % of fare (suggested 5–10%) or flat fee per ride? Charged to driver, rider, or split?
3. **Who can be a ride driver:** any verified private car owner, or only licensed taxi/moto operators (regulatory)?
4. **Hire-a-Driver insurance:** who is liable if the hired driver damages the customer's car? (Needs a terms clause in `legal/`.)
5. **Cities:** Kigali only at launch, or also Musanze/Rubavu/Huye?

---

## 15. International Experience — "Feels Like Uber/DiDi"

Visitors (tourists, business travellers, NGO staff) must be able to use Jali on arrival
without learning anything new. Backlog: epic **E9** in `docs/ride-hailing/USER_STORIES.md`.

- Familiar flow: *Where to?* → class cards with price & ETA → driver list/map → driver card with plate → receipt & rating.
- Device language by default (EN/FR/RW/SW), any country code for phone login, email/Google/**Apple** sign-in.
- Approximate home-currency price next to RWF; international cards in phase 2.
- Quick chat phrases shown in each side's language; email/PDF receipts; airport pickup with flight number.
