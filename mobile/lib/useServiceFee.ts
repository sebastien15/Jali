import { useEffect, useState } from "react";
import * as Location from "expo-location";
import {
  calculateServiceFee,
  FALLBACK_FEE,
  type Coords,
} from "./serviceFee";

interface UseServiceFeeResult {
  fee: number;
  distanceKm: number | null;
  loading: boolean;
  permissionDenied: boolean;
}

/**
 * Hook that requests the user's location once and returns the Jali service
 * fee for the given departure city.
 *
 * - loading=true while waiting for GPS
 * - permissionDenied=true → fee is FALLBACK_FEE (500 RWF), no GPS obtained
 * - distanceKm is null until resolved (useful for showing "X km from station")
 */
export function useServiceFee(departureCity: string): UseServiceFeeResult {
  const [fee, setFee]                     = useState(FALLBACK_FEE);
  const [distanceKm, setDistanceKm]       = useState<number | null>(null);
  const [loading, setLoading]             = useState(true);
  const [permissionDenied, setDenied]     = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== "granted") {
          if (!cancelled) {
            setDenied(true);
            setFee(FALLBACK_FEE);
            setLoading(false);
          }
          return;
        }

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (cancelled) return;

        const userCoords: Coords = {
          latitude:  loc.coords.latitude,
          longitude: loc.coords.longitude,
        };

        const calculated = calculateServiceFee(userCoords, departureCity);

        // Also compute raw distance for display
        const { haversineDistance, BUS_STATIONS } = await import("./serviceFee");
        const station = BUS_STATIONS[departureCity];
        const km = station ? haversineDistance(userCoords, station) : null;

        setFee(calculated);
        setDistanceKm(km !== null ? Math.round(km * 10) / 10 : null);
      } catch {
        // GPS timeout or other error — fall back silently
        if (!cancelled) setFee(FALLBACK_FEE);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    resolve();
    return () => { cancelled = true; };
  }, [departureCity]);

  return { fee, distanceKm, loading, permissionDenied };
}
