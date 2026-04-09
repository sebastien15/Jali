# Jali Backend ↔ Frontend Integration Plan

## Current Status

The mobile app is **already partially wired** to the Laravel backend. Most GET endpoints are called but need fixes for proper data flow, error handling, and missing fields.

---

## Phase 1: GET APIs (Data Display) — Start Here

### 1.1 Fix Home Screen — Bus/Private/Car Rental Listings
**File:** `mobile/app/(tabs)/index.tsx`

**What's already working:**
- ✅ Already calls `GET /buses?from=...&to=...`
- ✅ Already calls `GET /car-rentals`
- ✅ Already calls `GET /private-seats?from=...&to=...`
- ✅ Data shapes match backend response

**What needs fixing:**
- ❌ `date` filter is NOT sent to API (stored in state but never passed)
- ❌ Silent error handling (`.catch(() => {})`) — user sees empty state with no feedback
- ❌ Loading state doesn't distinguish between "loading" and "error"
- ❌ BusCard hardcodes `+ 200` service fee preview (should use real fee)

**Changes needed:**
```diff
// index.tsx — send date filter
- api.get("/buses", { params: { from, ...(to ? { to } : {}) } })
+ api.get("/buses", { params: { from, ...(to ? { to } : {}), date } })

// index.tsx — add error handling
- .catch(() => {})
+ .catch((err) => {
+   setError(err?.response?.data?.message ?? "Failed to load data");
+   setBuses([]); setCars([]); setPrivate([]);
+ })
```

**Backend check:** ✅ Backend already supports `from`, `to` filters. Need to add `date` filter to `BusController` and `PrivateSeatController`.

---

### 1.2 Fix Trips Screen — Booking History
**File:** `mobile/app/(tabs)/trips.tsx`

**What's already working:**
- ✅ Already calls `GET /bookings`
- ✅ Status filter tabs (all/pending/confirmed/completed)
- ✅ Ticket photo display from `ticket_photo_url`

**What needs fixing:**
- ❌ Silent error handling
- ❌ Trip data typed as `any` — fragile
- ❌ No pull-to-refresh error feedback

**Changes needed:**
```diff
// trips.tsx — add error handling
- catch {}
+ catch (err) {
+   setError("Failed to load trips");
+ }
```

**Backend check:** ✅ Backend `BookingController.index` already returns trips in the exact format mobile expects: `{id, type, title, sub, price, status, ticketPhotoUrl}`.

---

### 1.3 Fix BookingSheet — Create Booking
**File:** `mobile/components/BookingSheet.tsx`

**What's already working:**
- ✅ Already calls `POST /bookings`
- ✅ Sends correct payload: `type`, `reference_id`, `price`, `service_fee`, `payment_method`, `title`, `sub`

**What needs fixing:**
- ❌ Missing `travel_date` field (backend doesn't require it currently, but should be added)
- ❌ `item` typed as `any`

**Backend check:** ⚠️ Backend `BookingController.store` currently auto-generates `title` and `sub` from the referenced item. But mobile already sends them. Need to decide: backend generates OR mobile sends. **Recommendation:** Accept from mobile if provided, otherwise auto-generate.

---

### 1.4 Fix Auth Flow
**File:** `mobile/app/(auth)/login.tsx`

**What's already working:**
- ✅ Google Sign-In calls `POST /auth/login` after Firebase auth
- ✅ Firebase token interceptor attaches token automatically

**What needs fixing:**
- ❌ `.catch(() => {})` swallows backend errors
- ❌ Phone OTP is stubbed ("Coming soon")
- ❌ No feedback if backend is unreachable

**Changes needed:**
```diff
// login.tsx — show error if backend fails
- await api.post("/auth/login").catch(() => {});
+ try {
+   await api.post("/auth/login");
+ } catch (err) {
+   Alert.alert("Connection Error", "Could not connect to server. Please check your connection.");
+ }
```

**Backend check:** ✅ `AuthController.login` already verifies Firebase token, creates/finds user, assigns default `user` role.

---

### 1.5 Add Response Interceptor to API Client
**File:** `mobile/lib/api.ts`

**What's missing:**
- ❌ No response interceptor for 401/403/500 handling
- ❌ No error logging

**Changes needed:**
```ts
// api.ts — add response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired — redirect to login
      router.replace("/(auth)/login");
    } else if (error.response?.status === 403) {
      Alert.alert("Access Denied", "You don't have permission for this action.");
    }
    return Promise.reject(error);
  }
);
```

---

## Phase 2: Driver Features (New Backend Routes Needed)

### 2.1 Drive Screen — Currently 100% Mock Data
**File:** `mobile/app/(tabs)/drive.tsx`

**What needs backend support:**
- ❌ Earnings stats (hardcoded: 47,500 RWF, 8 trips, 4.92 rating)
- ❌ Upcoming rides (hardcoded array)
- ❌ Pickup zones (hardcoded array)
- ❌ Online/offline toggle (local state only)

**New backend routes needed:**
```
GET  /driver/upcoming-rides
GET  /driver/earnings
POST /driver/toggle-online
GET  /driver/zones
POST /driver/zones
```

**Note:** This requires the `driver` role and `admin_stations` table to be meaningful. Defer until Phase 1 is stable.

---

## Phase 3: Profile & User Stats

### 3.1 Profile Screen — Hardcoded Stats
**File:** `mobile/app/(tabs)/profile.tsx`

**What needs fixing:**
- ❌ Trip count hardcoded to "0"
- ❌ Rating hardcoded to "---"
- ❌ Pending count hardcoded to "0"

**Solution:** Use data from `GET /bookings` (already fetched in Trips screen) or add `GET /user/stats` endpoint.

---

## Integration Order (Recommended)

```
Step 1: Fix error handling in Home Screen (index.tsx)     — 30 min
Step 2: Fix error handling in Trips Screen (trips.tsx)     — 15 min
Step 3: Fix error handling in Login (login.tsx)            — 15 min
Step 4: Add response interceptor to api.ts                 — 20 min
Step 5: Add date filter to listing APIs                    — 10 min backend
Step 6: Test all GET endpoints with real data              — 30 min
Step 7: Fix BookingSheet travel_date                       — 15 min
Step 8: Update Profile stats from backend                  — 20 min
```

**Total estimated time: ~2.5 hours**

---

## Backend Readiness Checklist

| Endpoint | Backend Ready | Mobile Calls It | Needs Fix |
|----------|:-------------:|:---------------:|:---------:|
| `POST /auth/login` | ✅ | ✅ | Error handling |
| `GET /buses` | ✅ | ✅ | Add date filter |
| `GET /car-rentals` | ✅ | ✅ | None |
| `GET /private-seats` | ✅ | ✅ | Add date filter |
| `GET /bookings` | ✅ | ✅ | None |
| `POST /bookings` | ✅ | ✅ | Add travel_date |
| `GET /analytics/*` | ✅ | ❌ | Not needed yet |

---

## Data Flow After Integration

```
User opens app
  → Firebase auth check
  → POST /auth/login (create/find user in PostgreSQL)
  → Navigate to Home

Home screen
  → GET /buses?from=Kigali&to=Musanze&date=Today
  → GET /car-rentals
  → GET /private-seats?from=Kigali&to=Musanze&date=Today
  → Display listings

User books a trip
  → POST /bookings {type, reference_id, price, service_fee, payment_method, title, sub}
  → Show success alert

User views trips
  → GET /bookings
  → Display with status tabs (all/pending/confirmed/completed)
  → Show ticket photo if available
```

---

## What to Do First

1. **Start the Laravel server:** `cd backend && php artisan serve`
2. **Update DEV_URL in `mobile/lib/api.ts`** to match your machine's IP
3. **Fix error handling** in the 3 files above (index.tsx, trips.tsx, login.tsx)
4. **Test each GET endpoint** one by one
5. **Verify data displays correctly** in the app
