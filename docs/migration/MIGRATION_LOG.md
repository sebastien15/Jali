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
