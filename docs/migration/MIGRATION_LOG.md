# Architecture migration log

Runbook: [ARCHITECTURE_MIGRATION_RUNBOOK.md](../ARCHITECTURE_MIGRATION_RUNBOOK.md). One entry per task, newest last.

## M00 — Baseline and scope

- Selected scope: **A — structural migration (M00–M04)**, plus M05 (session) if it needs no product decision. No new service functionality, no public activation, no tab redesign. Scope C/D not authorised.
- Execution authority: owner (sebastien15) authorised a non-stop run on branch `refactor/architecture-migration`, a PR into `develop`. No merge to `main` (merging to `main` deploys the backend). Data is seed-only.
- Baseline SHA: `e3c637295f64f3cc66037f15c2401f55712fa99a` (`develop` == `main` after PR #1).
- Drift since the runbook audit (`ea4f9b1`): PR #1 merged. Two runbook prerequisites are already fixed on baseline:
  - Email login rejects accounts without a password (`AuthController::login`, `AuthTest::test_login_to_passwordless_account_is_rejected`).
  - `GET /bookings` returns only the caller's own bookings; driver passengers live in `/driver/trips` (`BookingController::index`).
  - Push is `App\Services\PushService` only (PushNotifier removed); OTP is `App\Services\Auth\OtpService`; driver profile lives in `driver_profiles` + `vehicles`.
- Route inventory: `routes-baseline.json` (`php artisan route:list --path=api --json`, 168 routes). Every later task must keep this list identical (URI, method, action, middleware) unless the task says otherwise.
- Backend tests at baseline (local PHP 8.4, SQLite memory): 215 passed, 8 failed — all 8 need the GD extension (`UploadedFile::fake()->image`), which the local PHP lacks; CI (PHP 8.3) passes them.
- Mobile: `npm run typecheck` clean. No mobile unit-test harness exists.

## M01 — Test safety, characterization and boundary scaffolding (backend)

- Status: implemented (local only, not pushed). Scope A. Baseline `e73eb86`; implementation `3c4be69`.
- Added:
  - `backend/tests/Feature/Architecture/RouteInventoryTest.php` — live `route:list --path=api --json` must equal `docs/migration/routes-baseline.json` (method, uri, action, middleware). Verified it fails on an added probe route.
  - `backend/tests/Feature/Architecture/ModuleBoundaryTest.php` + reviewed manifest `backend/app/Modules/boundaries.php` — files under `app/Modules/<X>` may reference `App\Modules\<Y>` only via `<Y>\Contracts\` with Y allowed for X; no `App\Http\Controllers` references; every module folder needs a manifest entry. A self-test with a fixture tree proves detection; also verified with a temporary violating file in `app/Modules` (removed).
  - `backend/tests/Feature/LegacyBookingParityTest.php` — generic `/bookings` create/list for `rental` and `private`: exact 201 bodies, server-side price/fee/title, caller-only ownership (client `user_id` ignored), double-booking/overbooking 422, inactive 404, invalid date 422, list shape/status filter, someone else's booking 403, listing owner does not see customer bookings in `/bookings`.
  - `backend/tests/Feature/OwnerListingsParityTest.php` — `/driver/cars` CRUD with `priceDay`↔`price`, cannot update/delete another driver's car (404), validation/permission; `/driver/listings` list/update/delete own, invalid date body.
- Behaviour changes / bugs: none found; all characterization tests passed against baseline code.
- Commands: `php artisan test` → 230 passed, 8 failed (the same 8 GD-only failures as M00).
- Not done here: separate isolated MySQL test configuration (runbook §8) and the mobile harness — outside this backend task.

## M02 — Shared contracts, seams and LegacyBookings dispatcher (backend)

- Status: implemented (local only, not pushed). Scope A. Commits `a6312ac` (moves + contracts), `dd9e8fa` (LegacyBookings).
- Old → new (old files deleted, every reference updated, no aliases left):
  - `App\Services\Rides\{DriverEligibility,DriverOnboarding,DriverRating}` → `App\Modules\Providers\Application\*`
  - `App\Services\Rides\RideSettings` → `App\Modules\Pricing\Application\RideSettings` (key `platform_settings['rides']` and all defaults byte-identical)
  - `App\Services\Payments\DriverLedger`, `App\Services\Receipts\Receipts`, `App\Services\Fx\ExchangeRates` → `App\Modules\Payments\Application\*`
  - `App\Services\Rides\{GeoService,PlaceSearch}` → `App\Modules\Locations\Application\*`
  - `App\Services\Sms\SmsService` → `App\Modules\Notifications\Infrastructure\SmsService`
  - `App\Services\Auth\OtpService` → `App\Modules\Identity\Application\OtpService`
  - `App\Services\Safety\SafetyService` → `App\Modules\Safety\Application\SafetyService`
  - `BookingController` create/list logic → `App\Modules\LegacyBookings\Application\BookingDispatcher` (+ `BookingRejected`), handlers `LegacyBookings\Infrastructure\{Bus,PrivateSeat,Rental,TripDeparture}BookingHandler`.
- Contracts (bound in `AppServiceProvider::register`): `Pricing\Contracts\PricingPolicy` → RideSettings; `Payments\Contracts\MoneyRecorder` and `ProviderDebtLimit` → DriverLedger; `Providers\Contracts\ProviderReputation` → DriverRating; `Notifications\Contracts\SmsSender` → SmsService; `LegacyBookings\Contracts\{BookingTypeHandler,BookingRequest,BookableOffer}` (handlers tagged, injected into the dispatcher).
- Allowed dependencies (`boundaries.php`): Identity→Notifications, Safety→Notifications, Locations→Pricing, Payments→Pricing, Providers→Payments; others none. RideService/HireService now call `MoneyRecorder` and `ProviderReputation` instead of the concrete classes.
- Preserved: all 168 API routes/middleware (RouteInventoryTest + CLI JSON compare identical), model namespaces/tables, schema, responses/status codes/validation messages, one writer per operation (dispatcher is the only generic-booking writer; DriverLedger the only ledger writer). `App\Services\PushService` and its lazy binding untouched. Scheduled commands and `fx:refresh` schedule unchanged (closure now resolves the moved ExchangeRates).
- Commands: `composer dump-autoload -n` (≈2 min locally; `-q` appeared to hang), `php -l` on changed files, `php artisan test` → 230 passed, 8 failed (GD-only), `php artisan route:list --path=api --json` vs baseline → identical (168/168). The intermediate commit `a6312ac` was tested on its own (same result).
- Known gaps / next:
  - `NearbyDrivers::displayName` is still used by SafetyService, HireController and HirePresenter; left in `app/Services/Rides` for M03-Rides to split into a generic display contract.
  - No `ProviderEligibility` contract: its only caller outside Providers is `DriverPresenceController`.
  - `app/Services/{Rides,Hire}` and controllers still call `RideSettings` statics and `Receipts::email` directly; they adopt `PricingPolicy` as they move in M03. `RideSettings::update()/rules()` remain the admin write path.
  - `MoneyRecorder` duplicate protection is the existing unique ledger index (sequential retries only, no exactly-once claim).
  - Rental/private/bus/trip handlers live in `LegacyBookings\Infrastructure` until M03-Rental/Shared/Bus move them and register them from their owner module.
- Next authorised task: M03-Rental.

## M03-Rental — Rental logic → `Modules/Rentals` (backend)

- Status: implemented (local only, not pushed). Scope A. Base `e920d37`; implementation `e191d1a`.
- Old → new:
  - `CarRentalController` catalogue query → `App\Modules\Rentals\Application\RentalCatalogue::available`
  - `CarRentalController` owner CRUD (`/driver/cars/**`, incl. `priceDay` → `price` on create/update) → `Rentals\Application\OwnerFleet`
  - `CarRentalController::toFrontend` (`price` → `priceDay`) → `Rentals\Application\RentalCarPresenter::toFrontend`
  - `LegacyBookings\Infrastructure\RentalBookingHandler` → `Rentals\Infrastructure\RentalBookingHandler` (implements `LegacyBookings\Contracts\BookingTypeHandler`; still registered through the `BookingTypeHandler` container tag in `AppServiceProvider`, the dispatcher's existing mechanism).
  - `CarRentalController` keeps request validation (same rules/messages) and the HTTP shape only; ownership lookup still runs before validation on PATCH (404 before 422).
- Boundaries: `Rentals => [LegacyBookings]` (handler contract only). LegacyBookings depends on no service module; services register themselves.
- Preserved: 168 routes/middleware (RouteInventoryTest), `car_rentals` table and `App\Models\CarRental`, public catalogue raw shape (no `priceDay`), owner shape (`priceDay` added), rental booking price/fee/title/availability rules, one writer per operation (OwnerFleet for cars, BookingDispatcher for bookings). Rental cars stay separate from driver `Vehicle`s (no shared IDs, no plate merge).
- Tests: new `tests/Feature/CatalogueParityTest.php` (type filter, active+available only, price order, unmapped shape) — verified green against the pre-move controller first. Existing parity reused: `LegacyBookingParityTest` (rental booking), `OwnerListingsParityTest` (`/driver/cars` CRUD/ownership/validation), `ListingsTest` (status/notes).
- Commands: `composer dump-autoload -n`, `php -l` on changed files, `php artisan test` → 231 passed, 8 failed (GD-only); grep for `LegacyBookings\Infrastructure\RentalBookingHandler` → none.
- CarRental status/notes (runbook §2 row): **now persisted** — migration `2026_10_05_000003_add_notes_and_status_to_listings` added `car_rentals.status` (default `available`) and `notes`; both are fillable and `ListingsTest::test_car_status_is_saved_and_unavailable_cars_are_hidden_and_unbookable` proves PATCH saves them, the catalogue hides non-available cars and booking returns 404.
- Launch gate (unchanged): rental reservation/status lifecycle is incomplete — status is an owner-set flag only; bookings do not move a car to `rented`, there is no date-range reservation calendar (only same-travel-date capacity of 1 in the dispatcher), and no return/maintenance flow. Do not declare rental booking launch-ready.
- Next authorised task: M03-Shared (dependency adjustment below).

## M03-Shared — Private-seat logic → `Modules/SharedJourneys` (backend)

- Status: implemented (local only, not pushed). Scope A. Implementation `4a58ca0`.
- Dependency adjustment: the runbook ledger orders M03-Shared after M03-Hire. SharedJourneys has no technical dependency on DriverHire (no shared code, contracts or tables), so it was done directly after M03-Rental. M03-Hire is still pending and unaffected; the public sequence is otherwise unchanged.
- Old → new:
  - `PrivateSeatController::index` query → `App\Modules\SharedJourneys\Application\SeatCatalogue::search`
  - `PrivateSeatController` owner CRUD (`/driver/listings/**`) → `SharedJourneys\Application\OwnerListings`; invalid date → `InvalidListingDate`, mapped by the controller to the same 422 body
  - `PrivateSeatController::normalizeDate` (public static, no other callers) → `SharedJourneys\Application\ListingDate::normalize`
  - `DriverController::{stats,trips}` + private `listingBookings` → `SharedJourneys\Application\ListingActivity::{stats,trips}`; DriverController delegates. Inspection: both endpoints read **only** `type=private` bookings on the driver's own `PrivateSeat` listings — no rental (or ride/hire) data is mixed in — so no cross-module read contract or composition was needed.
  - `LegacyBookings\Infrastructure\PrivateSeatBookingHandler` → `SharedJourneys\Infrastructure\PrivateSeatBookingHandler` (tagged as before).
- Boundaries: `SharedJourneys => [LegacyBookings]` (handler contract only).
- Preserved: routes/middleware, `private_seats` table/model, paginated catalogue envelope (10/page, `dep` order, undated listings match every date, unparseable `date` filter ignored), validation rules/messages, 404-before-422 on PATCH, stats/trips JSON (fields, cancelled excluded from stats but listed in trips, status mapping), private booking price/fee clamp/title.
- Tests: new `tests/Feature/ListingActivityParityTest.php` (stats today/week/rating with cancelled, other-type and other-driver exclusions; zero-listing driver; exact trips shape/order/status; catalogue filters/order/pagination) — verified green against the pre-move controllers first. Reused: `DriverTest`, `ListingsTest`, `OwnerListingsParityTest`, `LegacyBookingParityTest`.
- Commands: `composer dump-autoload -n`, `php -l` on changed files, `php artisan test` → 235 passed, 8 failed (GD-only); grep for the old handler path and `normalizeDate` → none.
- Known gaps / launch gates: no stop/segment capacity exists (`seats` is per listing and per travel date) — nothing here implies intermediate stops. `/driver/stats` `rating` is the average of listing ratings, not the provider reputation contract; unchanged.
- Remaining in `LegacyBookings\Infrastructure`: `BusBookingHandler`, `TripDepartureBookingHandler` (M03-Bus).
- Next authorised task: M03-Hire.

## M03-Hire — Hire logic → `Modules/DriverHire` (backend)

- Status: implemented (local only, not pushed). Scope A. Base `ee9951d`; parity tests `7a77b60`; implementation `ae0425d`.
- Old → new (old files deleted, `App\Services\Hire` no longer exists):
  - `App\Services\Hire\{HireService,HireQuote,HireAvailability,HirePresenter}` → `App\Modules\DriverHire\Application\*`
  - `HireController::available` query + `store` bookable-driver check → `DriverHire\Application\HireDriverSearch`; `startAt` + `max_days` → `HireBookingWindow`
  - `HireController::{index,mine}`, `DriverHireController::index` (incl. lazy expiry) → `HireQueries::{customerPage,participantHire,driverHires}`; cancel-reason choice → `HireService::cancelReasons`
  - `DriverHireSettingsController` (`/driver/hire-settings`, `/driver/availability`): provider 403 checks + settings write/payload → `HireProviderSettings` (`LANGUAGES` moved here); calendar write/payload → `HireCalendar`
  - `ExpireHireRequests` loop → `HireService::expireOverdue()`; command name, output and every-minute schedule unchanged.
  - Controllers keep validation rules/messages and HTTP shape only; ordering kept (403 before 422, validation before 404 where it was).
- New contracts (bound in `AppServiceProvider`): `Providers\Contracts\ProviderDisplay` → `Providers\Application\DisplayName` (the pure "Jean H." helper moved out of `NearbyDrivers`; `NearbyDrivers::displayName` now delegates for ride callers); `Payments\Contracts\ReceiptMailer` → `Receipts` (instance `emailReceipt` delegates to the static `email`).
- Shared ports now used by hire: `PricingPolicy::hireSettings()` (replaces `RideSettings::hire()`), `MoneyRecorder`, `ReceiptMailer`, `ProviderReputation`, `ProviderDisplay`. Safety switched from `NearbyDrivers::displayName` to `ProviderDisplay`.
- Boundaries: `DriverHire => [Payments, Pricing, Providers]`, `Safety => [Notifications, Providers]`. `ModuleBoundaryTest` gained a check that no file under `app/Modules` references `App\Services\Rides\*`.
- Preserved: 168 routes/middleware (RouteInventoryTest), `driver_hires`/`driver_hire_settings`/`driver_availability`/`hire_ratings` tables and models, hire states, `rate_snapshot`/fee/commission locking, Kigali calendar rules, push `screen,id` payloads, response bodies/status codes/messages, one writer per operation (HireService for lifecycle, HireProviderSettings/HireCalendar for setup, DriverLedger via MoneyRecorder for money).
- Tests: new `tests/Feature/Hire/HireParityTest.php` (locked price/rates/fee/commission after admin + driver changes, overtime grace and late check-in shift, Kigali-time weekly hours/blocked dates for UTC and +02:00 inputs, day-booking end and dropped seconds, expiry at start-or-timeout and lazy expiry on customer/driver reads, transition guard messages, per-side privacy, 90-day/max-days/self-hire/transmission/customer-clash rules, hire completion feeding `ProviderDebtLimit`) — green against pre-move code first. `HireDriverTest` unchanged and green.
- Commands: `composer dump-autoload -n`, `php -l` on changed files, `php artisan test` → 244 passed, 8 failed (GD-only); grep `Services\Hire` in app/routes/tests/config/database → none; grep `Services\Rides|NearbyDrivers|RideSettings` in `app/Modules/DriverHire` and `app/Modules/Safety` → none.
- Known gaps: HireService still constructs `App\Services\PushService` directly (no Notifications push contract yet, as in M02). Hire/ride overlap (a provider online for rides while holding an accepted hire) is still unchecked — needs the shared availability/conflict port before simultaneous offering (runbook §4). Concurrency of accept/check-out remains guarded only by conditional updates on SQLite; not exercised on MySQL.
- Next authorised task: M03-Rides.

## M03-Rides — Ride logic → `Modules/NearbyRides` (backend)

- Status: implemented (local only, not pushed). Scope A. Base `426705b`; parity tests `d9eef6e`; implementation `3340bb6`.
- Old → new (old files deleted, `app/Services/Rides` no longer exists; `app/Services` now holds only `PushService`):
  - `App\Services\Rides\{FareService,NearbyDrivers,RateGuardrails,RidePresenter,RideService}` → `App\Modules\NearbyRides\Application\*`. RateGuardrails is ride-only (hire limits live in `HireQuote::rateRules`), so it belongs to NearbyRides, not Pricing.
  - `RideController` reads (`index`, `active`, `show` + lazy expiry, participant lookup) and `DriverRideController` (request cards, offered/assigned lookups) → `NearbyRides\Application\RideQueries`; lazy expiry → `RideService::expireIfLate`
  - `DriverPresenceController` → `DriverPresenceSwitch` (only writer of `driver_presence`); `ExpireDriverPresence` query → `DriverPresenceSwitch::expireStale()`
  - `ExpireRideRequests` loop → `RideService::expireOverdue()`; both command names, outputs and every-minute schedules unchanged
  - `DriverRateController` → `DriverRates`; `RideChatController` (incl. `containsContactInfo`) → `RideChat`; `Admin\AdminRideController` → `AdminRides` (+ `RideNotAdjustable`, mapped to the same 409 body); `Admin\RideAnalyticsController` → `RideAnalytics`
  - `Admin\RideSettingsController` write (unknown-class filter, `RideSettings::update`, revalidation, activity log) → `Pricing\Application\RideSettingsAdmin`, the single write path for `platform_settings['rides']`. Revalidation side effect unchanged: same order (save → flag/clear + push → log with `drivers_flagged`), now reached through a Pricing port that NearbyRides implements.
  - Controllers keep permission checks, validation rules/messages and HTTP shape only; ordering kept (404 lookup before validation where it was, 403 before 422).
- Not moved (inspected): `DriverEarningsController`, `Admin\AdminSettlementController` — ledger/earnings/settlements across rides and hires, owned by Payments (separate task). `App\Services\PushService` and its lazy binding untouched; ride classes still construct it directly.
- New contracts (bound in `AppServiceProvider`): `Locations\Contracts\Geography` → `Locations\Application\Geography` (road/straight km, short place name); `Providers\Contracts\ProviderEligibility` → `DriverEligibility`; `Pricing\Contracts\ProviderRateRevalidator` → `NearbyRides\Application\RateGuardrails`. `Payments\Contracts\MoneyRecorder` gained `adjust()` (admin commission correction; existing `DriverLedger::adjust`). Rides now use `PricingPolicy`, `ReceiptMailer` and `ProviderDisplay` instead of `RideSettings`/`Receipts`/`DisplayName` statics.
- Boundaries: `NearbyRides => [Locations, Payments, Pricing, Providers]`. `ModuleBoundaryTest`'s ride-internals check replaced by: `app/Services/Rides` must not exist and nothing in app/routes/config/database/bootstrap references `App\Services\Rides\*`.
- Preserved: 168 routes/middleware (RouteInventoryTest), `rides`/`ride_dispatches`/`ride_events`/`ride_ratings`/`ride_messages`/`driver_rates`/`driver_presence` tables and models, ride states, rate/fee/commission snapshots, append-only events, PIN/phone/location/MoMo visibility rules, push `screen,id` payloads, response bodies/status codes/messages, one writer per operation (RideService lifecycle, DriverPresenceSwitch presence, DriverRates rates, RideSettingsAdmin settings, DriverLedger via MoneyRecorder money).
- Tests: new `tests/Feature/Rides/RideParityTest.php` (locked fare/fee/commission after admin price changes incl. ledger, PIN/phone/MoMo/location visibility per side and status, other drivers 404, event types/actors/payloads for request/accept/wrong PIN/cancel/decline/expiry/broadcast, dispatch row states, `rides:expire-requests`/`rides:expire-presence` output and TTL boundary, settings save → `drivers_flagged` log, unknown class dropped, out-of-band hidden from nearby, loosening clears flag) — green against pre-move code first. Existing `tests/Feature/Rides/*`, `FareServiceTest`, Safety/International/Payments ride flows unchanged and green (only imports updated).
- Commands: `composer dump-autoload -n`, `php -l` on changed files, `php artisan test` → 251 passed, 8 failed (GD-only); grep `Services\Rides` in app/routes/config/database/bootstrap/tests → only the boundary test's own guard.
- Known gaps / risks:
  - Concurrency: accept/decline/transition rely on conditional updates; broadcast accept checks `driverBusy` before its conditional update, so one driver could win two broadcasts accepted at the same instant. PIN attempts use `increment` then compare (two parallel wrong PINs may both pass the count check). Not exercised on MySQL.
  - Retries: request/cancel/complete are not idempotent per client attempt (no request key); a retried POST /rides after a timeout is rejected as "already have an active ride" rather than returning the original. Push/receipt run after commit and are not retried. Ledger duplicate protection is the existing unique index (sequential retries only).
  - Ride/hire overlap (online for rides while holding an accepted hire) is still unchecked (needs the shared availability port).
  - `context.md` still names `Services/Rides/RideService.php` (historical doc, not changed here).
- Next authorised task: M03-Bus.
