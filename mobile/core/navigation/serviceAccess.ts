import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { components } from "@/lib/apiSchema";

export type ServiceId = components["schemas"]["ServiceKey"];
export type ServiceEntry = components["schemas"]["ServiceAccessEntry"];
type ServiceAccess = components["schemas"]["ServiceAccess"];

const BUILT: ServiceId[] = ["rides", "hire", "rental", "shared", "bus"];

/**
 * Until the server answers (or on an older server without the endpoint) every
 * built service stays available, as before S23.1; cargo never is. The server
 * still refuses new work for paused services, whatever the app shows.
 */
function fallback(id: ServiceId): ServiceEntry {
  const built = BUILT.includes(id);
  return {
    id, label: id, discoverable: built, accepting_new_requests: built, can_use: built, can_offer: false,
    can_configure: false, reason_code: built ? null : "not_released", minimum_app_version: null, area: null,
  };
}

const round = (n?: number | null) => (n == null ? null : Math.round(n * 100) / 100);

/** GET /me/service-access, cached 5 min. Pass coords on Home so local services follow the region (S10.4). */
export function useServiceAccess(coords?: { lat: number; lng: number } | null) {
  const lat = round(coords?.lat);
  const lng = round(coords?.lng);
  const query = useQuery({
    queryKey: queryKeys.serviceAccess(lat, lng),
    queryFn: () => api.get<ServiceAccess>("/me/service-access", { params: lat != null ? { lat, lng } : {} }).then(r => r.data),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const byId = new Map((query.data?.services ?? []).map(s => [s.id, s] as const));
  const entry = (id: ServiceId): ServiceEntry => byId.get(id) ?? fallback(id);

  return {
    loading: query.isLoading,
    entry,
    /** Shown on Home: released and taking new requests for this account here */
    isAvailable: (id: ServiceId) => {
      const e = entry(id);
      return e.discoverable && e.accepting_new_requests;
    },
  };
}

/** User-facing reason for a service that can't take new requests */
export function unavailableMessage(e: ServiceEntry): string {
  switch (e.reason_code) {
    case "app_update_required": return `Update the Jali app to use ${e.label}.`;
    case "paused": return `${e.label} is paused right now. Your existing bookings are not affected.`;
    case "not_in_area": return `${e.label} is not available here yet.`;
    case "off_in_area": return `${e.label} is not available${e.area ? ` in ${e.area.name}` : " here"} yet.`;
    case "no_permission": return `${e.label} is not available on this account.`;
    default: return `${e.label} is not available yet.`;
  }
}
