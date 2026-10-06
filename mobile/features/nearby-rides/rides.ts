import { haversineDistance } from "@/lib/serviceFee";
import type { components } from "@/lib/apiSchema";

export type Ride = components["schemas"]["Ride"];
export type RideStatus = components["schemas"]["RideStatus"];

export const ACTIVE_STATUSES: RideStatus[] = ["requested", "accepted", "arrived", "in_progress"];
export const RIDER_CANCEL_REASONS = ["changed_plans", "driver_too_far", "driver_asked_to_cancel", "found_other_transport", "wrong_pickup", "other"] as const;
export const DRIVER_CANCEL_REASONS = ["rider_not_at_pickup", "rider_asked_to_cancel", "vehicle_problem", "unsafe", "traffic", "other"] as const;
export const RATING_TAGS_FOR_DRIVER = ["Clean car", "Safe driving", "Friendly", "Knows the way"];
export const RATING_TAGS_FOR_RIDER = ["On time", "Polite", "Friendly"];

/** Same assumption as the backend (NearbyDrivers::CITY_KMH) until real routing (S11.1). */
const CITY_KMH = 25;
const ROAD_FACTOR = 1.3;

export function isActive(ride: Ride | null | undefined): boolean {
  return !!ride && ACTIVE_STATUSES.includes(ride.status);
}

/** Minutes for the driver to reach the pickup, from their last known position. */
export function pickupEtaMin(ride: Ride): number | null {
  const loc = ride.driver?.location;
  if (!loc) return null;
  const km = haversineDistance({ latitude: loc.lat, longitude: loc.lng }, { latitude: ride.pickup.lat, longitude: ride.pickup.lng }) * ROAD_FACTOR;
  return Math.max(1, Math.ceil((km / CITY_KMH) * 60));
}

export function secondsLeft(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 1000));
}
