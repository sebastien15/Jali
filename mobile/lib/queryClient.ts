import { QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,            // 30s floor — each screen overrides upward
      gcTime: 5 * 60 * 1000,        // keep in memory 5 min after unmount
      retry: 2,
      refetchOnWindowFocus: false,  // RN fires focus on every modal/sheet dismiss
      refetchOnReconnect: true,     // OfflineBanner already signals reconnect
    },
    mutations: {
      retry: 0,                     // mutations are not idempotent
    },
  },
});

/** Persists the query cache to AsyncStorage (wired up in app/_layout.tsx). */
export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  throttleTime: 1000,
});

/**
 * Drop every cached query, in memory and on disk. Must run whenever the
 * signed-in user changes, otherwise the next account sees the previous
 * user's bookings and profile (`me` is cached with staleTime: Infinity).
 */
export async function clearQueryCache(): Promise<void> {
  queryClient.clear();
  try {
    await persister.removeClient();
  } catch {}
}
