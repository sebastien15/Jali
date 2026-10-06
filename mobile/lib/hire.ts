import type { components } from "@/lib/apiSchema";

export type DriverHire = components["schemas"]["DriverHire"];
export type HireStatus = components["schemas"]["HireStatus"];
export type AvailableHireDriver = components["schemas"]["AvailableHireDriver"];
export type HireTripType = components["schemas"]["HireTripType"];
export type Transmission = components["schemas"]["Transmission"];
export type HireLanguage = components["schemas"]["HireLanguage"];

export const KIGALI_TZ = "Africa/Kigali";
export const TRIP_TYPES: HireTripType[] = ["city", "airport", "out_of_town"];
export const TRANSMISSIONS: Transmission[] = ["automatic", "manual"];
export const LANGUAGES: HireLanguage[] = ["rw", "en", "fr", "sw", "other"];
export const CUSTOMER_CANCEL_REASONS = ["changed_plans", "found_another_driver", "driver_asked_to_cancel", "booked_by_mistake", "other"] as const;
export const DRIVER_CANCEL_REASONS = ["not_available", "customer_asked_to_cancel", "too_far", "unsafe", "other"] as const;
export const RATING_TAGS_FOR_HIRE_DRIVER = ["Careful driver", "On time", "Polite", "Knows the way"];
export const RATING_TAGS_FOR_HIRE_CUSTOMER = ["On time", "Polite", "Car in good condition"];

const ACTIVE: HireStatus[] = ["requested", "accepted", "started"];

export function isActiveHire(h: DriverHire | null | undefined): boolean {
  return !!h && ACTIVE.includes(h.status);
}

/** Kigali is UTC+2 all year (no daylight saving). */
const KIGALI_OFFSET_MIN = 120;

/** "2026-10-14" + "09:30" in Kigali → ISO string */
export function kigaliIso(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - KIGALI_OFFSET_MIN * 60_000).toISOString();
}

/** Today and the next `count - 1` dates in Kigali as YYYY-MM-DD */
export function nextDates(count: number): string[] {
  const now = new Date(Date.now() + KIGALI_OFFSET_MIN * 60_000);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + i));
    return d.toISOString().slice(0, 10);
  });
}

/** Half-hour start times 05:00–22:00 */
export const START_TIMES = Array.from({ length: 35 }, (_, i) => {
  const minutes = 5 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${minutes % 60 ? "30" : "00"}`;
});

export function formatWhen(iso: string, locale?: string): string {
  return new Date(iso).toLocaleString(locale, { timeZone: KIGALI_TZ, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function formatDay(date: string, locale?: string): { weekday: string; day: string } {
  const d = new Date(`${date}T12:00:00Z`);
  return {
    weekday: d.toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" }),
    day: d.toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "UTC" }),
  };
}
