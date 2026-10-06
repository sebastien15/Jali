# Jali — Project Context

> AI quick-reference. Read this before exploring any file. Last updated: 2026-04-11.

---

## What Is Jali

A Rwandan transport booking app. Users browse and book buses, private cars, and car rentals. Drivers can list their own seats/cars. Admins manage bookings, stations, locations, and users through a separate admin portal inside the same mobile app.

---

## Release, Architecture & Shared UX Direction

Read [docs/RELEASE_PLAN.md](docs/RELEASE_PLAN.md) before public-service scope, release-order, platform-pricing, module-boundary or shared account/navigation/mode work. The agreed early sequence remains rental → scheduled private drivers → private shared journeys → nearby drivers → further passenger transport, initially with no Jali platform fees. Cargo/freight is an approved separate service; its public batch is TBD. Courier/parcel and food delivery remain excluded.

The target direction is a modular Laravel backend and modular Expo app with shared foundations, one account, connected customer/provider views and additive releases; extraction or separate apps need a justified later decision. Keep permissions, view mode, selected service, offered services and operational availability distinct. Detailed navigation examples remain proposals, not an approved redesign or a description of current implementation.

Flag material deviations and their implications; honor explicit owner-approved changes and record them when documentation edits are authorized. Backlog dependency waves are implementation order, not public launch order. Existing code is not proof of launch readiness or completed modularization. This plan does not authorize implementation, service activation, infrastructure provisioning, deployment or issue changes.

---

## Monorepo Layout

```
Jali/
├── mobile/     React Native (Expo Router) — iOS & Android
├── backend/    Laravel 12 REST API (PHP 8.3+)
└── context.md  ← this file
```

### Module layout (architecture migration, Scope A)

Business logic lives in owner modules; controllers and route files are thin adapters. Details, contracts and per-task evidence: `docs/migration/MIGRATION_LOG.md`. Some file paths cited further down this document predate the migration — trust the tree.

- **Backend** `backend/app/Modules/<Owner>/{Application,Contracts,Infrastructure}` — owners: Bus, DriverHire, Identity, LegacyBookings, Locations, NearbyRides, Notifications, Payments, Pricing, Providers, Rentals, Safety, SharedJourneys. Cross-module calls go only through another module's `Contracts/` and must be allowed in `app/Modules/boundaries.php` (`ModuleBoundaryTest`). Controllers stay in `app/Http/Controllers`; `App\Models` are shared storage adapters. `app/Services` holds only `PushService` (use `Notifications\Contracts\PushSender`). API routes are frozen by `RouteInventoryTest` against `docs/migration/routes-baseline.json` — update the baseline deliberately when you add a route.
- **Mobile** `mobile/features/<service>/` (bus, driver-hire, nearby-rides, rentals, shared-journeys; import another feature only via its `index.ts` and only if `features/boundaries.json` allows it) and `mobile/core/{session,navigation,notifications}` (core/session and core/notifications never import features). `mobile/app/**` route files are one-line wrappers. Check with `npm run check:boundaries`.
- **Session**: every logout/401/account deletion goes through `core/session/teardown.ts` `endSession()`; the driver/customer view is view-only state per account (`core/session/viewState.ts`), never a server mutation.

---

## Mobile App

### Tech Stack

| Concern | Library |
|---|---|
| Framework | Expo SDK 54, React Native 0.81.5, React 19 |
| Routing | Expo Router v6 (file-based) |
| Styling | NativeWind v4 + Tailwind CSS v3 |
| HTTP | Axios (configured in `lib/api.ts`) |
| Auth storage | AsyncStorage — key: `"jali_api_token"` |
| Firebase | v12 — auth (`inMemoryPersistence`) + storage |
| i18n | i18next + react-i18next — EN / FR / RW / SW |
| Animations | React Native Reanimated v4 |
| Icons | @expo/vector-icons (Ionicons) |

### Environment (`lib/env.ts`)

```ts
EXPO_PUBLIC_APP_ENV = "dev" | "test" | "prod"
isDev / isTest / isProd
```

API base URL (`lib/api.ts`):
- Dev:  `https://jali.stoka.rw/api`
- Prod: `https://api.jali.rw/api`
- Override: `EXPO_PUBLIC_API_URL`

---

### Route Map

```
app/
├── index.tsx                  Entry — checks token → /(tabs) or /(auth)/login
├── _layout.tsx                Root — SafeAreaProvider + I18nWrapper + Stack + OfflineBanner
│
├── (auth)/
│   ├── _layout.tsx            Bare stack wrapper
│   └── login.tsx              User login: phone OTP (UI only, not wired) | email+password | Google
│                              Steps: "phone" | "email" | "otp"
│                              Google → Firebase → POST /auth/login/google → setApiToken → /(tabs)
│                              Email → Firebase signInWithEmailAndPassword → POST /auth/login/google → /(tabs)
│                              Dev shortcut: Google skips real auth, goes straight to /(tabs)
│
├── (tabs)/
│   ├── _layout.tsx            DriverModeProvider wraps tabs; Drive tab hidden if driverMode=false
│   ├── index.tsx              Home — browse buses, private seats, car rentals
│   ├── trips.tsx              User's booking history
│   ├── drive.tsx              Driver dashboard (split into components/driver/*)
│   └── profile.tsx            User profile — reads from Firebase auth.currentUser directly (no API call)
│
├── (admin)/
│   ├── _layout.tsx            AdminNavProvider wraps all; tab bar hidden on login screen
│   │                          Superadmin tabs: Dashboard, Bookings, Analytics, Stations
│   │                          Admin tabs:      Dashboard, Bookings, Analytics, Profile
│   ├── admin-login.tsx        Admin login: POST /auth/login → setApiToken → refetch() → dashboard
│   │                          Also handles Firebase onAuthStateChanged auto-redirect
│   │                          Route: /admin-login (renamed from login.tsx to avoid /login conflict)
│   ├── dashboard.tsx          Earnings summary, booking status cards, role-based nav tiles
│   ├── analytics/index.tsx    Revenue + booking analytics charts + ride metrics (RideAnalyticsSection)
│   ├── bookings/index.tsx     All bookings list
│   ├── bookings/[id].tsx      Booking detail + status update
│   ├── stations/index.tsx     Station list + edit (superadmin only in tab bar)
│   ├── users/index.tsx        User list (superadmin only)
│   ├── users/[id].tsx         User detail + edit
│   ├── logs/index.tsx         Activity log (superadmin only)
│   ├── profile/index.tsx      Admin profile — name, photo, contract upload; uses GET /admin/profile
│   ├── buses/index.tsx        Bus list
│   └── buses/[id].tsx         Bus detail
│
├── driver/
│   ├── setup.tsx              Driver onboarding (card presentation)
│   ├── fleet.tsx              Driver's car fleet management
│   ├── listing.tsx            Create/edit a private seat listing
│   ├── ride/[id].tsx          Driver trip: navigate → I've arrived → PIN start → complete (cash/MoMo) → rate rider
│   ├── hire-settings.tsx      Hire a Driver: prices, skills, weekly hours, days off
│   └── hire/[id].tsx          Driver hire: accept → navigate → check in → check out (cash/MoMo) → rate customer
│
├── hire/                      Hire a Driver (customer) — index.tsx search & book, [id].tsx status/cancel/rate
├── ride/                      On-demand rides (rider) — ProtectedRoute layout
│   ├── index.tsx              "Where to?": GPS pickup (reverse geocode), destination search, recents
│   ├── nearby.tsx             Nearby drivers with own price: sort Closest/Cheapest/Top rated, class chips, Request
│   └── [id].tsx               Rider trip: waiting countdown → driver card + plate + PIN → in trip → receipt & rating
│
└── legal/[doc].tsx            Legal docs viewer (modal presentation)
```

---

### Auth Flow Detail

#### User Auth
1. Firebase email/password or Google Sign-In
2. Get Firebase ID token → `POST /auth/login/google { firebase_token }`
3. Laravel returns `{ token, user }` — store token in AsyncStorage
4. Navigate to `/(tabs)`

#### Admin Auth
1. `POST /auth/login { email, password }` → Laravel Sanctum token
2. `setApiToken(token)` stores in AsyncStorage
3. `await refetch()` — forces `AdminNavContext` to re-fetch `/me` with new token
4. `router.replace("/(admin)/dashboard")`

**Why `refetch()` is required**: `AdminNavProvider` mounts with the layout (including on the login screen), so it calls `/me` before the token exists → gets null. After login, the provider instance stays mounted, so `refetch()` must be called explicitly. Without it, `user` stays null all session.

#### Token Lifecycle
- Stored: `AsyncStorage.setItem("jali_api_token", token)`
- Auto-attached: request interceptor in `lib/api.ts`
- Auto-logout: 401 response → clear token → `router.replace("/(auth)/login")`
- 403 response: shows Alert "Access Denied"
- Logout: `POST /auth/logout` + `clearApiToken()` + `signOut(auth)`

---

### Contexts & Global State

#### `components/admin/AdminNavContext.tsx`
```ts
// Provider: wraps all (admin)/* screens via (admin)/_layout.tsx
// Fetches GET /me once on mount; exposes refetch() for post-login use

type AdminUser = {
  name: string; email: string; roles: string;
  permissions: string[]; profile_image_url: string | null;
  location: { name: string; city: string } | null;
}

// Hook: useAdminNav()
{ user, isSuperAdmin, loading, refetch, handleLogout }

// isSuperAdmin = user?.roles === "superadmin"
```

#### `lib/DriverModeContext.tsx`
```ts
// Provider: wraps (tabs)/* via (tabs)/_layout.tsx
// Persisted in AsyncStorage ("jali_driver_mode"), cleared by clearApiToken() on logout.
// On a new phone, restored from GET /driver/profile → profile.services (drivers only).
// setDriverType also saves the service to the server (PATCH /driver/profile { services }).

// Hook: useDriverMode()
{ driverMode: boolean, driverType: "private"|"rental"|"ride"|"hire"|null,
  hydrated: boolean, setDriverMode, setDriverType }

// Drive tab in (tabs)/_layout.tsx is hidden unless driverMode === true
```

---

### Key Library Files

#### `lib/api.ts` — Axios instance
- Base URL from env (dev: localhost:8000, prod: api.jali.rw)
- Request interceptor: attaches `Authorization: Bearer <token>`
- Response interceptor: 401 → clear token + redirect; 403 → Alert
- Exports: `api` (default), `setApiToken`, `clearApiToken`, `getApiToken`

#### `lib/firebase.ts`
- Firebase project: `jali-8cad5`
- Uses `inMemoryPersistence` — Firebase session lost on app restart (Laravel token persists via AsyncStorage)
- Exports: `auth`, `storage`, `firebaseConfig`

#### `lib/env.ts`
- `APP_ENV` from `EXPO_PUBLIC_APP_ENV`
- Exports: `isDev`, `isTest`, `isProd`

#### `lib/i18n.ts`
- Languages: English (en), French (fr), Kinyarwanda (rw), Swahili (sw)
- Locale files: `locales/{en,fr,rw,sw}.json`
- Usage: `const { t } = useTranslation()`

#### `lib/serviceFee.ts`
- `haversineDistance` only. Jali charges no fees (S7.4): bookings send no fee, sheets show "No Jali fees".

#### `lib/usePushPermission.ts`
- Push permission + registers the Expo push token via `POST /me/push-token` (called in (tabs)/_layout.tsx via `<PushRegistrar/>`)
- Tapping a notification routes by `data.screen` (`routeForNotification`); `ride` → `/ride/{id}`, `driver_ride` → `/driver/ride/{id}`
- Active ride banners: `components/rides/ActiveRideBanner.tsx` (Home = rider, Drive tab = driver) share `useActiveRide()` → `GET /rides/active`
- Trips tab → *rides* filter: `components/rides/RideHistory.tsx` (`useInfiniteQuery` on `GET /rides`, skeleton, tap → `/ride/{id}` receipt)
- Incoming ride requests: `components/driver/IncomingRequests.tsx` polls `/driver/ride-requests` every 4 s while online
- Backend sends through `App\Services\PushService::send($user, $title, $body, ['screen' => ..., 'id' => ...])`
  (Expo tokens → Expo push API; raw FCM tokens → Firebase). Never throws.

---

### Components

#### Admin
| File | Purpose |
|---|---|
| `components/admin/AdminHeader.tsx` | Header for all admin screens; shows `user?.name`, role badge (teal=admin, purple=superadmin), location name |
| `components/admin/AdminNavContext.tsx` | Context + provider (see above) |
| `components/admin/AdminNavSheet.tsx` | Bottom sheet navigation for admin |

#### User / Shared
| File | Purpose |
|---|---|
| `components/BookingSheet.tsx` | Booking confirmation bottom sheet |
| `components/BusCard.tsx` | Bus listing card |
| `components/CityPicker.tsx` | City selection UI |
| `components/LocationPicker.tsx` | Location selection UI |
| `components/OfflineBanner.tsx` | Global network offline indicator (shown in root layout) |
| `components/PrivateCard.tsx` | Private seat listing card |
| `components/RentalCard.tsx` | Car rental listing card |
| `components/ui/Btn.tsx` | Reusable button |

#### Driver
| File | Purpose |
|---|---|
| `components/driver/DriverActionCard.tsx` | Driver action button card |
| `components/driver/DriverHeader.tsx` | Header for drive screen |
| `components/driver/DriverTypeBanner.tsx` | Shows driver type (private/rental) |
| `components/driver/PickupZones.tsx` | Pickup zone selector |
| `components/driver/TripsTabs.tsx` | Pending / completed trips tab switcher |
| `components/driver/WeekSummaryCard.tsx` | Weekly earnings summary card |

---

### Constants

#### `constants/theme.ts` — Color palette (`C.xxx`)
```ts
C.blue="#0055CC"   C.blueDk="#003D99"  C.blueLt="#E8F0FF"
C.teal="#009E8E"   C.tealLt="#E5F7F5"
C.yellow="#FFD000"
C.green="#00A63E"  C.greenLt="#E6F7ED"
C.orange="#FF5C00" C.orangeLt="#FFF0E8"
C.purple="#7C3AED" C.purpleLt="#F0EBFE"
C.white="#FFFFFF"  C.bg="#F2F4F8"
C.dark="#0D1117"   C.mid="#4A5568"  C.muted="#9AA5B4"  C.border="#DDE2EC"
```

#### `constants/roles.ts`
```ts
ROLES = { SUPERADMIN:"superadmin", ADMIN:"admin", DRIVER:"driver", USER:"user" }
isAdminRole(role: string): boolean  // true for admin | superadmin
```

#### `constants/data.ts` — Static app data
#### `constants/locations.ts` — Location reference data

---

## Backend (Laravel 12)

### Tech Stack
- Laravel 12 + Laravel Sanctum (personal access tokens, expire after SANCTUM_EXPIRATION minutes, default 30 days)
- SQLite (dev database at `database/database.sqlite`)
- `kreait/firebase-php` for Firebase token verification
- Middleware: `CheckPermission` (`app/Http/Middleware/CheckPermission.php`)

### API Routes (`routes/api.php`)

#### Public (no auth, throttled)
```
POST /track-access                app-open tracking (token optional)
POST /auth/login                  email + password → Sanctum token
POST /auth/login/google           firebase_token → Sanctum token
POST /auth/otp/request            sends a random 6-digit code via SmsSender (503 in prod until an SMS driver exists)
POST /auth/otp/verify             single-use hashed code, 5 min, 5 attempts; OTP_DEV_CODE only in local/testing
```

#### Protected — `auth:sanctum`
```
GET  /me                          Current user (id, name, email, phone, roles, permissions, location)
POST   /me/push-token             Register device push token (Expo or FCM) — any auth user
DELETE /me/push-token             Remove push token (also cleared on logout)
POST /auth/logout                 Revoke current token

GET  /bookings                    User's bookings
POST /bookings                    Create booking
GET  /bookings/{id}               Booking detail

# perm: confirm-bookings
POST   /bookings/{id}/claim       Admin claims booking
PATCH  /bookings/{id}/ticket      Upload ticket
POST   /bookings/{id}/deliver     Mark delivered

# perm: create-private-seats (driver routes)
GET    /driver/stats
GET    /driver/trips
GET    /driver/profile            Driver profile + active vehicle + vehicles
PATCH  /driver/profile            Saves setup.tsx data (name, zones, docs, active vehicle)
GET    /driver/listings
POST   /driver/listings
PATCH  /driver/listings/{id}
DELETE /driver/listings/{id}

# Car rental (epic E24, Modules/Rentals). Prices are the owner's — Jali adds no fee.
# perm: offer-rentals (owners: driver role)
GET|POST /driver/cars              list / create (new listings are verification_status=pending)
GET|PATCH|DELETE /driver/cars/{id} detail (+ blocks, busy calendar) / edit (new plate or rejected → pending) / delete (409 with open rentals)
POST   /driver/cars/{id}/photos    multipart photo (≤12, public disk); DELETE …/photos/{i}; POST …/photos/{i}/cover
POST   /driver/cars/{id}/documents multipart type=registration|insurance (private disk; back to pending); GET …/documents/{type}
POST   /driver/cars/{id}/blocks    blocked Kigali dates (409 if a rental holds them); DELETE …/blocks/{blockId}
GET    /driver/rentals?status=requested|upcoming|active|past, /driver/rentals/summary, /driver/rentals/{id}
POST   /driver/rentals/{id}/accept|decline|cancel|handover|return|rate   handover/return: multipart odometer_km, fuel_level 0–8, photos[]
# perm: rent-cars (customers)
GET    /rentals/cars?start_at&end_at&type&transmission&seats&max_price&city&q&sort   verified + free cars with quote
GET    /rentals/cars/{id}?start_at&end_at&pickup_method   detail, terms (owner rules), busy calendar, quote
GET|POST /rentals/bookings, GET /rentals/bookings/{id}, POST /rentals/bookings/{id}/cancel|rate
# perm: manage-rentals (admin, superadmin)
GET /admin/rental-cars?status, GET /admin/rental-cars/{id}, POST /admin/rental-cars/{id}/review {approve|reject, note}, GET …/documents/{type}
GET /admin/rentals?status, GET /admin/rentals/{id}
# Lifecycle: requested → accepted → active (handed over) → completed (returned); requested → declined|expired (12 h, rentals:expire-requests)|cancelled
# Cancellation fee (owed to owner) by policy: flexible 24 h → 1 day; moderate 3 days → 50 %; strict 7 days → 50 %, <24 h 100 %
# Return: late per started day after 60 min grace, extra km × fee over limit × days, owner-listed charges

# perm: view-analytics
GET  /analytics/revenue
GET  /analytics/bookings
GET  /analytics/earnings
GET  /analytics/stations
GET  /analytics/rides?period=day|week&from&to   ride metrics (S10.3): requested/completed, cancel rates by side, expired rate, GMV, commission, pickup ETA, fare/km by class, top drivers — Kigali buckets, ≤92 days

# Admin profile (any auth user)
GET   /admin/profile
PATCH /admin/profile
POST  /admin/profile/image
POST  /admin/profile/contract

# perm: manage-locations
GET    /admin/locations
POST   /admin/locations
PATCH  /admin/locations/{id}
DELETE /admin/locations/{id}
GET    /admin/location-requests
POST   /admin/location-requests/{id}/approve
POST   /admin/location-requests/{id}/reject

# any auth user
POST /admin/location-request      Request a location change

# perm: manage-admins
GET  /admin/logs
GET  /admin/stations
PATCH /admin/stations/{id}

# perm: confirm-bookings
GET   /admin/bookings
PATCH /admin/bookings/{id}

# perm: apply-as-driver (every role) — driver onboarding
GET    /driver/onboarding         checklist (services, profile, licence, documents, vehicle, rates) + status
PUT    /driver/onboarding/services
PUT    /driver/onboarding/licence expired licence → 422
POST   /driver/onboarding/submit  → status pending (resubmit after rejection allowed)
POST   /driver/documents          multipart type+file → private 'local' disk
GET    /driver/documents/{id}/file owner or verify-drivers only (404 otherwise)
GET    /driver/profile · PATCH /driver/profile · GET/PUT /driver/rates (applicants can set prices)
GET    /driver/vehicles           my vehicles (active first)
POST   /driver/vehicles           add (first becomes active); plate unique, insurance date required
PATCH  /driver/vehicles/{id}      edit own vehicle (404 for others')
DELETE /driver/vehicles/{id}
POST   /driver/vehicles/{id}/activate   the one vehicle riders see
POST   /driver/vehicles/{id}/photos     multipart slot=front|side|interior|luggage, photo

# perm: offer-rides — driver-set prices for the active vehicle (validated vs guardrails)
GET   /driver/rates               rates + guardrails + service fee + price preview
PUT   /driver/rates

# Rate limits (S21.7, AppServiceProvider::configureRateLimits): all API 120/min per user|IP;
#   sign-in 10/min/IP + 20/h/email · OTP request 5/h/phone · OTP verify 10/h/phone · POST /rides 6/min → 429 {message} + Retry-After
# perm: request-rides — rider side of on-demand rides
POST  /rides/estimate              {pickup, dropoff} → {trip, classes:[{class, available, drivers, min_quote, max_quote, nearest_eta_min}]} (S3.6)
GET   /rides/nearby?lat&lng&dest_lat&dest_lng[&class]   { trip:{distance_km,est_minutes}, drivers:[NearbyDriver] }
      verified + live drivers within nearby_radius_km, each priced with their own rates (FareService),
      closest first, max 50, positions rounded to ~100 m, no phone numbers

POST  /rides                      {mode:"pick", driver_id, …} or {mode:"broadcast", vehicle_class?, max_fare?, …} — broadcast goes to
                                  the N nearest drivers (rides.broadcast_max_drivers) within max_fare; first accept wins at its own price (S3.5)
                                   → price computed server-side and locked (rate_snapshot); 409 if busy/unavailable
GET   /rides                      my rides as rider (paginated)
GET   /rides/active               current ride as rider or driver, or JSON null — poll during a trip
GET   /rides/{id}                 rider or assigned driver only (404 otherwise); PIN only for the rider
POST  /rides/{id}/cancel          {reason} — rider: requested/accepted/arrived (fee after free wait); driver: accepted/arrived
POST  /rides/{id}/rate            {stars, tags?, comment?} once per person, after completion
GET   /places/search?q&lat&lng   Rwanda places (Nominatim, cached 1 day, 60/min)
GET   /places/reverse?lat&lng    readable address (falls back to coordinates)

# perm: offer-rides (verified drivers) — online/offline (story S5.1)
GET   /driver/presence            { online, online_since, blocked_reasons[] }
POST  /driver/presence            { online, lat, lng, heading } — heartbeat every ~8 s while online
      blocked when: not verified / suspended / no active vehicle / insurance expired /
      no front photo / no rates / rates outside limits. Offline after presence_ttl_sec without heartbeat.
      Scheduler: `rides:expire-presence` every minute (needs cron → php artisan schedule:run)

GET   /driver/ride-requests       request cards (pickup area only, earnings after commission, expires_at)
POST  /rides/{id}/accept          atomic — 409 if taken/expired
POST  /rides/{id}/decline · /arrive · /start {pin} (5 wrong → 423 + flagged) · /complete {payment_method}
      Ride states: requested → accepted → arrived → in_progress → completed | declined | expired | cancelled_by_*
      Every transition writes ride_events (append-only) and pushes the other party.
      Scheduler: `rides:expire-requests` every minute (requests also expire lazily when read)

# perm: verify-drivers (admin, superadmin) — driver verification queue
GET   /admin/drivers?status=pending|verified|rejected|suspended   oldest submission first
GET   /admin/drivers/{userId}     application: licence, checklist, documents, vehicles, prices
POST  /admin/drivers/{userId}/verify    riders get the driver role; docs approved; push
POST  /admin/drivers/{userId}/reject    {reason, documents?:{type:reason}}; push
POST  /admin/drivers/{userId}/suspend   {reason}; push

# Driver money (S5.4, S7.1, S7.2) — perm: offer-rides · admin: manage-rides
GET   /driver/earnings            periods today|week|month {trips, collected, earnings, commission}, balance, owed, blocked, ledger…
POST  /driver/settlements         {amount, reference} MoMo payment to Jali → pending → POST /admin/settlements/{id}/confirm|reject
PUT   /driver/momo                {momo_number, momo_name} — shown to riders paying by MoMo (Ride.driver.momo)
POST  /driver/payouts             {amount} ≤ balance → cashout_requests (requester_type=driver)
      Ledger: driver_ledger (balance < 0 = owes Jali). Completed ride/hire → earning (no balance effect, cash already
      collected) + commission (−commission −service_fee). Owed > rides.max_commission_owed → blocker commission_owed.
      S7.4: rides/hire commission_pct and service_fee default to 0 (migration zero_jali_fees resets saved values);
      legacy bus/private/rental bookings store service_fee 0. A superadmin can still set fees (logged).

# Help centre (S16.2) — Modules/Support
GET   /help/topics                ?service&context&q&locale → {data:[{id, slug, title, body, services, contexts}]}  perm: use-support
GET   /help/topics/{slug}         ?locale (else Accept-Language, else en)                                           perm: use-support
GET|POST /admin/help-topics, PUT|DELETE /admin/help-topics/{id}   title/body required in en/fr/rw/sw; logged  perm: manage-support
      6 starter topics seeded (charged wrong, driver behaviour, lost item, cancel/refunds, rental damage, account).
      App: features/support (HelpTopicsCard on ride/hire/rental details, /help, /help/[slug]); admin app/(admin)/help-topics.

# Reliable push (S12.3) — Modules/Notifications
POST  /me/notifications/{id}/opened   own pushes only (404 otherwise); app sends it on tap (data.nid)   any signed-in user
GET   /admin/notifications/stats      ?days → per type {total, delivered, no_token, opened, sms_fallbacks, rates}  perm: view-analytics
      Every PushSender::send is logged in push_notifications (type = data.screen) and adds `nid` to data. driver_ride
      pushes use Android channel `ride_requests` + `ride_request.wav` (mobile/assets/sounds, expo-notifications plugin).
      send(..., ['sms_fallback' => text]) texts the user if not opened within services.push.sms_fallback_seconds
      (PUSH_SMS_FALLBACK_SECONDS, default 60) — used for "driver arrived". Command notifications:sms-fallback (every minute).

# Support tickets (S16.3) — Modules/Support (SupportDesk)
GET|POST /support/tickets         mine / open {category, subject_type ride|hire|rental, subject_id (must be mine), message}
GET   /support/tickets/{id}       owner only (404 otherwise); staff shown as "Jali support"        perm: use-support
POST  /support/tickets/{id}/messages (reopens; 409 when resolved) · POST /support/tickets/{id}/resolve
GET   /admin/support/tickets      ?status=open|answered|resolved&mine&priority → {data, counts{open,urgent,overdue}}
      urgent first, then first-response deadline. POST .../{id}/messages|assign|status; GET|POST|DELETE
      /admin/support/canned-replies   perm: manage-support. Priority: safety=urgent (1 h), driver_behaviour/damage=high
      (4 h), else normal (24 h). Urgent tickets push every manage-support user; staff replies/resolution push the
      customer (screen support_ticket → /support/[id]). Assign/status changes are logged.

# Service access (S23.1) — Modules/ServiceAccess (runbook M06)
GET   /me/service-access          ?lat&lng&app_version → {version:1, services:[{id, label, discoverable, accepting_new_requests,
                                  can_use, can_offer, can_configure, reason_code, minimum_app_version, area}]}  any signed-in user
GET|PUT /admin/services           release flags {rides|hire|rental|shared|bus|cargo: {discoverable, accepting_new_requests,
                                  minimum_app_version}} perm: manage-services (logged). Cargo can't be enabled (not built).
      New intake refused with 403 {message, reason_code: not_released|paused|app_update_required} — rides, hire, rental
      requests and legacy /bookings. Region reasons (not_in_area/off_in_area) come from S10.4. App sends X-App-Version;
      clients without it aren't version-gated. Admin UI: app/(admin)/settings/services.
      App (S23.2): core/navigation/serviceRegistry.ts (HOME_TABS, HOME_BARS) + serviceAccess.ts (useServiceAccess,
      fallback = every built service on). Home shows and queries only available services; new-request entry routes
      (/ride, /ride/nearby, /hire, /rental/car/[id]) are wrapped in <ServiceGate>; detail/history routes never are.

# Service areas (S10.4) — Modules/Locations
GET   /service-areas/check        ?lat&lng&service=rides|hire|rental|shared|bus|cargo → {served, area, message}  perm: request-rides
GET|POST /admin/service-areas     list (cities then zones) / create {name, kind city|zone, zone_type, parent_id, active,
                                  polygon [[lat,lng]…] | geojson | circle {lat,lng,radius_km}, overrides}  perm: manage-service-areas
GET|PUT|DELETE /admin/service-areas/{id}   (delete 409 while a city has zones). Every change → ActivityLog.
      Contract Locations\Contracts\ServiceAreas: availability(), cityAt(), zonesAt(), zones(type) — zones are for airport
      queue, pickup points and heatmaps. No live city ⇒ everywhere served. Rides (nearby/estimate/request) and hire requests
      answer 422 {message: "Not available here yet. Jali currently works in Kigali."} outside a live city or when the service
      is off there. City overrides (commission_pct, cancel_fee, free_wait_min, nearby_radius_km, broadcast_max_drivers,
      vehicle_classes) apply through NearbyRides\Application\AreaRideSettings. Admin UI: app/(admin)/service-areas.

# Hire operations (S6.6) — Modules/DriverHire AdminHires, perm: manage-rides
GET   /admin/hires                ?status&from&to&customer&driver&page → {data, next_page}
GET   /admin/hires/{id}           + quote snapshot, timeline (timestamps + admin log entries), ratings
POST  /admin/hires/{id}/times     {checked_in_at?, checked_out_at?, note} started/completed only; completed → overtime,
                                  total and commission recomputed, ledger adjusted; logged hire.times_corrected
      Admin UI: app/(admin)/hires.

# Safety (E8) — perm: request-rides (rider or driver of the ride)
POST  /rides/{id}/share           → {url: APP_URL/t/{token}} live while active · PUBLIC GET /api/share/{token} (410 after) + web page /t/{token}
POST  /rides/{id}/sos {lat?,lng?} flags ride, pushes manage-rides admins (screen admin_ride), SMS to emergency contact; app dials 112
GET|PUT /me/emergency-contact     {name, phone}
GET   /admin/drivers/review       (verify-drivers) low rating after N rated trips or high cancel rate (rides.review) · POST /admin/drivers/{id}/warn

# International (E9) — perm: request-rides
POST  /auth/login/apple           {firebase_token, name?} — same Firebase verification as Google; email linking only if email_verified
GET|POST /rides/{id}/messages     chat between accept and completion; phrase keys (RideMessage::PHRASES) shown in each app's language;
                                  free text, phone numbers/links refused (422)
GET   /fx/rates                   RWF → USD/EUR/GBP/KES, refreshed daily (open.er-api.com) into platform_settings('fx'); stale > 3 days → null
POST  /rides/{id}/receipt · /driver-hire/{id}/receipt {email?}  → signed printable link /receipts/{type}/{id} (30 days);
      receipts are emailed on completion when the customer has an email (Mail, MAIL_MAILER)
      Phone login: any country code (login picker or "+…"), real SMS codes from /auth/otp/*

# Hire a Driver (epic E6) — a verified driver drives the customer's own car
# perm: offer-driver-hire (verified drivers; controller also checks verification)
GET|PUT /driver/hire-settings     hourly (+min hours), daily (+hours included), overtime, out-of-town; skills (transmissions, languages, years)
GET|PUT /driver/availability      {weekly:[{weekday 0=Sun,start_time,end_time}], blocked_dates:[Y-m-d]} — no weekly rows = any time (Kigali time)
GET   /driver/hires?scope=requests|upcoming|past
POST  /driver-hire/{id}/accept · /decline · /check-in (from start−2h) · /check-out {payment_method} (overtime after grace)
# perm: request-rides — customer side
GET   /driver-hire/available?start_at&duration_type=hours|days&duration_value&trip_type=city|airport|out_of_town&transmission
POST  /driver-hire                {driver_id, …, pickup{lat,lng,address}, accept_terms:true} → requested (price locked)
GET   /driver-hire · /driver-hire/{id} · POST /driver-hire/{id}/cancel {reason} · /rate
      States: requested → accepted → started → completed | declined | expired | cancelled_by_customer | cancelled_by_driver
      Rules in platform_settings rides.hire (limits, commission, fee, timeout, free-cancel hours, late fee %, grace, max days)
      Scheduler: `hires:expire-requests` every minute. Services: app/Services/Hire/*. Driver rating = rides + hires.
      Mobile: app/hire (book), app/hire/[id], app/driver/hire-settings, app/driver/hire/[id], HireRequestsCard (Drive tab),
      HireDriverBar (Home), Trips → hires filter, legal/hire-terms

# perm: manage-rides (admin, superadmin) — ride operations (S10.1, S10.2)
GET   /admin/rides/live           counters (online by class, on trip, by status, expired 1h, completed today), drivers, active rides
GET   /admin/rides?status&from&to&rider&driver&flagged&page   full names + phones; flagged = PIN-locked or rated ≤2★
GET   /admin/rides/{id}           timeline (ride_events), fare breakdown with rate snapshot, ratings
POST  /admin/rides/{id}/adjust    {final_fare?, commission?, note} completed only → ride_events 'adjusted' + activity_logs 'ride.adjusted'
      Mobile: (admin)/rides (Live tab polls 10 s · All rides with filters) and (admin)/rides/[id]; dashboard tile "Rides"

# perm: manage-ride-pricing (superadmin) — ride guardrails, stored in platform_settings['rides']
GET   /admin/settings/rides
PUT   /admin/settings/rides

# perm: manage-users
GET   /admin/users
PATCH /admin/users/{id}
```

---

### Controllers

```
app/Http/Controllers/
├── AuthController.php              login, loginWithGoogle, requestOtp, verifyOtp, logout, me, respondWithToken
├── BookingController.php           index, store, show, claim, uploadTicket, deliver
├── BusController.php               index
├── CarRentalController.php         index, driverCars, storeCar, updateCar, destroyCar
├── DriverController.php            stats, trips, updateProfile
├── PrivateSeatController.php       index, store, update, destroy, driverListings
├── AnalyticsController.php         revenue, bookings, earnings, stations
└── Admin/
    ├── AdminBookingController.php      index, update
    ├── AdminBusController.php
    ├── AdminProfileController.php      show, update, uploadProfileImage, uploadContract
    ├── AdminStationController.php      index, update
    ├── AdminUserController.php         index, update
    ├── ActivityLogController.php       index
    ├── LocationController.php          index, store, update, destroy
    └── LocationChangeRequestController.php  index, store, approve, reject
```

---

### Models

```
app/Models/
├── User.php               role_id (FK), firebase_uid, name, email, phone, password,
│                          profile_image_url, location_id; belongsTo Role, Location
├── Role.php               name: superadmin|admin|driver|user; hasMany permissions
├── Permission.php         name strings
├── Booking.php            user bookings; status, location_id, travel_date
├── Bus.php                bus listings (public)
├── CarRental.php          car rental listings; owner fields
├── PrivateSeat.php        private seat/carpool; driver fields
├── Location.php           { name, city }
├── LocationChangeRequest.php  admin location change requests
├── ActivityLog.php        admin activity trail
├── DriverDocument.php     licence front/back, national ID, selfie, insurance (private files)
├── DriverProfile.php      driver services, zones, licence, verification status, rating (1 per user)
├── DriverPresence.php     online flag + last position per driver (scope live() = within TTL)
├── Ride.php               on-demand ride (state machine in Services/Rides/RideService.php)
├── RideDispatch.php       who was offered a ride · RideEvent.php append-only audit · RideRating.php
├── DriverRate.php         driver-set ride prices per vehicle (base, per km/min, min fare, pickup, night ×)
├── PlatformSetting.php    key/value superadmin config (e.g. 'rides' guardrails)
├── Vehicle.php            driver vehicles: class, model, plate (unique), seats, insurance, rental price
└── AdminStation.php       admin ↔ station assignments
```

---

### Roles & Permissions

| Role | Permissions |
|---|---|
| `superadmin` | all: confirm-bookings, view-analytics, create-private-seats, manage-locations, manage-admins, manage-users |
| `admin` | confirm-bookings, view-analytics, manage-locations |
| `driver` | create-private-seats |
| `user` | (none / basic access) |

Role check in frontend: `user?.roles === "superadmin"` → `isSuperAdmin`
Role check middleware: `permission:manage-admins` etc. via `CheckPermission.php`

---

### Seeders

```
database/seeders/
├── DatabaseSeeder.php            orchestrates all seeders
├── RolesAndPermissionsSeeder.php creates roles + permission records
├── AdminSeeder.php               creates superadmin + admin users
├── UsersSeeder.php               regular users
├── BusesSeeder.php
├── CarRentalsSeeder.php
├── PrivateSeatsSeeder.php
├── BookingsSeeder.php
├── AdminStationsSeeder.php
└── LocationsSeeder.php
```

Run: `php artisan db:seed` or `php artisan migrate:fresh --seed`

---

### Key Config Notes

- **Firebase credentials**: `storage/app/firebase-credentials.json`
- **CORS**: `config/cors.php` — must allow the mobile app origin in prod
- **Sanctum**: `config/sanctum.php` — stateless token auth only (no cookie sessions)
- **OTP**: codes are random and hashed in cache; `OTP_DEV_CODE` works only when APP_ENV is local/testing. Real SMS provider is TODO in `app/Services/SmsSender.php`
- **Bookings**: server computes price/fee/title/location; status flow pending → taken → ticket_ready → delivered (+ cancelled) via `Booking::transitionTo()`; admin visibility via `Booking::scopeManageableBy()` (superadmin all, station admin = own admin_stations, none if no station)
- **Tests**: `php artisan test` (in-memory SQLite) + `tests/e2e/smoke.php` against `php artisan serve`

---

## Known Architecture Decisions

| Decision | Reason |
|---|---|
| `AdminNavProvider` mounted on login screen too | Layout wraps all `(admin)/*`; can't be excluded without extra nesting |
| `refetch()` called after admin login | Provider doesn't re-run `useEffect` on same mount; `refetch` re-fetches `/me` after token is stored |
| `inMemoryPersistence` for Firebase | Firebase v12 removed `getReactNativePersistence`; Laravel token in AsyncStorage handles persistence |
| Profile screen uses Firebase `auth.currentUser` | User tab profile — simpler, no API call needed for basic info |
| Admin profile uses `GET /admin/profile` | Richer data: location, contract status, etc. |
| SQLite in dev | Simplicity; switch to MySQL/Postgres for prod via `.env` `DB_CONNECTION` |

---

## ⚠️ MANDATORY: API & Screen Guard Requirements

**All new APIs and screens MUST follow these guard patterns. No exceptions.**

### Backend (Laravel) — REQUIRED Pattern

Every new API endpoint MUST follow this layered security pattern:

```php
// 1. PUBLIC auth endpoints (NO guard):
Route::post("/auth/login", ...);
Route::post("/auth/login/google", ...);
Route::post("/auth/otp/request", ...);
Route::post("/auth/otp/verify", ...);

// 2. ALL OTHER endpoints MUST be inside auth:sanctum group:
Route::middleware("auth:sanctum")->group(function () {
    
    // Basic authenticated endpoints (any logged-in user)
    Route::get("/me", ...);
    Route::get("/bookings", ...);
    
    // Role-restricted endpoints MUST add permission middleware:
    Route::middleware("permission:<permission-name>")->group(function () {
        // Admin-only routes
        Route::get("/admin/bookings", ...);
        
        // Driver-only routes
        Route::get("/driver/stats", ...);
    });
});
```

**Backend Rules:**
1. Every non-auth endpoint MUST be inside `Route::middleware("auth:sanctum")`
2. Role-restricted endpoints MUST add `Route::middleware("permission:<name>")` inside the auth group
3. Controllers MUST ALSO check role with `$user->isAdmin()`, `$user->isSuperAdmin()`, etc. for defense-in-depth
4. New permissions MUST be added to `RolesAndPermissionsSeeder` and assigned to appropriate roles
5. Token generation MUST use `$user->createToken("api-token")->plainTextToken` pattern

### Mobile (Expo) — REQUIRED Pattern

**For NEW user screens (inside `(tabs)`):**
Already protected by `<ProtectedRoute>` in `(tabs)/_layout.tsx`. No additional per-screen guard needed.

**For NEW admin screens (inside `(admin)`):**
Must be added inside the existing `AdminNavProvider` wrapper. The admin layout provides role-aware protection via `/me` API call.

**For NEW driver screens:**
MUST be wrapped with `<ProtectedRoute>` either at individual screen level or at a driver layout level.

**For NEW standalone protected screens (not in tabs/admin/driver groups):**
```tsx
import ProtectedRoute from "@/lib/ProtectedRoute";

export default function MyScreen() {
  return (
    <ProtectedRoute>
      {/* screen content */}
    </ProtectedRoute>
  );
}
```

**Mobile Rules:**
1. No screen that calls protected APIs should render without a token check
2. All API calls automatically get Bearer token via Axios interceptor in `lib/api.ts`
3. Use `ROLES` from `@/constants/roles` and `isAdminRole()` helper for role checks
4. 401 responses auto-redirect to login; 403 responses show "Access Denied" alert

### General Guard Rules

| Rule | Description |
|---|---|
| **Backend auth** | Every API route (except login/OTP) must be inside `auth:sanctum` middleware group |
| **Backend permissions** | Admin/driver-specific routes must use `permission:<name>` middleware |
| **Backend defense-in-depth** | Controllers must also check `$user->isAdmin()` / `$user->isSuperAdmin()` for sensitive operations |
| **Mobile route guard** | Every protected screen must be wrapped with `<ProtectedRoute>` at layout or screen level |
| **Mobile API calls** | All API calls automatically get the Bearer token via the Axios interceptor |
| **New permissions** | Must be seeded in `RolesAndPermissionsSeeder` and assigned to roles |
| **Role constants** | Mobile side: use `ROLES` from `@/constants/roles` and `isAdminRole()` helper |
| **No bare API screens** | No screen that calls protected APIs should render without a token check |

### Roles & Permissions Matrix

| Permission | superadmin | admin | user | driver |
|---|---|---|---|---|
| `create-bookings` | Yes | Yes | Yes | No |
| `view-own-bookings` | Yes | Yes | Yes | No |
| `upload-tickets` | Yes | Yes | No | No |
| `confirm-bookings` | Yes | Yes | No | No |
| `create-private-seats` | Yes | No | No | Yes |
| `view-own-earnings` | Yes | No | No | Yes |
| `view-analytics` | Yes | Yes | No | No |
| `manage-buses` | Yes | Yes | No | No |
| `manage-users` | Yes | No | No | No |
| `manage-admins` | Yes | No | No | No |
| `manage-locations` | Yes | Yes | No | No |
| `view-station-analytics` | Yes | Yes | No | No |
| `manage-agencies` | Yes | Yes | No | No |
| `request-rides` | Yes | Yes | Yes | Yes |
| `offer-rides` | Yes | No | No | Yes |
| `offer-driver-hire` | Yes | No | No | Yes |
| `verify-drivers` | Yes | Yes | No | No |
| `manage-rides` | Yes | Yes | No | No |
| `manage-ride-pricing` | Yes | No | No | No |
