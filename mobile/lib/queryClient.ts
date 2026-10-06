import { QueryClient, Query, defaultShouldDehydrateQuery } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,            // 30s floor — each screen overrides upward
      gcTime: 5 * 60 * 1000,        // keep in memory 5 min after unmount
      // Retry network errors and 5xx only — a 4xx (401/403/404/422) will
      // fail the same way again and just multiplies alerts and load.
      retry: (failureCount, error: any) => {
        const status = error?.response?.status;
        if (status && status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,  // RN fires focus on every modal/sheet dismiss
      refetchOnReconnect: true,     // OfflineBanner already signals reconnect
    },
    mutations: {
      retry: 0,                     // mutations are not idempotent
    },
  },
});

/**
 * Persists the query cache to AsyncStorage (wired up in app/_layout.tsx).
 *
 * The persisted cache is one global entry, so it is purged on every session
 * start and end (core/session/teardown.ts) — account B never restores
 * account A's cache. Bump PERSIST_SCHEMA_VERSION when cached shapes change.
 */
export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  throttleTime: 1000,
});

export const PERSIST_SCHEMA_VERSION = "jali-query-v1";

/**
 * Never written to disk (runbook §5.6): ride detail/active/history and chat
 * (start PINs, live positions, messages), hire job detail, the driver's own
 * onboarding/profile (licence, national ID, documents), admin driver
 * applications (documents) and rentals (contacts and handover records). They are refetched when opened.
 */
export function isSensitiveQueryKey(key: readonly unknown[]): boolean {
  const [root, second] = key;
  if (root === "rides") return true;
  if (root === "support") return true;   // ticket text is personal (S16.3)
  // Rentals: phone numbers after acceptance, handover records, owner papers state
  if (root === "rentals") return second === "bookings" || second === "booking";
  if (root === "hire") return typeof second === "number";
  if (root === "driver") return second === "onboarding" || second === "profile" || second === "rentals" || second === "rental";
  if (root === "admin") return second === "drivers" || second === "rentalCars" || second === "rentalCar" || second === "rentals" || second === "rental" || second === "support";
  return false;
}

export const persistOptions = {
  persister,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  buster: PERSIST_SCHEMA_VERSION,
  dehydrateOptions: {
    shouldDehydrateQuery: (query: Query) =>
      defaultShouldDehydrateQuery(query) && !isSensitiveQueryKey(query.queryKey),
  },
};

/**
 * Drop every cached query and mutation, in memory and on disk, after
 * cancelling in-flight fetches. Runs on every session start and end
 * (core/session/teardown.ts): `me` is cached, so a stale cache would show
 * the next account the previous user's bookings and profile.
 */
export async function clearQueryCache(): Promise<void> {
  try {
    await queryClient.cancelQueries();
  } catch {}
  queryClient.clear();
  try {
    await persister.removeClient();
  } catch {}
}
