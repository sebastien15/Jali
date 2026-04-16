import { useEffect, useState } from "react";
import * as Location from "expo-location";
import {
  calculateServiceFee,
  haversineDistance,
  BUS_STATIONS,
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
 * Hook that returns the Jali service fee for the given departure city.
 *
 * If `preloadedCoords` is provided (e.g. from the home screen location effect),
 * the fee is computed synchronously — no GPS request, no loading spinner.
 *
 * Without preloadedCoords:
 * - loading=true while waiting for GPS
 * - permissionDenied=true → fee is FALLBACK_FEE (500 RWF)
 * - distanceKm is null until resolved
 */
export function useServiceFee(
  departureCity: string,
  preloadedCoords?: { lat: number; lng: number } | null,
): UseServiceFeeResult {
  const coordsForCalc: Coords | null = preloadedCoords
    ? { latitude: preloadedCoords.lat, longitude: preloadedCoords.lng }
    : null;

  const initialFee = coordsForCalc
    ? calculateServiceFee(coordsForCalc, departureCity)
    : FALLBACK_FEE;

  const station = BUS_STATIONS[departureCity];
  const initialKm = coordsForCalc && station
    ? Math.round(haversineDistance(coordsForCalc, station) * 10) / 10
    : null;

  const [fee, setFee]                 = useState(initialFee);
  const [distanceKm, setDistanceKm]   = useState<number | null>(initialKm);
  const [loading, setLoading]         = useState(!coordsForCalc);
  const [permissionDenied, setDenied] = useState(false);

  useEffect(() => {
    // Skip GPS when caller already provided coords
    if (coordsForCalc) return;

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
        const st = BUS_STATIONS[departureCity];
        const km = st ? haversineDistance(userCoords, st) : null;

        setFee(calculated);
        setDistanceKm(km !== null ? Math.round(km * 10) / 10 : null);
      } catch {
        if (!cancelled) setFee(FALLBACK_FEE);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    resolve();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departureCity]);

  return { fee, distanceKm, loading, permissionDenied };
}
