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
- [ ] Model: `Location` with `fillable`, `casts`, relations (`admins`, `bookings`)
- [ ] Success: `Location` model exists, relations work

### 1.7 Create `LocationChangeRequest` model
- [ ] Model: with `fillable`, `casts`, relations (`admin`, `fromLocation`, `toLocation`, `superadmin`)
- [ ] Success: Model exists

### 1.8 Create `ActivityLog` model
- [ ] Model: with `fillable`, `casts` (details→array), relation (`admin`)
- [ ] Success: Model exists

### 1.9 Update `User` model
- [ ] Add `location()` relation, `locationChangeRequests()` relation, `activityLogs()` relation, profile fields to fillable
- [ ] Success: Relations resolve correctly

### 1.10 Update `Booking` model
- [ ] Add `location()` relation, `location_id` to fillable
- [ ] Success: Relation resolves correctly

### 1.11 Seed initial locations
- [ ] Seeder: Create bus_station locations for Kigali, Musanze, Huye, Rubavu, Nyagatare, Rwamagana, Muhanga, Rusizi
- [ ] Success: `php artisan db:seed --class=LocationsSeeder` populates 8 locations

---

## Phase 2: Backend — Controllers & Routes

### 2.1 Create `LocationController` (superadmin)
- [ ] `index` — list all locations
- [ ] `store` — create location
- [ ] `update` — edit location
- [ ] `destroy` — delete location
- [ ] Permission: `manage-locations`
- [ ] Success: All 4 endpoints work, only superadmin can access

### 2.2 Create `AdminProfileController`
- [ ] `show` — get admin profile data
- [ ] `update` — update contact info, upload profile image, upload contract PDF
- [ ] Upload to Firebase Storage or local storage
- [ ] Success: Admin can update their own profile

### 2.3 Create `LocationChangeRequestController`
- [ ] `store` — admin requests location change
- [ ] `index` — superadmin sees pending requests
- [ ] `approve` / `reject` — superadmin actions
- [ ] Success: Flow works end-to-end, status updates correctly

### 2.4 Create `ActivityLogController`
- [ ] `index` — list logs with filters (admin, action, date range)
- [ ] Auto-log: booking claimed, status changed, location change approved/rejected
- [ ] Success: Logs populate automatically, superadmin can filter

### 2.5 Update `BookingController`
- [ ] `store` — accept `location_id`, link booking to location
- [ ] `claim` — `pending` → `taken` (admin claims it)
- [ ] `uploadTicket` — `taken` → `ticket_ready` (admin uploads ticket)
- [ ] `deliver` — `ticket_ready` → `delivered` (admin confirms)
- [ ] `index` — filter by admin's location
- [ ] Success: 4-status flow works, location filtering works

### 2.6 Update `AnalyticsController`
- [ ] `earnings` — 50% of service_fee per completed booking, daily/weekly/monthly breakdown
- [ ] `bookings` — by status, by route, conversion rate
- [ ] `revenue` — total, by location, trend data
- [ ] Success: All analytics endpoints return correct data

### 2.7 Update routes (`api.php`)
- [ ] Wire all new controllers with correct permissions
- [ ] Remove bus management routes (admins don't manage buses)
- [ ] Success: `php artisan route:list` shows all routes correctly

---

## Phase 3: Frontend — Location & Booking Flow

### 3.1 Create `constants/locations.ts`
- [ ] `LOCATION_TYPE` enum: `bus_station` | `custom`
- [ ] Success: File exists with typed constants

### 3.2 Create location picker component
- [ ] Replace city picker with location picker (from/to)
- [ ] Searchable, shows city + address
- [ ] Success: Component works in home screen

### 3.3 Update home screen booking flow
- [ ] User selects from/to locations (not just cities)
- [ ] Selects departure time
- [ ] Selects company/agency
- [ ] Does NOT select specific bus
- [ ] Creates booking with `location_id`
- [ ] Success: Booking created with correct location

### 3.4 Add i18n for location-related strings
- [ ] All 4 locales updated
- [ ] Success: No hardcoded location/booking strings remain

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
