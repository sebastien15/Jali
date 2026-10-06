/**
 * Client-side price PREVIEW only — mirrors backend App\Services\Rides\FareService.
 * The server always recomputes the real price; never send a price to the API.
 */
import type { components } from "@/lib/apiSchema";

export type DriverRates = components["schemas"]["DriverRates"];
export type ServiceFee = { type: "flat" | "percent"; amount: number };

export function roundUpTo100(amount: number): number {
  return Math.ceil((amount - 1e-6) / 100) * 100;
}

export function previewFare(
  rates: DriverRates,
  tripKm: number,
  serviceFee: ServiceFee,
  opts: { pickupKm?: number; minutes?: number; night?: boolean } = {},
) {
  const { pickupKm = 0, minutes = 0, night = false } = opts;
  let fare =
    (rates.base_fare ?? 0) +
    (rates.per_km ?? 0) * tripKm +
    (rates.per_min ?? 0) * minutes +
    Math.max(0, pickupKm - (rates.pickup_free_km ?? 0)) * (rates.pickup_per_km ?? 0);
  fare = Math.max(rates.min_fare ?? 0, fare);
  if (night) fare *= rates.night_multiplier ?? 1;

  const driverFare = roundUpTo100(fare);
  const fee = serviceFee.type === "percent"
    ? Math.round((driverFare * serviceFee.amount) / 100)
    : serviceFee.amount;

  return { driverFare, serviceFee: fee, total: driverFare + fee };
}

export function formatRwf(amount: number): string {
  return `${Math.round(amount).toLocaleString("en-US")} RWF`;
}
