import type { TripResult } from "./components/TripCard";

// Bus search filters used by the Home screen (agency chips and departure-time filter).
// Pure helpers extracted unchanged from app/(tabs)/index.tsx; callers memoise them.

/** Agency names from past bus bookings (title format: "Agency · from → to"), in booking order. */
export function bookedAgencyNames(bookings: any[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const b of bookings) {
    if (b.type !== "trip") continue;
    const agency = b.title?.split(" · ")[0];
    if (agency && !seen.has(agency)) { seen.add(agency); result.push(agency); }
  }
  return result;
}

/** Booked agencies shown first, rest sorted alphabetically. */
export function orderAgencies(trips: TripResult[], booked: string[]): string[] {
  const all = [...new Set(trips.map((t: TripResult) => t.agency_name).filter(Boolean))];
  const bookedSet = new Set(booked);
  const bookedFirst = booked.filter(a => all.includes(a));
  const rest = all.filter(a => !bookedSet.has(a)).sort();
  return [...bookedFirst, ...rest];
}

/** Trips matching the agency chip that still have a departure at/after `timeFilterMins` (minute of day). */
export function filterBusTrips(trips: TripResult[], agencyFilter: string | null, timeFilterMins: number | undefined): TripResult[] {
  return trips.filter((trip: TripResult) => {
    if (agencyFilter && trip.agency_name !== agencyFilter) return false;
    if (timeFilterMins != null) {
      const hasUpcoming = trip.departures?.some(d => {
        const [h, m] = d.departure_time.split(":").map(Number);
        return h * 60 + m >= timeFilterMins;
      });
      if (!hasUpcoming) return false;
    }
    return true;
  });
}
