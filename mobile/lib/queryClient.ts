import { QueryClient } from "@tanstack/react-query";

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
