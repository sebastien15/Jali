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
