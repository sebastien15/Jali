# Jali: User Stories and Status Audit

> Author: architect pass (read-only), 2026-10-05.
> Source of truth: the code (`backend/routes/api.php`, controllers, models, migrations, seeders, and every screen under `mobile/app` and `mobile/components`). `context.md` and `CLAUDE.md` are partly stale. For example, `context.md` says the dev URL is `localhost:8000`, but `lib/api.ts:7` has `192.168.1.64:8000`. It also says phone OTP is "UI only".
>
> **Snapshot note:** another agent was editing the backend while this audit ran. `AuthController.php`, `routes/api.php` and `Models/User.php` changed around 00:15. The changes added throttles, rejected login for accounts with no password, generated a real hashed OTP behind an `SmsSender`, and set `User::$hidden`. Stories affected by those edits say so. All other line numbers come from the code as read at about 00:00–00:17.

---

## 1. Architecture summary

### 1.1 Stack
- **mobile/** — Expo SDK 54, Expo Router v6, TanStack Query persisted to AsyncStorage for 7 days (`app/_layout.tsx:69`), Axios singleton (`lib/api.ts`), Firebase JS SDK with `inMemoryPersistence` for Google login, and i18n in EN/FR/RW/SW. There are three route groups in one binary:
  - `(auth)` — user login
  - `(tabs)` — passenger: Home, Trips and Profile, plus a Drive tab that only shows in driver mode
  - `(admin)` — station agent and superadmin portal
  - `driver/*` — setup, fleet and listing screens
- **backend/** — Laravel 11, Sanctum bearer tokens with no expiry (`config/sanctum.php:47` `expiration => null`), a custom `permission:<name>` middleware (`app/Http/Middleware/CheckPermission.php`), and kreait/laravel-firebase to verify Google ID tokens. SQLite in dev, MySQL in prod.

### 1.2 Data model (as migrated)
| Table | Purpose | Notes |
|---|---|---|
| `users` | All actors. Columns: `role_id` (single role), `password` (nullable), `firebase_uid`, `phone`, `fcm_token`, `profile_image_url` (mediumtext, base64 data URI), `whatsapp_number`, `contract_doc_url`, `contract_verified`, `cashout_*` | **There is no `location_id` column**, yet `User::location()` and several controllers read `$user->location_id`. See the cross-cutting defects. |
| `roles`, `permissions`, `role_permissions` | RBAC. `permissions.category` was added 2026-04-18 | `user_roles` pivot dropped |
| `admin_stations` | **Terminals.** Columns: name, aliases[], city, district, province, type, lat/lng, image, `user_id`. `user_id` is the assigned station admin; FK **cascadeOnDelete** (`2026_04_11_140000…:14`) | Also served to passengers as `/stations` |
| `locations` | "Bus stops", meaning pickup/dropoff locations: name, type `bus_station`/`custom`, city, coordinates | Runs in parallel with `admin_stations`. `bookings.location_id` points here |
| `corridors`, `corridor_terminals` | Corridors CRD-01…08, with an ordered list of terminals per corridor | Only read by `LocationController@index` for enrichment |
| `agencies` | Bus operators: name, operating_hours, created_by | |
| `agency_routes` | An agency serving from-terminal → to-terminal, with corridor_id, **price, total_seats, duration_mins, active** | **This is now the trip definition** |
| `trip_departures` | Daily departure times (HH:MM) per agency_route, with an active flag | Not dated; recurs every day |
| `trips` (legacy) | Old per-departure rows | Still seeded and still read by `AdminBookingController` and `Booking::trip()`. Should be dead |
| `bookings` | user_id, type (`trip`, `bus`, `private`, `rental`), reference_id, title/sub, price, service_fee, quantity, passenger_names[], status, ticket_photo_url, payment_method, paid_at, travel_date (free string), location_id, trip_id (legacy), **trip_departure_id**, confirmed_by, confirmed_at | `trip_departure_id` **is not in `Booking::$fillable`** (`Models/Booking.php:10-29`) |
| `private_seats` | A driver's seat listing: from, to, pickup_station, dep, date, price, seats, amenities, group discount, custom pickup | |
| `car_rentals` | Rental car: name, type, price per day, caution, seats, plate, amenities, photos, `user_id` (owner) | No `status` column |
| `buses` | Legacy bus catalogue | Only `/buses` reads it. Mobile no longer uses it |
| `agency_ratings` | One row per (user, agency): stars + comment | |
| `cashout_requests` | Admin payout requests | |
| `location_change_requests` | Admin asks to move station | Uses the missing `users.location_id` |
| `activity_logs` | Audit trail. `admin_id` FK **cascadeOnDelete** | Audit history is lost when a user is deleted |
| `app_accesses` | App open telemetry: platform, ip, lat/lng, district | |

**Seed data defect:** `AgenciesTripsSeeder` inserts `agency_routes` without price or duration, and it inserts into legacy `trips`. It **never inserts into `trip_departures`** (`AgenciesTripsSeeder.php:436-441`). The restructure migration (`2026_04_16_000001`) only converts trips that already existed when it ran, and on a fresh `migrate --seed` none exist. Checked against the dev `database.sqlite`: `trip_departures` has 0 rows, `agency_routes` has 148 rows (all with `price = 0`), and legacy `trips` has 1396 rows. Bus search is therefore empty.

### 1.3 Booking lifecycle and statuses
Intended flow, as built by the admin UI in `app/(admin)/bookings/index.tsx:166-193`:

```
pending ──(agent "claim")──> taken ──(agent uploads ticket photo)──> ticket_ready ──(agent "mark delivered")──> delivered
```

- Creation: `POST /bookings` always sets `pending`. Nothing marks a booking as paid, and `paid_at` is never written.
- Two lifecycle implementations exist side by side:
  1. `BookingController@claim/uploadTicket/deliver` (`/bookings/{id}/claim|ticket|deliver`). These **do** enforce transitions, but **no mobile code uses them**.
  2. `AdminBookingController@update` (`PATCH /admin/bookings/{id}`) accepts **any** status in `pending,confirmed,completed,cancelled,taken,ticket_ready,delivered`, with no from-state check (`AdminBookingController.php:99-127`). It is the one the mobile app uses. `uploadTicket` (`POST /admin/bookings/{id}/ticket`) forces `ticket_ready` from any state (line 160-163).
- Extra statuses that the UIs expect but the flow never produces:
  - Passenger Trips tab filters on `pending`, `confirmed` and `completed` (`(tabs)/trips.tsx:53`).
  - Driver API maps only `confirmed` to "upcoming" (`DriverController.php:74`).
  - `confirmed` is reachable only from the unreachable `bookings/[id].tsx` screen.
  - `cancelled` has no endpoint or UI.
- `confirmed_by` and `confirmed_at` are **never written** anywhere. Admin earnings and cashout depend on `confirmed_by`.

### 1.4 Money
- **All prices and fees are computed on the client and trusted by the server.** `BookingController@store` validates only `price: integer|min:0` and `service_fee: integer|min:0` (`BookingController.php:94-95`).
  - Trip fee: 5% of price, minimum 500, maximum 3000 RWF (`lib/serviceFee.ts:66-68`). It is charged once per booking whatever the quantity.
  - Private seat fee: distance tiers of 300, 400 or 500 RWF from GPS to one of 8 hard-coded city coordinates (`lib/serviceFee.ts:43-61`). The doc comment describes different tiers (300 to 1500).
  - Rental fee: a flat 300 RWF (`components/BookingSheet.tsx:47`). The rental price is `item.price * days`, computed on the client.
- Revenue split: 50% of `service_fee` to the platform and 50% to the admin (`AnalyticsController@revenue/earnings`).
- Driver earnings are computed as `price - service_fee` (`DriverController.php:33-34,73`). This is wrong because `price` already excludes the fee.

### 1.5 Auth flows
| Flow | Mobile | API | State |
|---|---|---|---|
| Email + password (user) | `(auth)/login.tsx:85-107` | `POST /auth/login` | Works. Accounts without a password were accepted with any password; the concurrent edit fixes this at `AuthController.php:41-43` |
| Google | `(auth)/login.tsx:45-83` → Firebase → `POST /auth/login/google {firebase_token}` | `AuthController@loginWithGoogle` creates or links the user | In dev it bypasses auth entirely with no token. Navigation happens even if the backend call fails |
| Phone OTP | `sendCode()` only shows "coming soon" (`login.tsx:115`); `verifyCode()` calls `confirmation.confirm` on null (`login.tsx:124`) | `POST /auth/otp/request` and `/auth/otp/verify` | Backend was fixed to `123456` and auto-created the account. The concurrent edit now uses random hashed codes and an SMS sender, and returns 503 until SMS is configured. The mobile app is still not wired |
| Admin | `(admin)/admin-login.tsx:53-91` → `POST /auth/login`; client-side role check | same | See US-50 |
| Token | AsyncStorage `jali_api_token`, cached in memory; a 401 clears it and redirects to login (`lib/api.ts:37-40`) | Sanctum, no expiry | Persisted query cache is not cleared on passenger logout |

### 1.6 Roles and permissions: seeded vs enforced
Roles seeded in `RolesAndPermissionsSeeder.php`. `manage-roles` and the granular `agencies.*` and `locations.*` permissions come only from migration `2026_04_18_000001`.

| Permission | superadmin | admin | driver | user | Enforced by route? |
|---|---|---|---|---|---|
| create-bookings | yes | — | — | yes | **No.** `POST /bookings` is only `auth:sanctum`, so any role can book |
| view-own-bookings | yes | — | — | yes | **No** |
| upload-tickets | yes | yes | — | — | **No.** Ticket upload is gated by `confirm-bookings` |
| confirm-bookings | yes | yes | — | — | Yes: `/bookings/{id}/claim|ticket|deliver`, `/admin/profile/*`, `/admin/bookings*`, `/admin/cashout/*` |
| create-private-seats | yes | — | yes | — | Yes: all `/driver/*` |
| view-own-earnings | yes | — | yes | — | **No** |
| view-analytics | yes | yes | — | — | Yes: `/analytics/*` |
| view-station-analytics | yes | yes | — | — | **No** |
| manage-buses | yes | yes | — | — | **No.** `AdminBusController` has no routes |
| manage-users | yes | — | — | — | Yes: `/admin/users*` |
| manage-admins | yes | — | — | — | Yes: `/admin/logs*`, `/admin/access-stats`, `/admin/app-accesses`, `/admin/stations*` |
| manage-locations | yes | **yes** (seeder) | — | — | Yes: `/admin/locations*`, `/admin/location-requests*`, `/admin/location-request`. Migration `2026_04_10_130047` says superadmin only, but the seeder also grants it to admin, so an admin could approve their own location-change request |
| manage-agencies | yes | yes | — | — | Yes: `/admin/agencies*`, `/admin/trips*`. An admin can therefore create or delete agencies, routes and departures through the API |
| manage-roles | yes (via sync-all) | — | — | — | Yes: `/admin/roles*`, `/admin/permissions` |
| agencies.create/update/delete/routes, locations.create/update/delete | yes | — | — | — | **Never enforced** |

Other server-side role checks are hard-coded on role **names** (`User::isAdmin/isSuperAdmin/isDriver`, `User.php:66-79`; `AgencyController@update` uses `hasRole('superadmin')`). Renaming a system role through `PATCH /admin/roles/{id}` is allowed for every role except superadmin (`RolesController.php:52-61`), and doing so silently breaks those checks.

Mobile role gating is only cosmetic:
- The `(admin)/_layout.tsx:62` guard checks only that `/me` returned a user, not the role.
- Dashboard tiles are filtered by `isSuperAdmin` and by permission strings.
- `roles/index` and `roles/[id]` are not declared in the admin `<Tabs>`, so Expo Router adds them as visible tab buttons for every admin (`(admin)/_layout.tsx:142-152`).

---

## 2. User stories

Legend: **WORKING**, **PARTIAL** (works with defects or gaps), **BROKEN** (the main path fails, or a security or money defect), **MISSING** (no implementation).

### 2.1 Guest (unauthenticated)

**US-01: As a guest I can open the app and be sent to login or home.** WORKING
- Screens: `app/index.tsx`, `lib/ProtectedRoute.tsx`, `(tabs)/_layout.tsx:101`
- API: none (checks the stored token)
- Rules: a token present means `/(tabs)`, otherwise `/(auth)/login`. The token is not validated until the first 401.

**US-02: As a guest I can sign in with email and password.** WORKING (after the concurrent fix)
- Screen: `(auth)/login.tsx:85-107`
- API: `POST /auth/login` → `AuthController@login`
- Rules: email + password required; throttle 10/min (new). Originally any account with `password = null` was logged in with **any** password (8 dev users: all seeded passengers except the test user, and all drivers). The current code rejects them (`AuthController.php:41-43`).
- Remaining gap: there is no email registration or password reset anywhere.

**US-03: As a guest I can sign in with Google.** PARTIAL
- Screen: `(auth)/login.tsx:45-83`
- API: `POST /auth/login/google` → `AuthController@loginWithGoogle`
- Rules: Firebase ID token is verified, the user is linked by `firebase_uid` or by an email with no uid, otherwise created with role `user`.
- Defects:
  - With `APP_ENV=dev` the button calls `router.replace("/(tabs)")` with **no token** (`login.tsx:46-49`). The first API call then returns 401 and loops back to login.
  - If the backend sync throws, the error is only `console.warn`ed and the user still lands in tabs without a token (`login.tsx:73-77`).
  - Linking a pre-seeded user by matching email (`AuthController@loginWithGoogle`, pre-seeded branch) means anyone who controls a Google account with an admin's email inherits the admin role. That is acceptable only if emails are verified; `email_verified` is not checked.

**US-04: As a guest I can sign in with my phone number and an SMS code.** MISSING (mobile), backend in progress
- Screen: `(auth)/login.tsx:109-130`
- API: `POST /auth/otp/request`, `POST /auth/otp/verify` → `AuthController@requestOtp/verifyOtp`
- Rules (current backend): random 6-digit code, hashed in cache, TTL, max attempts, throttle 3/min on request, returns 503 until SMS is configured, auto-creates the account with role `user`.
- Mobile: `sendCode()` only shows "coming soon" (`login.tsx:115`). `verifyCode()` dereferences `confirmation`, which is never set (`login.tsx:34,124`). It never calls the API.
- At baseline the backend accepted the fixed code `123456` for any phone, which was an account takeover.

**US-05: As a guest I can create an account explicitly (name, phone, email, password).** MISSING. Accounts are created only implicitly through Google or OTP, with name "User" for OTP.

**US-06: As a guest I can browse trips, seats and rentals before logging in.** MISSING (by design). All catalogue routes are inside `auth:sanctum` (`api.php`, "Browsing data (requires login)"). Store reviewers often expect browsing without login.

**US-07: As a guest or user I can read the FAQ, Terms and Privacy policy.** WORKING
- Screen: `app/legal/[doc].tsx` (static content). It is reachable only from Profile, after login.

**US-08: As the platform I record anonymous app opens (platform, district).** PARTIAL
- Code: `app/_layout.tsx` `AccessTracker` → `POST /track-access` → `AppAccessController@store`
- Defects:
  - The route is outside `auth:sanctum`, so `$request->user()` is always null and `user_id` is never recorded (`api.php:28`, `AppAccessController.php:25`). The admin "Guest" column is always shown.
  - No throttle.
  - Each call can make a synchronous Nominatim reverse-geocode request, which risks breaking Nominatim's usage policy.

### 2.2 User / passenger

**US-10: As a passenger I can search bus departures between two terminals.** BROKEN (data)
- Screens: `(tabs)/index.tsx:178-193`, `components/home/SearchHeader.tsx`, `components/StationPicker.tsx:39`, `components/home/BusResults.tsx`, `components/TripCard.tsx`
- API: `GET /stations` → `AdminStationController@index`; `GET /trips?from_station_id&to_station_id&agency_id&page` → `TripSearchController@index`
- Rules: active agency_routes that have at least one active departure; pagination 20; agency rating included.
- Evidence:
  - `trip_departures` is never seeded (`AgenciesTripsSeeder.php:436-441`), so search returns `[]`. Routes also have `price = 0`.
  - `per_page`, `near_lat/near_lng` and the date are sent but ignored (`index.tsx:181-184` vs `TripSearchController.php:40` `paginate(20)`).
  - There is no per-date seat availability.
  - `/stations` returns `admin_name` and `admin_email` of station agents to every passenger (`AdminStationController.php:27-28`), which leaks PII.

**US-11: As a passenger I can filter results by agency and by "departing after" time.** WORKING (client-side, `(tabs)/index.tsx:255-290`). Agencies I have booked before are listed first.

**US-12: As a passenger I can book N seats on a departure, name the passengers and choose a payment method.** BROKEN
- Screen: `components/TripBookingSheet.tsx:81-145`
- API: `POST /bookings {type:"trip", reference_id: departure_id, price, service_fee, payment_method, travel_date, quantity, passenger_names}` → `BookingController@store`
- Expected rules: price = route.price × quantity and the fee are computed on the server; the departure exists and is active; seats are available for that date; `travel_date` is a real date; the booking is linked to the departure and therefore to the origin station.
- Evidence:
  - Price and fee are computed on the client (`TripBookingSheet.tsx:81-84,129-130`) and stored as-is (`BookingController.php:94-95,156-157`). A user can post `price: 0`.
  - `trip_departure_id` is set in `create()` (`BookingController.php:164`) but is not fillable, so it is silently dropped. The booking cannot be traced to its departure or station, and the route and departure delete guards never fire.
  - `travel_date` is the label "Today" or "Tomorrow", not a date (`TripBookingSheet.tsx:86-92,132`).
  - No seat or capacity check. `active` is not checked. `quantity` and `passenger_names` count are not reconciled.
  - The title and sub are server-generated (good), but only when the client omits `title`.

**US-13: As a passenger I can book a seat in a private driver's car.** BROKEN
- Screens: `components/home/PrivateResults.tsx`, `components/PrivateCard.tsx`, `components/BookingSheet.tsx:55-80`
- API: `POST /bookings {type:"private", reference_id, price, service_fee, payment_method, travel_date, title, sub}`
- Evidence:
  - The client always sends `title` (`BookingSheet.tsx:64-66`), so the server skips the item lookup and the 404 check entirely (`BookingController.php:110`). `reference_id` can be any integer, including an inactive or deleted listing.
  - Price and fee come from the client. The distance fee uses 8 hard-coded city coordinates (`lib/serviceFee.ts:43-52`).
  - `seats` is never decremented and the listing is never closed. No quantity.

**US-14: As a passenger I can rent a car for N days.** BROKEN
- Screens: `components/home/RentalResults.tsx`, `components/RentalCard.tsx`, `components/BookingSheet.tsx`
- API: `POST /bookings {type:"rental", price: price*days, service_fee: 300, title, sub}`
- Evidence:
  - Same unchecked `reference_id` and trusted price as US-13 (`BookingSheet.tsx:60-61`).
  - The number of days exists only inside the `sub` string. There are no pickup or return dates, no availability check, and the caution (deposit) is never charged.

**US-15: As a passenger I can browse private seats for a date and route.** PARTIAL
- API: `GET /private-seats?from&to&date&page` → `PrivateSeatController@index`
- Evidence:
  - The date filter is `whereDate('dep', d) OR date = 'Y-m-d'` (`PrivateSeatController.php:34`). Driver-created listings store `date` as `"Mon 6 Oct 2026"` and `dep` as `"07:00"` (`driver/listing.tsx:27-31,145`), so they never match and are invisible to passengers. Only seeded rows match.
  - No proximity sort, although `near_lat` is sent.

**US-16: As a passenger I can browse rental cars.** WORKING (`GET /car-rentals` → `CarRentalController@index`). No availability or status filter. `type` is filterable but unused.

**US-17: As a passenger I can see my bookings and their status.** PARTIAL
- Screen: `(tabs)/trips.tsx`
- API: `GET /bookings` → `BookingController@index`
- Rules: a regular user sees only rows with `user_id = me` (ownership OK). `GET /bookings/{id}` checks owner or admin.
- Evidence:
  - The filter chips are `pending/confirmed/completed` (`trips.tsx:53`), but real statuses are `taken/ticket_ready/delivered`. "Confirmed" and "Completed" are always empty.
  - `TYPE_ICON` and `TYPE_COLOR` have no `trip` key (`trips.tsx:14-19`), and `trip` is the main booking type.
  - Users with role **driver** get bookings **on their listings** instead of their own bookings (`BookingController.php:32-56`), so a driver who books a bus never sees it.
  - Users with role admin (not superadmin) get `[]` because `users.location_id` does not exist (`BookingController.php:27`).
  - The response omits `travel_date`, `quantity` and `passenger_names`.

**US-18: As a passenger I can view the ticket photo once the agent uploads it.** WORKING
- Screen: `(tabs)/trips.tsx:147-204`
- The field is `ticket_photo_url`, stored via `Storage::url` on the **public** disk. Anyone with the URL can fetch it (design gap). It needs `APP_URL` and `storage:link`.

**US-19: As a passenger I can cancel a booking (and get a refund).** MISSING. No endpoint, no UI. `cancelled` exists only as an admin PATCH value.

**US-20: As a passenger I can pay for my booking (MTN MoMo, Airtel Money, card).** MISSING. `payment_method` is a free string (`BookingController.php:96`); `paid_at` is never set; there is no payment provider.

**US-21: As a passenger I can rate the agency after booking.** BROKEN
- Screen: `components/TripBookingSheet.tsx:137-160,412+`
- API: `POST /agencies/{agency}/rate {stars, comment}` → `AgencyRatingController@store` (upsert per user and agency)
- Evidence:
  - `setShowRating(true)` is followed immediately by `onConfirm()` (`TripBookingSheet.tsx:138-139`). The parent then unmounts the whole sheet (`(tabs)/index.tsx:270` sets `setTripSheet(null)`), so the rating modal never appears.
  - The backend does not require a delivered booking with that agency, so anyone can rate any agency.

**US-22: As a passenger I can see and edit my profile.** PARTIAL
- Screen: `(tabs)/profile.tsx`
- Evidence:
  - The name and email come from Firebase `auth.currentUser` (`profile.tsx:189-192`). That is null for email/password logins and after every restart (in-memory persistence), so the screen shows "Jali User".
  - The stats are hard-coded `"0"`, `"—"`, `"0"` (`profile.tsx:198`).
  - There is no user profile update endpoint (only `/admin/profile` and `/driver/profile`).

**US-23: As a passenger I can change the app language.** WORKING (`lib/i18n.ts`, local).

**US-24: As a passenger I can log out.** PARTIAL
- Screen: `(tabs)/profile.tsx:63-78`
- API: `POST /auth/logout`
- Evidence: the TanStack cache is persisted to AsyncStorage for 7 days (`app/_layout.tsx:69`) and passenger logout does not call `queryClient.clear()`. The next account on the device sees the previous user's `/me` and bookings until refetch. Admin logout does clear it (`AdminNavContext.tsx`).

**US-25: As a passenger I can delete my account.** PARTIAL
- Screen: `(tabs)/profile.tsx:80-95,285`
- API: `DELETE /auth/me` → `AuthController@deleteAccount`
- Evidence:
  - There is **no confirmation dialog**: one tap deletes (`profile.tsx:80-82`).
  - Errors are only logged to the console.
  - The cascade hard-deletes all of the user's bookings (financial records) and activity logs.
  - For an admin account it cascades through `admin_stations.user_id` (`2026_04_11_140000…:14`) and deletes the **terminal**, then its agency_routes, then their departures.
  - The persisted cache is not cleared.

**US-26: As a passenger I can contact support on WhatsApp and rate the app.** WORKING (static links). `APP_STORE_URL` is the placeholder `id0000000000` (`profile.tsx:19`).

**US-27: As a passenger I get a push notification when my ticket is ready.** MISSING
- `lib/usePushPermission.ts:26-31` gets an Expo token and only `console.log`s it.
- Nothing posts it to the backend. Only `PATCH /driver/profile` accepts `fcm_token`, and only for drivers.
- `TicketController` (which has FCM code) has no route.

### 2.3 Driver (private seats and rental owner)

**US-30: As a user I can switch on driver mode and become a driver.** BROKEN
- Screens: `(tabs)/profile.tsx:32-60`, `lib/DriverModeContext.tsx`, `(tabs)/_layout.tsx:74-81`
- Expected: a driver application, then admin approval, then role `driver`.
- Evidence:
  - The toggle is client-only, in memory, and lost on restart.
  - Every `/driver/*` route requires `permission:create-private-seats` (`api.php`, driver group), which role `user` lacks. Any real new user gets 403 "Access Denied" alerts on the Drive tab.
  - There is no endpoint to request or grant the driver role, other than a superadmin `PATCH /admin/users/{id}`, which is itself broken (US-71).

**US-31: As a driver I can see today's and this week's earnings and trips.** BROKEN (money)
- Screens: `(tabs)/drive.tsx:49-53`, `components/driver/DriverHeader.tsx`, `components/driver/WeekSummaryCard.tsx`
- API: `GET /driver/stats` → `DriverController@stats`
- Evidence:
  - Earnings = `price - service_fee` (`DriverController.php:33-34`). The fee is stored separately, so the driver's earning should be `price`.
  - Pending and unpaid bookings are counted.
  - Only private listings are counted; rental owners always see 0.
  - The rating is the average of static `private_seats.rating`.

**US-32: As a driver I can see upcoming and past bookings on my listings.** PARTIAL
- Screens: `(tabs)/drive.tsx:55-59,111-113`, `components/driver/TripsTabs.tsx`
- API: `GET /driver/trips` → `DriverController@trips`
- Evidence:
  - `upcoming` is only produced from status `confirmed` (`DriverController.php:74`), which the lifecycle never sets, so every booking lands in "History".
  - `pax` is hard-coded to 1 (line 72).
  - Earnings are wrong as in US-31 (line 73).
  - There are no passenger contact details. N+1 query per booking (`PrivateSeat::find` in the loop).

**US-33: As a driver I can publish a private-seat listing.** BROKEN
- Screen: `app/driver/listing.tsx:130-160`
- API: `POST /driver/listings` → `PrivateSeatController@store`
- Rules: `from`, `to`, `pickup_station`, `dep`, `price`, `seats` required; owner = me.
- Evidence:
  - The mobile app sends **camelCase** (`pickupStation`, `dropLocation`, `groupDiscount`, `groupMinSize`, `groupDiscountPct`, `allowCustomPickup`, `customPickupFee`; `listing.tsx:144-147`). The backend requires snake_case `pickup_station` (`PrivateSeatController.php:62`), so the request fails with 422 "Could not save listing".
  - Even when fixed, `date` is sent as "Mon 6 Oct 2026", which breaks the passenger search (US-15).
  - `notes` is validated but not fillable, so it is dropped.

**US-34: As a driver I can edit or pause one of my listings.** BROKEN
- Screen: `app/driver/listing.tsx:80-112`
- API: `GET /driver/listings/{id}` **does not exist** (only PATCH and DELETE; `api.php` driver group). The screen falls back to the cached list, but those rows are snake_case while the form reads `listing.pickupStation`, `groupDiscount` and so on, so the fields come up empty.
- `PATCH /driver/listings/{id}` with camelCase silently ignores those fields.
- There is no UI to toggle `active` (the backend accepts it).
- Ownership is enforced (`where user_id = me`).

**US-35: As a driver I can delete a listing.** WORKING
- `DELETE /driver/listings/{id}` with an ownership check.
- Gap: no guard for existing bookings, which keep a dangling `reference_id`.

**US-36: As a rental owner I can see my fleet with availability counts.** PARTIAL
- Screens: `app/driver/fleet.tsx:33-37`, `components/driver/DriverActionCard.tsx:49-55`
- API: `GET /driver/cars` → `CarRentalController@driverCars`
- Evidence: the UI counts `c.status === "available"` and `"rented"`, but `car_rentals` has no `status` column, so the counts are always 0.

**US-37: As a rental owner I can add a car.** WORKING
- Screen: `app/driver/fleet.tsx:323-350`
- API: `POST /driver/cars` (`priceDay` is mapped to `price`)
- `status` and `zones` are ignored; photos are never uploaded.

**US-38: As a rental owner I can edit a car and set it available, rented or under maintenance.** PARTIAL
- Screen: `app/driver/fleet.tsx:48-60`
- API: `PATCH /driver/cars/{id}`
- Evidence: `status` and `notes` are validated (`CarRentalController.php:85`) but are not columns or fillable, so they are silently dropped. The mobile app PATCHes the whole object (`fleet.tsx:49-51`). Ownership is enforced.

**US-39: As a rental owner I can remove a car.** WORKING (`DELETE /driver/cars/{id}`, ownership checked). No booking guard.

**US-40: As a driver I can complete my driver profile (car model, plate, seats, insurance expiry, documents, photos, zones).** BROKEN
- Screen: `app/driver/setup.tsx:66-100`
- API: `PATCH /driver/profile` → `DriverController@updateProfile`
- Evidence:
  - The server validates only `name` and `fcm_token` (`DriverController.php:90-91`). `car_model`, `plate`, `seats`, `car_type`, `price_day`, `caution`, `insurance_expiry`, `allowed_zones`, `docs_url` and `amenities` are discarded, yet the app says "Saved".
  - Photos stay as local `file://` URIs and are never uploaded.
  - The response is `$user->fresh()` (line 96), the full user model. It exposed the password hash until the concurrent `$hidden` fix; it still exposes `firebase_uid`, cashout details and so on.

**US-41: As a driver I can go online and choose my pickup zones.** MISSING (`(tabs)/drive.tsx:45-46`, `components/driver/PickupZones.tsx` are local state only).

**US-42: As a rental owner I can see bookings and earnings for my cars.** MISSING
- `/driver/stats` and `/driver/trips` only cover `private` bookings (`DriverController.php:22,59`).
- `/bookings` for drivers does include rental bookings, but no driver screen uses it.

**US-43: As a driver I can request a payout of my earnings.** MISSING. Cashout exists only for admins.

### 2.4 Admin / station agent (role `admin`)

**US-50: As a station agent I can sign in to the admin portal.** PARTIAL
- Screens: `(admin)/admin-login.tsx`, `(admin)/_layout.tsx:62`, `components/admin/AdminNavContext.tsx`
- API: `POST /auth/login`, falling back to Firebase email sign-in then `POST /auth/login/google`; then `GET /me`
- Evidence:
  - When the role is not admin, the client discards the token but never revokes it on the server (`admin-login.tsx:83-87`).
  - The "Google" path (`googleMutation`, `admin-login.tsx:93-111`) has **no role check**, so a passenger lands on the dashboard.
  - The layout guard only checks that `user` is non-null (`_layout.tsx:62`). Any passenger token opens the admin UI; the server still blocks the data with 403.
  - `onAuthStateChanged` auto-login (lines 34-51) makes a Google login call on every mount.

**US-51: As a station agent I can see my dashboard: earnings and booking counts by status.** PARTIAL
- Screen: `(admin)/dashboard.tsx:36-46,160-180`
- API: `GET /analytics/earnings`, `GET /analytics/bookings` (permission `view-analytics`)
- Evidence:
  - Neither endpoint is scoped to the agent's station ("for now" comments, `AnalyticsController.php:59,123`). Every agent sees **platform-wide** booking counts and a 50% share of **all** service fees as "Your earnings".
  - `by_type` omits `trip` (`AnalyticsController.php:104-108`).

**US-52: As a station agent I can see the queue of bookings departing from my station.** BROKEN
- Screen: `(admin)/bookings/index.tsx:66-73`
- API: `GET /admin/bookings?status=` → `AdminBookingController@index` (permission `confirm-bookings`)
- Expected: the agent sees all booking types whose origin is their terminal.
- Evidence:
  - The station filter uses the legacy `trip` relation (`trip_id` → `trips.from_station_id`, `AdminBookingController.php:27`). New bookings have `trip_id = null` and `trip_departure_id` dropped (US-12), so **station agents never see any new trip booking**.
  - Private and rental bookings are never visible to station agents.
  - An agent **without** a station sees **all** bookings (line 36).
  - `trip_departure`, `trip_arrival` and `agency_name` are null for new bookings (lines 65-67).
  - Passenger PII (name, email, phone) is returned.

**US-53: As a station agent I can claim a pending booking (pending → taken).** BROKEN
- Screen: `(admin)/bookings/index.tsx:97-108,167-173`
- API: `PATCH /admin/bookings/{id} {status:"taken"}` → `AdminBookingController@update`
- Expected: only from `pending`; atomic (two agents cannot both claim); records who claimed; only for my station.
- Evidence:
  - No from-state check: any status can be set, including straight to `delivered` or back to `pending` (`AdminBookingController.php:99-127`).
  - The station check is skipped when `$booking->trip` is null (line 84), which is always the case for new bookings, so any agent can modify any booking.
  - `confirmed_by` is never set, which breaks admin earnings (US-62).
  - The correct, guarded implementation (`BookingController@claim`, with a pending check) is unused, and its own scoping relies on the missing `users.location_id` (`BookingController.php:224`).

**US-54: As a station agent I can upload the ticket photo (taken → ticket_ready).** PARTIAL
- Screen: `(admin)/bookings/index.tsx:110-159`
- API: `POST /admin/bookings/{id}/ticket` (multipart `ticket`, image ≤ 16 MB) → `AdminBookingController@uploadTicket`
- Evidence:
  - No precondition `status == taken`; it forces `ticket_ready` from any state (`AdminBookingController.php:160-163`).
  - Same station-scope hole (line 140).
  - The file goes to the public disk and gets a public URL.
  - The passenger is not notified.

**US-55: As a station agent I can mark a booking delivered (ticket_ready → delivered).** BROKEN. Same endpoint and defects as US-53 (`PATCH status=delivered` is allowed from any state). Delivery is what triggers revenue in analytics, so a skipped flow inflates revenue.

**US-56: As a station agent I can open a booking detail, confirm it, or paste a ticket URL.** PARTIAL (dead screen)
- Screen: `(admin)/bookings/[id].tsx`
- Evidence:
  - No screen navigates to it (no `router.push` to `bookings/{id}`).
  - It fetches the **whole** `/admin/bookings` list to find one row (line 30).
  - It sets `status: "confirmed"`, which is outside the lifecycle (line 55).

**US-57: As a station agent I can view analytics (revenue, bookings, earnings).** PARTIAL
- Screen: `(admin)/analytics/index.tsx`
- API: `GET /analytics/revenue|bookings|earnings`
- Evidence:
  - `revenue` scopes admins by `$user->location_id`, which does not exist (`AnalyticsController.php:23-27`). Every agent gets `{data: []}`, shown as zeros.
  - Bookings and earnings are unscoped (US-51).
  - `GET /analytics/stations` is never called by the mobile app.

**US-58: As a station agent I can view and update my profile (phone, WhatsApp).** WORKING
- Screen: `(admin)/profile/index.tsx:45-70`
- API: `GET/PATCH /admin/profile` (permission `confirm-bookings`, so a superadmin passes)
- `PATCH` returns the full `$user->fresh()` (`AdminProfileController.php:82`).
- No phone format validation.

**US-59: As a station agent I can upload a profile photo.** WORKING
- API: `POST /admin/profile/image {image_base64}`
- The data URI (about 200×200 JPEG) is stored in `users.profile_image_url`, which bloats every `/me` and `/admin/users` payload (design gap).

**US-60: As a station agent I can download the contract template and upload my signed contract (PDF).** PARTIAL
- API: `GET /admin/profile/contract-template` (302 redirect to `CONTRACT_TEMPLATE_URL`), `POST /admin/profile/contract` (PDF ≤ 10 MB, public disk)
- Evidence:
  - The mobile app relies on `maxRedirects: 0` and reading the `Location` header (`(admin)/profile/index.tsx:200-210`). React Native's XHR follows redirects and ignores `maxRedirects`, so the template rarely opens.
  - Nothing ever sets `contract_verified = true` (MISSING review flow; see US-81).
  - The Privacy and Terms menu items are no-ops (`profile/index.tsx:138-139`).

**US-61: As a station agent I can set my cashout method (bank or mobile money).** WORKING (`GET/POST /admin/cashout/preference` → `CashoutController`).

**US-62: As a station agent I can request a cashout of my earned share.** BROKEN (money)
- Screen: `(admin)/profile/index.tsx:169-195`
- API: `POST /admin/cashout/requests {amount}` → `CashoutController@store`
- Expected: amount ≤ (earned − already requested or paid); one pending request at a time.
- Evidence:
  - `total_earnings` sums bookings `where confirmed_by = me` (`AdminProfileController.php:32-35`), and `confirmed_by` is never written, so it is always 0 and the UI always says "No earnings".
  - The server accepts **any** `amount ≥ 1` with no balance check (`CashoutController.php:48-53`).
  - `GET /admin/cashout/requests` exists but no screen lists past requests.

**US-63: As a station agent I can set operating hours for agencies.** PARTIAL
- Screen: `(admin)/agencies/index.tsx:67-92`
- API: `PATCH /admin/agencies/{id}`; non-superadmins may only send `operating_hours` (`AgencyController.php:76-88`)
- Evidence:
  - `operating_hours` is `required` for non-superadmins, so an empty submission returns 422.
  - Because role admin holds `manage-agencies`, an agent can also **create and delete agencies, add or remove routes, and create, edit or delete trips and departures** through the API. The granular `agencies.*` permissions are never checked.

**US-64: As a station agent (holding manage-locations) I can manage bus stops (pickup/dropoff locations).** PARTIAL
- Screen: `(admin)/locations/index.tsx`
- API: `GET/POST/PATCH/DELETE /admin/locations` → `LocationController`
- Evidence:
  - `DELETE` first calls `$location->admins()->exists()`, which queries `users.location_id` (`LocationController.php:133`, `Location.php:29-32`). The column does not exist, so this is an SQL error and delete always returns 500.
  - Locations are global and not scoped to the agent.
  - `locations` vs `admin_stations` is a duplicated concept.

**US-65: As a station agent I can request a move to another location.** BROKEN / no UI
- API: `POST /admin/location-request` → `LocationChangeRequestController@store`
- No mobile screen calls it.
- `from_location_id` is read from the missing `users.location_id` (line 39), so it is always null.
- Approval is broken (US-75).
- `reason` is validated but not stored.

**US-66: As an admin I can manage the legacy bus catalogue.** BROKEN (dead)
- Screens: `(admin)/buses/index.tsx:18,29`, `(admin)/buses/[id].tsx:32,66-67`
- API: `/admin/buses*` **has no routes**. `AdminBusController` is orphaned and every call returns 404.
- No tile links to these screens. Delete them or wire them up; the `buses` model is superseded by agency_routes.

### 2.5 Superadmin

**US-70: As a superadmin I can list all users with their role.** WORKING
- Screen: `(admin)/users/index.tsx`
- API: `GET /admin/users` (permission `manage-users`)
- No pagination or search.

**US-71: As a superadmin I can change a user's role (for example promote to driver or admin).** BROKEN
- Screen: `(admin)/users/[id].tsx:59,71`
- API: `PATCH /admin/users/{id}` → `AdminUserController@update`
- Evidence:
  - The mobile app reads `user.roles` (an array) and sends `{ roles: [...] }`.
  - The backend returns and expects a single `role` string (`AdminUserController.php:23,36,43-47`).
  - The request validates as a no-op and the UI says "Roles updated". Roles can never be changed from the app.
  - Backend gaps: no guard against demoting yourself or the last superadmin, and no audit log.

**US-72: As a superadmin I can manage terminals (stations) and assign a station agent.** PARTIAL
- Screen: `(admin)/stations/index.tsx:115-275`
- API: `GET/POST/PATCH/DELETE /admin/stations` (permission `manage-admins`) → `AdminStationController`
- Evidence:
  - `name`, `aliases` and `province` cannot be set on create or update (`AdminStationController.php:51-60,80-89`), but passengers search by them.
  - `admin_id` is not checked to belong to role admin.
  - `DELETE` (line 97) cascades to agency_routes and departures with no active-booking guard. On MySQL it fails with an FK error while legacy `trips` reference the station.
  - The model allows several stations per admin, but `User::adminStation` is `hasOne`.

**US-73: As a superadmin I can create, rename and delete agencies and add or remove their routes.** PARTIAL
- Screen: `(admin)/agencies/index.tsx`
- API: `/admin/agencies` apiResource, plus `POST/DELETE /admin/agencies/{id}/routes[/{route}]` → `AgencyController`
- Evidence:
  - `addRoute` creates an `agency_route` with price 0, duration 0 and no departures (`AgencyController.php:143-147`). The route is invisible in search until it is edited in Trips.
  - `removeRoute` (line 182) and `destroy` (line 108) have no active-booking guard, unlike `TripController@destroy`.
  - `GET /admin/agencies/{id}` is registered by `apiResource` but `show()` does not exist, so it returns 500.

**US-74: As a superadmin I can manage trips (route price, seats, duration, active) and departure times.** PARTIAL
- Screen: `(admin)/trips/index.tsx` (tile visible to superadmin only, but the API is open to admins)
- API: `GET/POST/PATCH/DELETE /admin/trips`, `POST /admin/trips/{id}/departures`, `DELETE /admin/trips/{routeId}/departures/{depId}` → `TripController`
- Rules: price ≥ 100; seats 1–200; duration 1–1440; unique (agency, from, to); from ≠ to; departure `H:i` unique per route; delete blocked when active bookings exist.
- Evidence: the active-booking guards query `bookings.trip_departure_id` (`TripController.php:126,204`), which is never populated (US-12), so they **never block**. `GET /admin/trips/{id}` (apiResource `show`) is missing.

**US-75: As a superadmin I can approve or reject station agents' location-change requests.** BROKEN / no UI
- API: `GET /admin/location-requests`, `POST …/{id}/approve|reject`
- No mobile screen.
- `approve` writes `users.location_id` (`LocationChangeRequestController.php:87-89`). The column is missing, so this is an SQL error and returns 500 after the request was already marked approved (no transaction).
- Admins also hold `manage-locations`, so they can approve their own requests.

**US-76: As a superadmin I can browse the activity log.** PARTIAL (data exposure)
- Screen: `(admin)/logs/index.tsx:181-300`
- API: `GET /admin/logs`, `GET /admin/logs/groups` (permission `manage-admins`)
- Evidence:
  - `ActivityLog::with("admin")` serialises the whole actor `User` (`ActivityLogController.php:15`).
  - With the new `$hidden`, the password, remember token and FCM token are now hidden. `firebase_uid`, phone, cashout account number, bank name and the base64 profile image are still sent for every row.
  - Logs are cascade-deleted with the user.
  - Passengers' `booking_created` actions are logged under `admin_id` (naming only).

**US-77: As a superadmin I can see app-open statistics by platform and district.** PARTIAL (`GET /admin/access-stats`, `/admin/app-accesses`). User attribution is always null (US-08).

**US-78: As a superadmin I can create and delete roles and edit their permissions.** WORKING
- Screens: `(admin)/roles/index.tsx`, `(admin)/roles/[id].tsx`
- API: `/admin/roles*`, `/admin/permissions` (permission `manage-roles`)
- Rules: system roles cannot be deleted; a role with users cannot be deleted; superadmin is always synced to all permissions.
- Caveats:
  - Admin, user and driver can be **renamed**, which breaks the name-based checks (§1.6).
  - Custom roles only get the permissions that routes actually enforce.
  - `roles/*` screens show up as stray tab buttons (§1.6).

**US-79: As a superadmin I can work the booking queue for all stations.** PARTIAL. It is reachable through the dashboard "Bookings" tile (the tab is hidden, `_layout.tsx:96`). There is no scoping, which is correct for a superadmin, but the transition defects of US-53 to US-55 apply.

**US-80: As a superadmin I can review and pay out cashout requests.** MISSING. There is no list-all, approve or reject endpoint for `cashout_requests`; the status stays `pending` forever.

**US-81: As a superadmin I can verify station agents' signed contracts.** MISSING. No endpoint sets `contract_verified`.

**US-82: As a superadmin I can review and approve driver applications (KYC, vehicle documents).** MISSING. See US-30 and US-40.

**US-83: As a superadmin or agent I can cancel or refund a booking.** MISSING. A `cancelled` status can be PATCHed, but there is no refund or payment reversal and the passenger is not notified.

---

## 3. Status counts

| Status | Count | Stories |
|---|---|---|
| WORKING | 16 | 01, 02, 07, 11, 16, 18, 23, 26, 35, 37, 39, 58, 59, 61, 70, 78 |
| PARTIAL | 24 | 03, 08, 15, 17, 22, 24, 25, 32, 36, 38, 50, 51, 54, 56, 57, 60, 63, 64, 72, 73, 74, 76, 77, 79 |
| BROKEN | 18 | 10, 12, 13, 14, 21, 30, 31, 33, 34, 40, 52, 53, 55, 62, 65, 66, 71, 75 |
| MISSING | 13 | 04, 05, 06, 19, 20, 27, 41, 42, 43, 80, 81, 82, 83 |
| **Total** | **71** | |

### 3.1 Cross-cutting defects (root causes behind many stories)
1. **`trip_departure_id` is not in `Booking::$fillable`** (`Models/Booking.php:10-29`). Trip bookings are orphaned. This breaks station scoping, the delete guards and admin booking details (US-12, 52, 53, 55, 74).
2. **`users.location_id` does not exist**, but it is read or written in `BookingController.php:27,224`, `AnalyticsController.php:23,171-183`, `LocationChangeRequestController.php:39,87-89`, `LocationController.php:133` via `Location::admins()`, and `User::location()` (US-17, 57, 64, 65, 75).
3. **Server trusts client price and fee, and skips the item-existence check when `title` is sent** (`BookingController.php:94-95,110`) (US-12, 13, 14).
4. **No server-side state machine for bookings.** `AdminBookingController@update` accepts any status, and `confirmed_by` is never set (US-53, 55, 62).
5. **Seeder never creates `trip_departures` or route prices** (`AgenciesTripsSeeder.php:405-441`), so passenger search is empty in dev (US-10).
6. **Mobile and API contract mismatches:**
   - listings in camelCase vs snake_case (US-33, 34)
   - `roles[]` vs `role` (US-71)
   - `GET /driver/listings/{id}` and `/admin/buses*` missing (US-34, 66)
   - the driver profile fields ignored (US-40)
7. **Legacy dual models still in use.** `trips` vs `agency_routes`+`trip_departures`, `buses`, `locations` vs `admin_stations`, two booking-lifecycle controllers, and the dead `TicketController` and `AdminBusController`.
8. **Destructive cascades.** Deleting a user cascades admin_stations → agency_routes → trip_departures, and also bookings and activity_logs.
9. **Over-broad data exposure.**
   - `/stations` returns agent emails to passengers.
   - Activity logs and `fresh()` responses serialise full user rows.
   - Ticket and contract files live on the public disk.

---

## 4. Design gaps for production (not bugs, but they block launch)

1. **SMS OTP:** the backend now generates and hashes codes behind `SmsSender`, but a real provider (for example Africa's Talking) still needs configuring, and the mobile phone-login flow must be wired to `/auth/otp/request|verify`. Phone normalisation and the per-phone throttle need checking.
2. **Payments:**
   - MTN MoMo, Airtel Money and card collection.
   - A payment record and webhooks.
   - `paid_at`, plus a payment state (`awaiting_payment` → `paid`) before an agent can claim.
   - Refunds and cancellation policy. See `PAYMENT_SYSTEM_PLAN.md`.
3. **Server-authoritative pricing:** compute route price × quantity, the service fee policy, the rental days × rate and the deposit on the server, and return a quote. Remove `price` and `service_fee` from the request.
4. **Inventory:**
   - Dated departures (a departure × date instance).
   - Seat counters with `total_seats`, decremented atomically and released on cancel or expiry.
   - Private-seat capacity.
   - A rental availability calendar.
   - `travel_date` as a real `date` column.
5. **Push notifications:**
   - Register Expo or FCM tokens for every role (a `POST /me/push-token` endpoint).
   - Send on `taken`, `ticket_ready`, `delivered` and `cancelled`, and to agents on new bookings.
   - Delete `TicketController` or reuse its FCM code.
6. **Driver onboarding and KYC:**
   - An application flow that collects licence, insurance, vehicle documents and photos, with uploads to storage.
   - Admin review, then a role change.
   - A persisted driver profile model (the fields `driver/setup.tsx` collects have no columns).
7. **Payout ledger:**
   - Per-booking earnings rows for platform, agent and driver.
   - Cashout processing for superadmins, with an `approved` → `paid` audit trail.
   - Reconciliation.
8. **Contract verification** workflow for agents, and contract template hosting.
9. **Storage:** move tickets, contracts and profile images to private object storage (S3 or R2) with signed URLs. Stop storing base64 images in `users`.
10. **Auth hardening:**
    - Token expiry and rotation (Sanctum `expiration`).
    - Revoke tokens issued to non-admins on admin login.
    - Server-side role gate on the admin UI.
    - Check `email_verified` when linking pre-seeded users by email.
    - Password reset and registration.
    - Throttle on `/track-access`.
    - CORS is `allowed_origins: ['*']`.
    - `.env` has `APP_DEBUG=true`, which must be off in production.
11. **RBAC cleanup:**
    - Enforce or delete the never-checked permissions (create-bookings, view-own-bookings, upload-tickets, view-own-earnings, manage-buses, view-station-analytics, agencies.*, locations.*).
    - Stop relying on role names in code.
    - Decide whether admins really get `manage-agencies` and `manage-locations`.
12. **Station scoping model:** pick one concept (`admin_stations`), then derive the booking's origin station from the departure and scope bookings, analytics and earnings by it.
13. **Data integrity:** soft-delete users, agencies, stations and routes instead of cascade hard-deletes, and keep audit logs immutable. Wrap multi-step writes (for example approve plus location update) in transactions.
14. **Seeders and migrations:** seed `agency_routes.price/duration` and `trip_departures`, drop the legacy `trips` and `buses` usage, and add a migration for `users.location_id` or remove its usages.
15. **Mobile:**
    - Clear the persisted query cache on every logout and account switch.
    - Show a confirm dialog before account deletion.
    - Use a real profile from `/me` instead of Firebase `currentUser`.
    - Persist driver mode or derive it from the role.
    - Remove the dev-mode Google bypass that navigates without a token.
    - Replace the placeholder App Store ID.
    - Translate the hard-coded English admin strings.
    - Remove the dead screens (`buses/*`, `bookings/[id]`) and the unused `components/admin/AdminNavSheet.tsx` (it expects `isOpen`/`close`, which the context does not provide) and `components/LocationPicker.tsx`.
16. **Observability and QA:** structured logs, error tracking (Sentry), backend feature tests for the booking state machine, ownership and permissions, and e2e tests for booking.
17. **Store compliance:** in-app account deletion with confirmation and data-retention rules, privacy policy contacts, and location-permission rationale (Home requests location on mount).
