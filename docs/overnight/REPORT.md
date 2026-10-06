# Jali — Overnight Report (2026-10-05)

Branch **`overnight-fixes`** (local only, nothing pushed). Base: `main` @ `9e7dd81`.
Supporting docs in this folder:
- `USER_STORIES.md`: 71 user stories mapped by the architect pass.
- `BACKEND_AUDIT.md`: 32 backend findings.
- `MOBILE_AUDIT.md`: 37 mobile findings.

## Verdict

**Not yet ready for production. It is close.**

Everything I could fix in code is fixed and tested: security holes, the broken booking flow, money bugs, broken seeding, and the mobile screens.

What's left needs **your accounts or decisions**: payments, SMS, store builds and a real-phone test. See "Before launch".

## Numbers

| | Before | After |
|---|---|---|
| Backend tests | 6 / 27 passing (stale suite; running it **wiped the DB**) | **94 / 94** (in-memory DB) |
| End-to-end HTTP checks (all roles) | none | **30 / 30** (`backend/tests/e2e/smoke.php`) |
| Composer security advisories | 43 | **0** (Laravel 11 → 12.69) |
| Bus trips searchable on a fresh install | **0** | 148 routes / 1,396 departures |
| Mobile TypeScript errors | 27 | **0** |
| expo-doctor checks | 15 / 18 | **18 / 18** |
| Commits | — | **79** (40 backend/CI/docs, 39 mobile) + 1 merge |

Every commit message explains what was broken, the impact and the fix: `git log 9e7dd81..overnight-fixes`.

## Critical issues fixed (backend)

1. **Login with any password**: Google/phone accounts and pre-provisioned admins accepted any password.
2. **OTP was always `123456`**, in production too. Anyone could log in as any phone number. Now real codes: hashed, single-use, 5 minutes, 5 attempts, rate-limited.
3. **Google sign-in could take over the superadmin account** using an unverified email.
4. **Prices came from the app**. A crafted request booked 10 seats for 1 RWF. The server now computes price, fee, title and location, enforces seat capacity per date, and rejects nonexistent or inactive listings.
5. **Password hashes and push tokens leaked** in API responses.
6. **Running the tests wiped the configured database**, which would be production on a server.
7. **Fresh install had no bookable buses**. The seeder used the legacy `trips` table and set every route's price to 0.
8. **Station admins were not scoped**. They saw and edited every booking, jumped statuses (pending → delivered), double-claimed, deleted any agency nationwide, approved their own location changes, and requested unlimited cashouts.
9. **Deleting an account hard-deleted** that user's bookings, and for a station agent, their terminal with every route through it.
10. **Code needed PHP 8.4 syntax and an 8.3 library** but declared PHP 8.2.
11. **CI never ran the tests, and production deploys had no test gate.** Both are fixed.

Also fixed:
- Push notifications: the app's Expo token is now registered, and passengers get a push on claim, ticket ready and cancel.
- Driver earnings were under-reported by the fee.
- Driver listing dates were unsearchable.
- Admin earnings were always 0.
- Analytics were unscoped.
- Activity logs leaked staff payout accounts.
- Tokens never expired; they now expire after 30 days.
- Ratings were open to anyone.
- A 500 error was returned instead of 401 for guests.
- Plus more listed in the git log.

## Mobile

All fixable findings from MOBILE_AUDIT.md (M-01 to M-37) are fixed. Highlights:

- **Booking:**
  - The app no longer sends its own prices.
  - Rentals send the number of days.
  - Dates are sent as local Y-m-d (`toISOString` had shifted them a day back in UTC+2).
  - Double-tapping "Book" no longer creates duplicate bookings.
  - The rating prompt now appears after booking.
- **Account and session:**
  - Account deletion asks for confirmation.
  - Logout, account deletion and expired tokens wipe the 7-day offline cache, so the next person on the phone no longer sees the previous user's trips.
  - A failed backend call during Google login now counts as a failed login.
- **Roles:**
  - Plain users can no longer open the admin portal.
  - Driver mode only works for the `driver` role.
  - Driver mode now persists across restarts.
- **Drivers:**
  - Creating a listing works; it failed with a 422 on every save.
  - Editing a listing works.
  - Driver setup loads and saves the vehicle details.
- **Admin:**
  - The admin screens use the claim → ticket → deliver flow.
  - Analytics counts bus trips.
  - Cashout requests are capped at the available balance.
  - Changing a user's role works; it silently did nothing before.
  - After any booking action, the dashboard and analytics refresh. I found this one while clicking through.
- **Build:**
  - Dependencies are aligned with Expo SDK 54.
  - EAS auto-increments build numbers.
  - Web console errors are fixed.
  - The dead admin "buses" screens were removed.

**What I tested in the browser** (Expo web against the local API):
- Station admin: login → dashboard → booking queue (only their station's bookings) → claim → deliver → dashboard refreshes → analytics → profile/cashout.
- Superadmin: dashboard, users, stations, activity logs.

**Not tested:**
- The passenger app in the browser, because login needs a real Firebase account. The passenger booking flow is covered by the API end-to-end test.
- Anything on a phone.

**After merging you need a new dev-client/native build.** expo-notifications 0.32, expo-localization 17 and new config plugins were added.

**Removed on purpose:**
- The car-photo picker in driver setup. Photos were never uploaded anywhere; it needs an upload endpoint.
- The passenger "Notifications" menu item, which did nothing.
- The iOS "Rate Jali" item, until an App Store link exists.
- Phone login, now hidden behind `PHONE_LOGIN_ENABLED = false` until SMS exists.

## Before launch — only you can do these

1. **Server PHP ≥ 8.3** (now required).
   - Review and merge `overnight-fixes`.
   - CI now runs the tests on MySQL, and deploy waits for them.
   - New migrations run automatically on deploy.
2. **Production env and passwords:**
   - Set `SEED_ADMIN_PASSWORD` (or note the random one the seeder prints) and `CORS_ALLOWED_ORIGINS`.
   - Keep `APP_DEBUG=false`.
   - **Change every existing admin password.** `Jali@2026` is public in the git history.
3. **Payments**: MoMo, Airtel and card are labels only; no money is collected. This needs merchant accounts; see `PAYMENT_SYSTEM_PLAN.md`.
4. **SMS provider** for phone login:
   - Plug it into `backend/app/Services/SmsSender.php`.
   - Until then `/auth/otp/request` returns 503 in production.
   - Then turn `PHONE_LOGIN_ENABLED` back on in the app.
5. **Firebase service account** at `backend/storage/app/firebase-credentials.json` on the server, for Google sign-in.
6. **Store builds:**
   - Icons must be 1024 px (they're 512/432).
   - Set `APP_STORE_URL` (2 places) once the iOS app exists.
   - CI builds an **APK** signed through the debug-keystore path; the Play Store needs an **AAB** from a store signing config (`eas build --profile production`).
   - Delete the stray root `Jali/app.json` and `Jali/eas.json`; the real ones are in `mobile/`.
7. **Real-phone test**: Google Sign-In, camera/ticket upload, push notifications and location only work on a device.
8. **Decisions:**
   - Tickets and contracts are on the public disk with random names. Do you want private storage with signed URLs?
   - Admin lists (`/admin/users`, `/admin/bookings`) aren't paginated. That's fine at launch scale.
   - Legal pages (Terms, Privacy, FAQ) are English-only and need approved translations.

## How to run locally

```bash
cd backend && composer install && cp .env.example .env && php artisan key:generate
touch database/database.sqlite   # set DB_CONNECTION=sqlite in .env
php artisan migrate:fresh --seed && php artisan test
php artisan serve --port=8091    # then: php tests/e2e/smoke.php http://127.0.0.1:8091/api
```

Local note: this PC has PHP 8.2 (XAMPP). I ran with the missing extensions loaded from a temp ini and the Composer platform check disabled inside `vendor/` only. The production server needs real PHP 8.3+.
