import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as DocumentPicker from "expo-document-picker";
import type { components } from "@/lib/apiSchema";
import { C } from "@/constants/theme";

export type RentalCar = components["schemas"]["RentalCar"];
export type RentalCarDetail = components["schemas"]["RentalCarDetail"];
export type RentalQuote = components["schemas"]["RentalQuote"];
export type RentalTerms = components["schemas"]["RentalTerms"];
export type RentalBooking = components["schemas"]["RentalBooking"];
export type RentalStatus = components["schemas"]["RentalStatus"];
export type RentalBusyRange = components["schemas"]["RentalBusyRange"];
export type RentalBlock = components["schemas"]["RentalBlock"];
export type OwnerRentalCar = components["schemas"]["OwnerRentalCar"] & Partial<components["schemas"]["RentalCarInput"]>;
export type AdminRentalCar = components["schemas"]["AdminRentalCar"] & Partial<components["schemas"]["RentalCarInput"]>;
export type OwnerRentalSummary = components["schemas"]["OwnerRentalSummary"];
export type RentalCarInput = components["schemas"]["RentalCarInput"];
export type RentalCarType = components["schemas"]["RentalCarType"];

export const KIGALI_TZ = "Africa/Kigali";
export const CAR_TYPES: RentalCarType[] = ["Sedan", "SUV", "Hatchback", "Minivan", "Van", "Pickup", "Luxury"];
export const TRANSMISSIONS = ["automatic", "manual"] as const;
export const FUEL_TYPES = ["petrol", "diesel", "hybrid", "electric"] as const;
export const FUEL_POLICIES = ["same_to_same", "full_to_full", "prepaid"] as const;
export const CANCELLATION_POLICIES = ["flexible", "moderate", "strict"] as const;
export const ALLOWED_KEYS = ["smoking", "pets", "outside_kigali", "cross_border"] as const;
export const CAR_FEATURES = [
  "AC", "Bluetooth", "USB charger", "GPS", "Reverse camera", "Parking sensors", "Child seat", "Roof rack",
  "4x4", "Sunroof", "Leather seats", "Apple CarPlay / Android Auto", "Spare tyre", "First aid kit",
] as const;
export const CUSTOMER_CANCEL_REASONS = ["changed_plans", "found_another_car", "owner_asked_to_cancel", "booked_by_mistake", "other"] as const;
export const OWNER_CANCEL_REASONS = ["car_not_available", "car_broke_down", "customer_asked_to_cancel", "customer_not_reachable", "other"] as const;
export const MAX_PHOTOS = 12;

export const LABELS = {
  transmission: { automatic: "Automatic", manual: "Manual" } as Record<string, string>,
  fuel: { petrol: "Petrol", diesel: "Diesel", hybrid: "Hybrid", electric: "Electric" } as Record<string, string>,
  fuelPolicy: {
    same_to_same: "Return with the same fuel level",
    full_to_full: "Picked up full, return full",
    prepaid: "Fuel included in the price",
  } as Record<string, string>,
  cancellation: {
    flexible: "Flexible — free until 24 h before pickup, then one day's price",
    moderate: "Moderate — free until 3 days before pickup, then half the total",
    strict: "Strict — free until 7 days before pickup, then half; under 24 h the full total",
  } as Record<string, string>,
  cancellationShort: { flexible: "Flexible", moderate: "Moderate", strict: "Strict" } as Record<string, string>,
  allowed: {
    smoking: "Smoking", pets: "Pets", outside_kigali: "Driving outside Kigali", cross_border: "Crossing the border",
  } as Record<string, string>,
  customerCancel: {
    changed_plans: "My plans changed", found_another_car: "I found another car", owner_asked_to_cancel: "The owner asked me to cancel",
    booked_by_mistake: "Booked by mistake", other: "Other",
  } as Record<string, string>,
  ownerCancel: {
    car_not_available: "The car is not available", car_broke_down: "The car broke down", customer_asked_to_cancel: "The customer asked to cancel",
    customer_not_reachable: "I can't reach the customer", other: "Other",
  } as Record<string, string>,
  missing: {
    photos: "At least 3 photos", registration: "Registration card (carte jaune)", insurance: "Insurance certificate",
    pickup_address: "Pickup address", transmission: "Transmission", description: "Description",
  } as Record<string, string>,
};

export const STATUS_META: Record<RentalStatus, { label: string; color: string; bg: string }> = {
  requested: { label: "Waiting for the owner", color: C.orange, bg: C.orangeLt },
  accepted: { label: "Confirmed", color: C.green, bg: C.greenLt },
  active: { label: "In progress", color: C.blue, bg: C.blueLt },
  completed: { label: "Completed", color: C.mid, bg: C.bg },
  declined: { label: "Declined", color: C.muted, bg: C.bg },
  expired: { label: "No answer", color: C.muted, bg: C.bg },
  cancelled: { label: "Cancelled", color: C.muted, bg: C.bg },
};

export const OWNER_STATUS_LABEL: Partial<Record<RentalStatus, string>> = {
  requested: "New request",
  accepted: "Confirmed — hand over at pickup",
  active: "Car with the customer",
};

/** Kigali is UTC+2 all year (no daylight saving). */
const KIGALI_OFFSET_MIN = 120;

/** "2026-10-14" + "09:30" in Kigali → ISO string */
export function kigaliIso(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - KIGALI_OFFSET_MIN * 60_000).toISOString();
}

/** Today and the next `count - 1` dates in Kigali as YYYY-MM-DD */
export function nextDates(count: number, from = 0): string[] {
  const now = new Date(Date.now() + KIGALI_OFFSET_MIN * 60_000);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + from + i));
    return d.toISOString().slice(0, 10);
  });
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Started 24-hour periods between two ISO instants (same rule as the server) */
export function rentalDays(startIso: string, endIso: string): number {
  return Math.max(1, Math.ceil((new Date(endIso).getTime() - new Date(startIso).getTime()) / 86_400_000));
}

/** Half-hour times 06:00–21:00 */
export const TIMES = Array.from({ length: 31 }, (_, i) => {
  const minutes = 6 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${minutes % 60 ? "30" : "00"}`;
});

export function formatWhen(iso: string, locale?: string): string {
  return new Date(iso).toLocaleString(locale, { timeZone: KIGALI_TZ, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string, locale?: string): string {
  return new Date(iso).toLocaleDateString(locale, { timeZone: KIGALI_TZ, day: "numeric", month: "short" });
}

export function formatDay(date: string, locale?: string): { weekday: string; day: string } {
  const d = new Date(`${date}T12:00:00Z`);
  return {
    weekday: d.toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" }),
    day: d.toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "UTC" }),
  };
}

/** "6/8 tank" */
export function fuelLabel(level: number): string {
  if (level >= 8) return "Full tank";
  if (level <= 0) return "Empty";
  return `${level}/8 tank`;
}

export function carTitle(car: { name: string; year?: number | null }): string {
  return car.year ? `${car.name} · ${car.year}` : car.name;
}

/** A picked file ready for FormData */
export type PickedFile = { uri: string; name: string; type: string };

async function compress(uri: string): Promise<PickedFile> {
  const out = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1400 } }],
    { compress: 0.65, format: ImageManipulator.SaveFormat.JPEG });
  return { uri: out.uri, name: `photo-${Date.now()}.jpg`, type: "image/jpeg" };
}

/** Pick photos from the gallery (several) or take one with the camera */
export async function pickPhotos(opts: { camera?: boolean; max?: number } = {}): Promise<PickedFile[]> {
  if (opts.camera) {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") return [];
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled) return [];
    return [await compress(result.assets[0].uri)];
  }
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") return [];
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: (opts.max ?? 1) > 1,
    selectionLimit: opts.max ?? 1,
    quality: 0.8,
  });
  if (result.canceled) return [];
  return Promise.all(result.assets.slice(0, opts.max ?? 1).map(a => compress(a.uri)));
}

/** Pick a document (photo or PDF) for registration/insurance */
export async function pickDocument(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ["image/*", "application/pdf"], copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.[0]) return null;
  const a = result.assets[0];
  if (a.mimeType?.startsWith("image/")) return compress(a.uri);
  return { uri: a.uri, name: a.name ?? "document.pdf", type: a.mimeType ?? "application/pdf" };
}

/** Append a picked file to FormData (web needs a Blob) */
export async function appendFile(form: FormData, field: string, file: PickedFile): Promise<void> {
  if (Platform.OS === "web") {
    const blob = await (await fetch(file.uri)).blob();
    form.append(field, blob, file.name);
  } else {
    form.append(field, { uri: file.uri, name: file.name, type: file.type } as any);
  }
}

/** First validation message from an API error, or a fallback */
export function apiError(e: unknown, fallback: string): string {
  const data = (e as any)?.response?.data;
  if (data?.errors) {
    const first = Object.values(data.errors as Record<string, string[]>)[0]?.[0];
    if (first) return first;
  }
  return data?.message || fallback;
}
