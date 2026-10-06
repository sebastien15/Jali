# Jali — Project Context

> AI quick-reference. Read this before exploring any file. Last updated: 2026-04-11.

---

## What Is Jali

A Rwandan transport booking app. Users browse and book buses, private cars, and car rentals. Drivers can list their own seats/cars. Admins manage bookings, stations, locations, and users through a separate admin portal inside the same mobile app.

---

## Monorepo Layout

```
Jali/
├── mobile/     React Native (Expo Router) — iOS & Android
├── backend/    Laravel 11 REST API
└── context.md  ← this file
```

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
- Dev:  `https://jali.stoka.rw/backend/public/api`
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
│   ├── analytics/index.tsx    Revenue + booking analytics charts
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
│   └── ride/[id].tsx          Driver trip: navigate → I've arrived → PIN start → complete (cash/MoMo) → rate rider
│
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

#### `lib/serviceFee.ts` / `lib/useServiceFee.ts`
- Service fee calculation logic + hook

#### `lib/usePushPermission.ts`
- Push permission + registers the Expo push token via `POST /me/push-token` (called in (tabs)/_layout.tsx via `<PushRegistrar/>`)
- Tapping a notification routes by `data.screen` (`routeForNotification`); `ride` → `/ride/{id}`, `driver_ride` → `/driver/ride/{id}`
- Active ride banners: `components/rides/ActiveRideBanner.tsx` (Home = rider, Drive tab = driver) share `useActiveRide()` → `GET /rides/active`
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

## Backend (Laravel 11)

### Tech Stack
- Laravel 11 + Laravel Sanctum (personal access tokens)
- SQLite (dev database at `database/database.sqlite`)
- `kreait/firebase-php` for Firebase token verification
- Middleware: `CheckPermission` (`app/Http/Middleware/CheckPermission.php`)

### API Routes (`routes/api.php`)

#### Public (no auth)
```
GET  /buses
GET  /car-rentals
GET  /private-seats
POST /auth/login                  email + password → Sanctum token
POST /auth/login/google           firebase_token → Sanctum token
POST /auth/otp/request            phone OTP request (dev: always returns success)
POST /auth/otp/verify             OTP verify (dev: "123456" accepted)
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
GET    /driver/cars
POST   /driver/cars
PATCH  /driver/cars/{id}
DELETE /driver/cars/{id}

# perm: view-analytics
GET  /analytics/revenue
GET  /analytics/bookings
GET  /analytics/earnings
GET  /analytics/stations

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

# perm: request-rides — rider side of on-demand rides
GET   /rides/nearby?lat&lng&dest_lat&dest_lng[&class]   { trip:{distance_km,est_minutes}, drivers:[NearbyDriver] }
      verified + live drivers within nearby_radius_km, each priced with their own rates (FareService),
      closest first, max 50, positions rounded to ~100 m, no phone numbers

POST  /rides                      {mode:"pick", driver_id, pickup{lat,lng,address}, dropoff{…}, payment_method}
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
- **OTP**: dev mode accepts `"123456"` — real SMS (Twilio/Africa's Talking) is TODO

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
