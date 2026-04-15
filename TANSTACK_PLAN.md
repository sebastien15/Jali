# TanStack Query Migration Plan

> Goal: Replace all manual `useEffect` + `useState` fetch patterns with TanStack Query.
> Target: 5000+ concurrent users. Zero over-fetching. Instant screen re-entry.
> Track progress by checking off each item below.

---

## Root Cause Problems Being Fixed

1. **Home screen over-fetching** — `fetchAll()` fires `/trips` + `/car-rentals` + `/private-seats` on every `from`/`to`/`date` change, regardless of active tab
2. **AdminNavContext re-fetches `/me` on every mount** — no cache, hits the server every admin screen navigation
3. **No cached data anywhere** — every navigation is a cold network request

---

## Phase 1 — Foundation (do this first, app still works identically after)

- [ ] Install packages
  ```bash
  cd mobile && npx expo install @tanstack/react-query @tanstack/react-query-persist-client @tanstack/query-async-storage-persister
  ```

- [ ] Create `mobile/lib/queryClient.ts`
  ```ts
  import { QueryClient } from "@tanstack/react-query";

  export const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,           // 30s floor — screens override upward
        gcTime: 5 * 60 * 1000,       // 5 min in-memory after unmount
        retry: 2,
        refetchOnWindowFocus: false, // RN modals/sheets cause false focus events
        refetchOnReconnect: true,    // OfflineBanner already signals this
      },
      mutations: {
        retry: 0,                    // mutations are not idempotent
      },
    },
  });
  ```

- [ ] Create `mobile/lib/queryKeys.ts` — all query key factories
  ```ts
  export const queryKeys = {
    me: () => ["me"] as const,
    adminProfile: () => ["adminProfile"] as const,

    trips: {
      all: () => ["trips"] as const,
      search: (from?: string, to?: string, date?: string) =>
        ["trips", "search", { from, to, date }] as const,
    },
    carRentals: {
      all: () => ["carRentals"] as const,
    },
    privateSeats: {
      all: () => ["privateSeats"] as const,
      search: (from?: string, to?: string, date?: string) =>
        ["privateSeats", "search", { from, to, date }] as const,
    },
    stations: {
      all: () => ["stations"] as const,
      public: () => ["stations", "public"] as const,
    },
    bookings: {
      mine: () => ["bookings", "mine"] as const,
    },
    driver: {
      stats: () => ["driver", "stats"] as const,
      trips: () => ["driver", "trips"] as const,
      listings: () => ["driver", "listings"] as const,
      cars: () => ["driver", "cars"] as const,
    },
    admin: {
      bookings: (filter?: string) => ["admin", "bookings", { filter }] as const,
      users: () => ["admin", "users"] as const,
      user: (id: string) => ["admin", "users", id] as const,
      stations: () => ["admin", "stations"] as const,
      buses: () => ["admin", "buses"] as const,
      bus: (id: string) => ["admin", "buses", id] as const,
      agencies: () => ["admin", "agencies"] as const,
      trips: (filters?: object) => ["admin", "trips", filters] as const,
      logs: (action?: string) =>
        ["admin", "logs", { action }] as const,  // no page — useInfiniteQuery manages cursor internally
      locations: () => ["admin", "locations"] as const,
      analytics: {
        revenue: () => ["admin", "analytics", "revenue"] as const,
        bookings: () => ["admin", "analytics", "bookings"] as const,
        earnings: () => ["admin", "analytics", "earnings"] as const,
        stations: () => ["admin", "analytics", "stations"] as const,
      },
    },
  };
  ```

- [ ] Wrap `mobile/app/_layout.tsx` with `PersistQueryClientProvider`
  ```tsx
  import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
  import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
  import AsyncStorage from "@react-native-async-storage/async-storage";
  import { queryClient } from "@/lib/queryClient";

  const persister = createAsyncStoragePersister({
    storage: AsyncStorage,
    throttleTime: 1000,
  });

  // Wrap existing tree:
  // SafeAreaProvider
  //   PersistQueryClientProvider   ← replaces QueryClientProvider
  //     client={queryClient}
  //     persistOptions={{ persister, maxAge: 24 * 60 * 60 * 1000 }}
  //     I18nWrapper
  //       Stack + OfflineBanner
  // Cache survives app restart for 24h — users see data instantly on reopen
  ```

---

## Phase 2 — Login Mutations

- [ ] `mobile/app/(auth)/login.tsx`
  - Wrap `api.post("/auth/login")` and `api.post("/auth/login/google")` in `useMutation`
  - `onSuccess`: call `setApiToken(token)` then `router.replace("/(tabs)")`
  - `onError`: set error state from `error.response.data.message`
  - No query keys involved — login produces a token, not cached data

- [ ] `mobile/app/(admin)/admin-login.tsx`
  - Wrap `api.post("/auth/login")` in `useMutation`
  - `onSuccess`: `setApiToken(token)` → `refetch()` → `router.replace("/(admin)/dashboard")`
  - After logout: `queryClient.clear()` wipes everything so next admin starts fresh

> **Screens with no API calls — skip entirely:**
> - `(tabs)/profile.tsx` — reads Firebase `auth.currentUser` directly, no API
> - `driver/setup.tsx` — static onboarding card
> - `app/index.tsx` — token check + redirect only
> - `legal/[doc].tsx` — static content

---

## Phase 3 — AdminNavContext (highest impact after login, one file)

- [ ] Migrate `mobile/components/admin/AdminNavContext.tsx`
  - Replace `fetchUser()` / `useEffect` / `mountedRef` with `useQuery`
  - `queryKey: queryKeys.me()`
  - `staleTime: Infinity` — role never changes mid-session
  - `enabled: tokenReady` — gate on AsyncStorage token existing
  - Expose `refetch` as `() => queryClient.invalidateQueries({ queryKey: queryKeys.me() })`
  - In `handleLogout`: call `queryClient.clear()` before navigating — clears all cached data so next admin session starts fresh

---

## Phase 4 — Home Screen Over-Fetching Fix

- [ ] Migrate `mobile/app/(tabs)/index.tsx`
  - **Remove** `fetchAll()` and the `useEffect([from, to, selectedDate])`
  - **Add 3 independent `useQuery` calls with `enabled` gates:**

  | Query | enabled condition | staleTime |
  |---|---|---|
  | `queryKeys.trips.search(from?.id, to?.id, date)` | always | 60s |
  | `queryKeys.carRentals.all()` | `mode === "rental"` | 10 min |
  | `queryKeys.privateSeats.search(from?.city, to?.city, date)` | `mode === "private"` | 60s |

  - Result: switching tabs no longer triggers unrelated network calls
  - After booking: `invalidateQueries(queryKeys.trips.all())` + `invalidateQueries(queryKeys.bookings.mine())`

---

## Phase 5 — User Screens

- [ ] `mobile/app/(tabs)/trips.tsx`
  - `useQuery({ queryKey: queryKeys.bookings.mine(), staleTime: 60_000 })`
  - `RefreshControl refreshing={isRefetching} onRefresh={refetch}`
  - Remove `const [refreshing, setRefreshing] = useState(false)`

- [ ] `mobile/app/(tabs)/drive.tsx`
  - Driver stats: `queryKeys.driver.stats()` — staleTime 2 min
  - Driver trips: `queryKeys.driver.trips()` — staleTime 60s
  - Driver cars: `queryKeys.driver.cars()` — `enabled: isRental` — staleTime 5 min
  - Driver listings: `queryKeys.driver.listings()` — `enabled: !isRental` — staleTime 5 min

---

## Phase 6 — Admin Screens

- [ ] `(admin)/dashboard.tsx`
  - `queryKeys.admin.analytics.earnings()` — staleTime 2 min
  - `queryKeys.admin.analytics.bookings()` — staleTime 2 min
  - `queryKeys.adminProfile()` — staleTime Infinity

- [ ] `(admin)/analytics/index.tsx`
  - Revenue, bookings, earnings, stations — all staleTime 2 min
  - Keys shared with dashboard → free deduplication, no double fetch

- [ ] `(admin)/bookings/index.tsx`
  - `queryKeys.admin.bookings(statusFilter)` — staleTime 30s
  - After status change mutation: `invalidateQueries(["admin", "bookings"])` (prefix clears all filter variants)

- [ ] `(admin)/bookings/[id].tsx`
  - Booking detail from list cache (no extra fetch if already in cache)
  - Mutation `onSuccess`: `invalidateQueries(["admin", "bookings"])`

- [ ] `(admin)/users/index.tsx` + `(admin)/users/[id].tsx`
  - `queryKeys.admin.users()` — staleTime 5 min
  - `queryKeys.admin.user(id)` — staleTime 5 min
  - After edit: `invalidateQueries(["admin", "users"])` clears both list + detail

- [ ] `(admin)/stations/index.tsx`
  - `queryKeys.admin.stations()` — staleTime 10 min
  - After CRUD: `invalidateQueries(queryKeys.admin.stations())`

- [ ] `(admin)/buses/index.tsx` + `(admin)/buses/[id].tsx`
  - `queryKeys.admin.buses()` + `queryKeys.admin.bus(id)` — staleTime 10 min
  - After CRUD: `invalidateQueries(["admin", "buses"])`

- [ ] `(admin)/agencies/index.tsx`
  - `queryKeys.admin.agencies()` — staleTime 5 min
  - `queryKeys.stations.public()` — staleTime 10 min (shared with trips screen)
  - After add/remove route or delete: invalidate `agencies` + `["admin", "trips"]`

- [ ] `(admin)/trips/index.tsx`
  - `queryKeys.admin.trips({ agency_id, active })` — staleTime 2 min
  - `queryKeys.admin.agencies()` — shared, already cached
  - `queryKeys.stations.public()` — shared, already cached
  - After CRUD: `invalidateQueries(["admin", "trips"])` + `invalidateQueries(queryKeys.admin.agencies())`

- [ ] `(admin)/logs/index.tsx`
  - Use `useInfiniteQuery` (not `useQuery`) — maps to existing `page`/`hasMore` pattern
  - `queryKeys.admin.logs(actionFilter)` — staleTime 30s (no page in key — cursor managed internally)

- [ ] `(admin)/profile/index.tsx`
  - `queryKeys.adminProfile()` — staleTime 10 min (less than Infinity here — profile edits should reflect quickly)
  - After `PATCH`: `invalidateQueries(queryKeys.adminProfile())`

- [ ] `(admin)/locations/index.tsx`
  - `queryKeys.admin.locations()` — staleTime 10 min
  - After CRUD: `invalidateQueries(queryKeys.admin.locations())`

---

## Phase 7 — Driver Screens

- [ ] `driver/fleet.tsx`
  - `queryKeys.driver.cars()` — staleTime 5 min
  - After save/delete: `invalidateQueries(queryKeys.driver.cars())`

- [ ] `driver/listing.tsx`
  - `queryKeys.driver.listings()` — staleTime 5 min
  - After save/delete: `invalidateQueries(queryKeys.driver.listings())`

---

## staleTime Reference

| Data type | staleTime | Reason |
|---|---|---|
| `/me`, role, permissions | `Infinity` | Never changes mid-session |
| Stations, buses, car rentals | 10 min | Admin edits only — not user-triggered |
| Agencies, locations | 5–10 min | Infrequent changes |
| Analytics, driver stats | 2 min | Dashboards — informational |
| Trip availability, seats | 60s | Seat counts change as others book |
| Admin bookings list | 30s | Admins actively process these |
| Logs (paginated) | 30s | Near-real-time audit trail |

---

## Mutation Invalidation Reference

| Action | Invalidate |
|---|---|
| Booking status change | `["admin", "bookings"]` + `admin.analytics.bookings()` |
| Ticket upload | `["admin", "bookings"]` |
| Trip create/edit/delete | `["admin", "trips"]` + `admin.agencies()` |
| Station CRUD | `admin.stations()` |
| Bus CRUD | `["admin", "buses"]` |
| Agency/route CRUD | `admin.agencies()` + `["admin", "trips"]` |
| User edit | `["admin", "users"]` |
| Driver car save | `driver.cars()` |
| Driver listing save | `driver.listings()` |
| Admin profile save | `adminProfile()` |
| User books a trip | `bookings.mine()` + `trips.all()` |
| Logout | `queryClient.clear()` — wipe everything |

---

## Pull-to-Refresh Pattern (all screens)

Replace:
```tsx
const [refreshing, setRefreshing] = useState(false);
<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />
```

With:
```tsx
const { data, isLoading, isRefetching, refetch } = useQuery({ ... });
<RefreshControl refreshing={isRefetching} onRefresh={refetch} />
```

---

## Backend Tasks (for 5000+ concurrent users)

- [ ] Add `Cache-Control` headers to read-only endpoints
  - `/trips` → `public, max-age=60, stale-while-revalidate=30`
  - `/stations` → `public, max-age=600`
  - `/car-rentals` → `public, max-age=600`
  - `/admin/analytics/*` → `private, max-age=120`
  - `/me`, `/bookings`, mutations → `private, no-store`

- [ ] Redis caching for expensive aggregations
  - `/analytics/earnings`, `/analytics/bookings`, `/analytics/revenue` → TTL 120s
  - `/driver/stats` → TTL 120s
  - Bust keys on booking status change

- [ ] Rate limiting per authenticated user (not per IP)
  - `/trips` search → 30 req/min/user
  - `POST /bookings` → 5 req/min/user
  - `PATCH /admin/bookings/:id` → 20 req/min/user
  - `/me` → 10 req/min/user

- [ ] Add DB indexes
  - `bookings.user_id`
  - `bookings.status`
  - `trips.from_station_id, trips.to_station_id, trips.active` (composite)
  - `admin_logs.created_at`

- [ ] Paginate `/admin/users` (currently dumps all users — unsafe at scale)

- [ ] Queue ticket uploads via Laravel Horizon (not synchronous)
