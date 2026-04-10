# Admin Panel Completion Plan

## Phase 1: Backend — Database & Models

### 1.1 Create `locations` table migration
- [x] Migration: `create_locations_table` with `id`, `name`, `type` (enum: `bus_station`|`custom`), `city`, `address`, `latitude`, `longitude`, timestamps
- [x] Success: `php artisan migrate` runs cleanly, `locations` table exists with correct columns
- [ ] Seed: Populate with initial bus stations (Kigali, Musanze, Huye, etc.)

### 1.2 Create `location_change_requests` table migration
- [x] Migration: `id`, `admin_id` FK → users, `from_location_id` FK → locations, `to_location_id` FK → locations, `status` (enum: `pending`|`approved`|`rejected`), `superadmin_id` FK → users, `approved_at`, timestamps
- [x] Success: Migration runs, table exists

### 1.3 Create `activity_logs` table migration
- [x] Migration: `id`, `admin_id` FK → users, `action` (string), `entity_type` (string), `entity_id` (bigint), `details` (JSON), timestamps
- [x] Success: Migration runs, table exists

### 1.4 Add `location_id` to `bookings` table
- [x] Migration: `alter_bookings_add_location_id` — nullable FK → locations
- [x] Success: Migration runs, column exists

### 1.5 Add profile fields to `users` table
- [ ] Migration: `profile_image_url`, `phone`, `whatsapp_number`, `contract_doc_url`, `contract_verified` (boolean)
- [ ] Success: Migration runs, columns exist

### 1.6 Create `Location` model
- [x] Model: `Location` with `fillable`, `casts`, relations (`admins`, `bookings`)
- [x] Success: `Location` model exists, relations work

### 1.7 Create `LocationChangeRequest` model
- [x] Model: with `fillable`, `casts`, relations (`admin`, `fromLocation`, `toLocation`, `superadmin`)
- [x] Success: Model exists

### 1.8 Create `ActivityLog` model
- [x] Model: with `fillable`, `casts` (details→array), relation (`admin`)
- [x] Success: Model exists

### 1.9 Update `User` model
- [x] Add `location()` relation, `locationChangeRequests()` relation, `activityLogs()` relation, profile fields to fillable
- [x] Success: Relations resolve correctly

### 1.10 Update `Booking` model
- [x] Add `location()` relation, `location_id` to fillable
- [x] Success: Relation resolves correctly

### 1.11 Seed initial locations
- [x] Seeder: Create bus_station locations for Kigali, Musanze, Huye, Rubavu, Nyagatare, Rwamagana, Muhanga, Rusizi
- [x] Success: `php artisan db:seed --class=LocationsSeeder` populates 8 locations

---

## Phase 2: Backend — Controllers & Routes

### 2.1 Create `LocationController` (superadmin)
- [x] `index` — list all locations
- [x] `store` — create location
- [x] `update` — edit location
- [x] `destroy` — delete location (with FK checks)
- [x] Permission: `manage-locations` (added via migration)
- [x] Success: All 4 endpoints work, only superadmin can access

### 2.2 Create `AdminProfileController`
- [x] `show` — get admin profile data
- [x] `update` — update contact info
- [x] `uploadProfileImage` — upload image to local storage
- [x] `uploadContract` — upload contract PDF, resets contract_verified
- [x] Success: Admin can update their own profile

### 2.3 Create `LocationChangeRequestController`
- [x] `store` — admin requests location change
- [x] `index` — superadmin sees pending requests
- [x] `approve` / `reject` — superadmin actions
- [x] Success: Flow works end-to-end, status updates correctly

### 2.4 Create `ActivityLogController`
- [x] `index` — list logs with filters (admin, action, date range)
- [x] Pagination support
- [x] Success: Logs populate automatically, superadmin can filter

### 2.5 Update `BookingController`
- [x] `store` — accept `location_id`, link booking to location
- [x] `claim` — `pending` → `taken` (admin claims it)
- [x] `uploadTicket` — `taken` → `ticket_ready` (admin uploads ticket)
- [x] `deliver` — `ticket_ready` → `delivered` (admin confirms)
- [x] `index` — filter by admin's location
- [x] Success: 4-status flow works, location filtering works

### 2.6 Update `AnalyticsController`
- [x] `earnings` — 50% of service_fee per delivered booking, daily/weekly/monthly breakdown
- [x] `bookings` — by status (4 statuses), by type, daily trend
- [x] `revenue` — total, platform/admin split
- [x] `stations` — per-location breakdown
- [x] Success: All analytics endpoints return correct data

### 2.7 Update routes (`api.php`)
- [x] Wire all new controllers with correct permissions
- [x] Remove bus management routes (admins don't manage buses)
- [x] Add booking lifecycle routes (claim, ticket, deliver)
- [x] Add admin profile routes
- [x] Success: `php artisan route:list` shows all routes correctly

---

## Phase 3: Frontend — Location & Booking Flow

### 3.1 Create `constants/locations.ts`
- [x] `LOCATION_TYPE` enum: `bus_station` | `custom`
- [x] Success: File exists with typed constants

### 3.2 Create location picker component
- [x] LocationPicker component for admin screens (searchable, filters by city/type)
- [x] Success: Component works and fetches from /admin/locations

### 3.3 Update home screen booking flow
- [x] User flow unchanged — picks from/to cities (not admin locations)
- [x] Backend auto-assigns `location_id` from `from` city → bus_station location
- [x] Booking created with correct location
- [x] Success: Booking includes location_id (handled by backend)

### 3.4 Add i18n for location-related strings
- [x] Already covered in existing locale files (no new hardcoded strings added)
- [x] Success: No hardcoded location/booking strings remain

---

## Phase 4: Frontend — Admin Dashboard & Bookings

### 4.1 Update admin dashboard
- [ ] Show admin's assigned location name
- [ ] Earnings summary (today, week, month)
- [ ] Quick stats: pending, taken, ready, delivered counts
- [ ] Remove "Buses" tile (admins don't manage buses)
- [ ] Add "Logs" tile (superadmin only)
- [ ] Success: Dashboard shows location-scoped data

### 4.2 Update admin bookings screen
- [ ] 4 status tabs: Pending, Taken, Ticket Ready, Delivered
- [ ] Claim button (pending → taken)
- [ ] Upload ticket photo (taken → ticket_ready)
- [ ] Mark delivered (ticket_ready → delivered)
- [ ] Location-scoped: only shows bookings for admin's location
- [ ] Success: Full booking lifecycle works

### 4.3 Create logs page `/(admin)/logs`
- [ ] Timeline view of activity logs
- [ ] Filters: by action type, by admin, date range
- [ ] Shows timestamp, admin name, action, details
- [ ] Success: Superadmin sees all activity

### 4.4 Update analytics page
- [ ] Earnings chart (daily/weekly/monthly)
- [ ] Bookings by status breakdown
- [ ] Top routes by volume
- [ ] Service fee earned (50% split)
- [ ] Success: Detailed analytics with charts

### 4.5 Create admin profile screen
- [ ] Upload profile image
- [ ] Edit phone, WhatsApp number
- [ ] Upload contract PDF
- [ ] Show contract verification status
- [ ] Success: Admin can manage their profile

### 4.6 Add i18n for all new admin strings
- [ ] All 4 locales updated
- [ ] Success: Full translation coverage

---

## Success Criteria (Final)
- [ ] Admin can only see/manage bookings for their assigned location
- [ ] Booking flows through 4 statuses correctly
- [ ] Activity logs capture all admin actions with timestamps
- [ ] Superadmin can approve location change requests
- [ ] Dashboard shows earnings (50% of service fee)
- [ ] Analytics page shows detailed breakdowns
- [ ] Admin can upload profile image and contract PDF
- [ ] No bus management in admin panel
- [ ] All strings translated in 4 languages
- [ ] App builds without errors
