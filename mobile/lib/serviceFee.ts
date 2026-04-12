/**
 * Service fee calculator.
 *
 * Logic: the fee replaces the moto cost a user would pay to get to the bus
 * station and back. We charge roughly 1/3 of that round-trip moto cost,
 * with a minimum of 300 RWF. This means the user always saves money vs
 * taking a moto themselves.
 *
 * Moto pricing reference (Kigali, 2024):
 *   0–1 km  → ~300 RWF one-way  → round trip 600  → Jali fee 300 (min)
 *   1–3 km  → ~600 RWF one-way  → round trip 1200 → Jali fee 500
 *   3–6 km  → ~900 RWF one-way  → round trip 1800 → Jali fee 800
 *   6–10 km → ~1500 RWF one-way → round trip 3000 → Jali fee 1200
 *   10+ km  → ~2000 RWF one-way → round trip 4000 → Jali fee 1500
 */

export interface Coords {
  latitude: number;
  longitude: number;
}

// ── Haversine formula ────────────────────────────────────────────────────────
// Returns distance in km between two GPS coordinates.
export function haversineDistance(a: Coords, b: Coords): number {
  const R = 6371; // Earth radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.latitude  - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
    Math.cos(toRad(b.latitude)) *
    Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.asin(Math.sqrt(h));
}

// ── Bus station coordinates ──────────────────────────────────────────────────
// Key: matches city names used in CITIES constant and bus/private data.
// All Kigali departures leave from Nyabugogo Terminal.
export const BUS_STATIONS: Record<string, Coords> = {
  Kigali:     { latitude: -1.9420, longitude: 30.0562 }, // Nyabugogo Terminal
  Musanze:    { latitude: -1.4993, longitude: 29.6345 },
  Huye:       { latitude: -2.6036, longitude: 29.7394 },
  Rubavu:     { latitude: -1.6779, longitude: 29.2571 },
  Nyagatare:  { latitude: -1.2956, longitude: 30.3283 },
  Rwamagana:  { latitude: -1.9492, longitude: 30.4346 },
  Muhanga:    { latitude: -2.0837, longitude: 29.7514 },
  Rusizi:     { latitude: -2.4786, longitude: 28.9066 },
};

// ── Fee tiers ────────────────────────────────────────────────────────────────
// Sorted ascending by maxKm. The last tier has no maxKm cap.
const FEE_TIERS: { maxKm: number; fee: number }[] = [
  { maxKm: 1,        fee: 300 },
  { maxKm: 3,        fee: 400 },
  { maxKm: Infinity, fee: 500 },
];

export const FALLBACK_FEE = 500; // used when location is unavailable
export const MIN_FEE      = 300;

// ── Trip service fee ─────────────────────────────────────────────────────────
// 5% of the price, floored at 500 RWF, capped at 3000 RWF.
export function tripServiceFee(price: number): number {
  return Math.max(500, Math.min(3000, Math.round(price * 0.05)));
}

// ── Main export ──────────────────────────────────────────────────────────────
/**
 * Returns the Jali service fee in RWF given the user's current coordinates
 * and the name of the departure city (matched against BUS_STATIONS).
 *
 * Falls back to FALLBACK_FEE if the station is unknown.
 */
export function calculateServiceFee(userCoords: Coords, departureCity: string): number {
  const station = BUS_STATIONS[departureCity];
  if (!station) return FALLBACK_FEE;

  const km = haversineDistance(userCoords, station);
  const tier = FEE_TIERS.find(t => km <= t.maxKm);
  return tier ? tier.fee : FEE_TIERS[FEE_TIERS.length - 1].fee;
}
