/**
 * Jali charges no fees (S7.4): transport prices are set by providers and the
 * customer pays exactly that price. Fee helpers were removed; only the
 * distance helper remains.
 */

export interface Coords {
  latitude: number;
  longitude: number;
}

/** Straight-line distance in km between two GPS coordinates (haversine). */
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
