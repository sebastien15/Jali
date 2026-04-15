# Stack: React Native / Expo
> Rules for every screen, component, or hook in `mobile/`.
> Stack: Expo SDK 54, React Native 0.81.5, Expo Router v6, TanStack Query v5, NativeWind v4.

---

## Data Fetching — TanStack Query (MANDATORY)

### Never fetch in a bare `useEffect`
```tsx
// ❌ BAD — no cache, fetches on every mount
useEffect(() => { api.get("/trips").then(setTrips); }, []);

// ✅ GOOD
const { data, isLoading, isRefetching, refetch } = useQuery({
  queryKey: queryKeys.trips.search(from, to, date),
  queryFn: () => api.get("/trips").then(r => r.data),
  staleTime: 60_000,
});
```

### Gate queries with `enabled` — never fetch speculatively
```tsx
// Only fetch car rentals when the rental tab is active
const { data: rentals } = useQuery({
  queryKey: queryKeys.carRentals.all(),
  queryFn: () => api.get("/car-rentals").then(r => r.data),
  staleTime: 10 * 60_000,
  enabled: mode === "rental",  // ← no fetch until user taps this tab
});
```

### Always import queryKey from `lib/queryKeys.ts`
Never use inline string keys. Shared keys = automatic deduplication (two screens with the same key = one network request).

### staleTime must match data volatility
| Data | staleTime | Why |
|---|---|---|
| `/me`, role, permissions | `Infinity` | Session-static |
| Stations, buses, car rentals | `10 * 60_000` | Admin-edited only |
| Agencies, locations | `5 * 60_000` | Infrequent changes |
| Analytics, driver stats | `2 * 60_000` | Informational dashboards |
| Trip availability / seats | `60_000` | Seat counts change as others book |
| Admin bookings queue | `30_000` | Admins actively process |
| Logs (paginated) | `30_000` | Near-real-time audit |

**Never leave staleTime at 0** (default). It refetches on every focus event.

### Mutations always invalidate, never manually refetch
```tsx
// ❌ BAD
await api.patch(`/admin/bookings/${id}`, data);
await load(); // manual refetch

// ✅ GOOD
const mutation = useMutation({
  mutationFn: (data) => api.patch(`/admin/bookings/${id}`, data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "bookings"] });
    // prefix invalidation clears all filter variants at once
  },
});
```

### Pull-to-refresh pattern (always)
```tsx
// ✅ Never manage refreshing state manually
<RefreshControl refreshing={isRefetching} onRefresh={refetch} />
// Remove: const [refreshing, setRefreshing] = useState(false)
```

### Paginated lists use `useInfiniteQuery`
```tsx
const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
  queryKey: queryKeys.admin.logs(actionFilter),
  queryFn: ({ pageParam = 1 }) =>
    api.get("/admin/logs", { params: { page: pageParam, cursor: pageParam } }).then(r => r.data),
  getNextPageParam: (last) =>
    last.next_cursor ?? undefined,  // cursor from Laravel cursorPaginate()
  staleTime: 30_000,
});
```

### Offline persistence (for low-connectivity markets)
```tsx
// Wrap in PersistQueryClientProvider instead of QueryClientProvider
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  throttleTime: 1000,
});
// maxAge: 24 * 60 * 60 * 1000 — cache survives app restart for 24h
// Users on slow mobile networks see data instantly, then sync in background
```

### Clear all cache on logout
```tsx
await queryClient.clear(); // wipe everything — next user on same device starts fresh
await clearApiToken();
router.replace("/(auth)/login");
```

### `refetchOnWindowFocus` is always `false`
Set globally in `lib/queryClient.ts`. Never override to `true`.
React Native fires focus events on every modal/sheet/alert dismiss → constant spurious refetches.

---

## Lists — FlatList Optimization

Always configure these props on every `FlatList` with more than 10 items:
```tsx
<FlatList
  data={data}
  renderItem={useCallback(({ item }) => <Card item={item} />, [])}
  keyExtractor={useCallback((item) => item.id.toString(), [])}
  removeClippedSubviews={true}     // unmount off-screen items
  maxToRenderPerBatch={10}         // render 10 items per JS frame
  updateCellsBatchingPeriod={50}   // batch updates every 50ms
  windowSize={10}                  // render 5 screens above + below viewport
  initialNumToRender={8}           // only 8 items on mount
  onEndReachedThreshold={0.5}      // trigger load-more at 50% from bottom
  onEndReached={fetchNextPage}
  ListFooterComponent={isFetchingNextPage ? <Spinner /> : null}
/>
```

---

## Re-renders — Minimize Them

```tsx
// ❌ BAD — new object reference every render
function Screen() {
  const style = { flex: 1, padding: 16 }; // re-creates every render
}

// ✅ GOOD — stable reference outside component
const containerStyle = { flex: 1, padding: 16 };

// ✅ Memoize list item components
const TripCard = React.memo(({ trip, onPress }) => { ... });

// ✅ Stable callback
const handlePress = useCallback((id) => onSelect(id), [onSelect]);
```

---

## Images

Use `expo-image` (already in Expo SDK 54 — no extra install) instead of `<Image>` from React Native:
```tsx
import { Image } from "expo-image";

<Image
  source={{ uri: trip.thumbnail_url }}
  style={{ width: 120, height: 120 }}
  contentFit="cover"
  cachePolicy="memory-disk"   // persistent disk cache — no re-downloading on scroll
  priority="normal"
/>
```

For the first N items on a screen, set `priority="high"` to preload them before the user scrolls.

---

## Debounce Search Inputs

Never fire a query on every keystroke:
```tsx
import { useDeferredValue } from "react";

const [input, setInput] = useState("");
const deferredInput = useDeferredValue(input); // React 19 built-in — waits for idle frame

const { data } = useQuery({
  queryKey: queryKeys.trips.search(from, to, deferredInput),
  queryFn: () => api.get("/trips", { params: { q: deferredInput } }).then(r => r.data),
  enabled: deferredInput.length > 0,
  staleTime: 60_000,
});
```

---

## Skeleton Loaders (Perceived Performance)

Show skeletons during `isLoading`, not spinners. Users on slow networks need to see that content is coming:
```tsx
if (isLoading) return <TripCardSkeleton count={5} />;
```

Perceived performance matters as much as real performance — a skeleton at 800ms feels faster than a spinner at 600ms.

---

## Hermes Engine

Already enabled by default in Expo SDK 54. Verify it's not accidentally disabled:
```json
// android/app/build.gradle (after expo prebuild)
// hermesEnabled should be true
```
Hermes reduces app startup by 30–50% vs JavaScriptCore.

---

## Feature Checklist — Before Marking Any Screen Done

- [ ] Data fetched via `useQuery`/`useMutation`, not `useEffect` + `api.get()`
- [ ] `queryKey` imported from `lib/queryKeys.ts`
- [ ] `staleTime` set explicitly (not default 0)
- [ ] `enabled` set for conditional fetches (tab-gated, auth-gated, param-gated)
- [ ] Mutations call `invalidateQueries` in `onSuccess`
- [ ] Pull-to-refresh uses `isRefetching` + `refetch`
- [ ] FlatList has performance props if list > 10 items
- [ ] List item component wrapped in `React.memo()`
- [ ] Images use `expo-image` with `cachePolicy="memory-disk"`
- [ ] No inline style objects inside component render functions
