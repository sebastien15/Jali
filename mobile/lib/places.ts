import AsyncStorage from "@react-native-async-storage/async-storage";
import type { components } from "@/lib/apiSchema";

export type Place = components["schemas"]["PlaceResult"];

const RECENT_KEY = "jali_recent_places";
const MAX_RECENT = 6;

export async function recentPlaces(): Promise<Place[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function rememberPlace(place: Place): Promise<void> {
  const list = (await recentPlaces()).filter(p => !(p.name === place.name && Math.abs(p.lat - place.lat) < 0.0005));
  await AsyncStorage.setItem(RECENT_KEY, JSON.stringify([place, ...list].slice(0, MAX_RECENT))).catch(() => {});
}

/** Encode a place for expo-router params */
export function placeParam(p: Place): string {
  return JSON.stringify({ name: p.name, address: p.address, lat: p.lat, lng: p.lng });
}

export function parsePlace(param: string | string[] | undefined): Place | null {
  if (!param || Array.isArray(param)) return null;
  try {
    const p = JSON.parse(param);
    return typeof p.lat === "number" && typeof p.lng === "number" ? p : null;
  } catch {
    return null;
  }
}
