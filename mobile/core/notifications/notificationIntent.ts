import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import api, { getApiToken } from "@/lib/api";

/**
 * Root resolver for notification taps (S23.5, runbook §6). A payload
 * (legacy `{screen, id}`) becomes an allowlisted intent: the route to open,
 * plus the API that proves this account may see the entity. Taps before
 * login wait as a bounded pending intent; duplicates are ignored; deleted
 * entities or ones of another account land on a safe "not available" screen.
 * The current customer/provider mode is never an input.
 */
export type NotificationIntent = { route: string; check?: string };

const PENDING_KEY = "jali:pendingNotification";
const PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type Entry = { route: (id: string) => string; check?: (id: string) => string; fallback: string };

/** screen → where it opens and how ownership is checked */
const ROUTES: Record<string, Entry> = {
  ride: { route: id => `/ride/${id}`, check: id => `/rides/${id}`, fallback: "/ride" },
  hire: { route: id => `/hire/${id}`, check: id => `/driver-hire/${id}`, fallback: "/hire" },
  driver_hire: { route: id => `/driver/hire/${id}`, check: id => `/driver-hire/${id}`, fallback: "/(tabs)/drive" },
  driver_ride: { route: id => `/driver/ride/${id}`, check: id => `/rides/${id}`, fallback: "/(tabs)/drive" },
  admin_ride: { route: id => `/(admin)/rides/${id}`, check: id => `/admin/rides/${id}`, fallback: "/(admin)/rides" },
  rental: { route: id => `/rental/${id}`, check: id => `/rentals/bookings/${id}`, fallback: "/(tabs)/trips" },
  owner_rental: { route: id => `/driver/rentals/${id}`, check: id => `/driver/rentals/${id}`, fallback: "/driver/rentals" },
  owner_car: { route: id => `/driver/car/${id}`, check: id => `/driver/cars/${id}`, fallback: "/driver/fleet" },
  support_ticket: { route: id => `/support/${id}`, check: id => `/support/tickets/${id}`, fallback: "/support" },
  admin_support_ticket: { route: id => `/(admin)/support/${id}`, check: id => `/admin/support/tickets/${id}`, fallback: "/(admin)/support" },
  booking: { route: () => "/(tabs)/trips", fallback: "/(tabs)/trips" },
  driver: { route: () => "/(tabs)/drive", fallback: "/(tabs)/drive" },
  driver_earnings: { route: () => "/driver/earnings", fallback: "/driver/earnings" },
  driver_rates: { route: () => "/driver/rates", fallback: "/driver/rates" },
  driver_onboarding: { route: () => "/driver/onboarding", fallback: "/driver/onboarding" },
};

/** Payload → intent from the allowlist; malformed ids open the list, never arbitrary input. */
export function toIntent(data: Record<string, unknown> | undefined | null): NotificationIntent | null {
  if (!data || typeof data.screen !== "string") return null;
  const entry = ROUTES[data.screen];
  if (!entry) return { route: "/(tabs)/trips" };   // unknown (newer) screens: the activity list, as before
  const raw = data.id;
  const id = (typeof raw === "number" && Number.isInteger(raw) && raw > 0) || (typeof raw === "string" && /^\d{1,12}$/.test(raw)) ? String(raw) : null;
  if (!id) return { route: entry.fallback };
  return { route: entry.route(id), check: entry.check?.(id) };
}

/** Compatibility facade for older callers: the route only. */
export function routeForNotification(data: Record<string, unknown> | undefined | null): string | null {
  return toIntent(data)?.route ?? null;
}

const handled = new Set<string>();

/**
 * Handle a tap (foreground listener or cold start). Same response twice → once.
 * Signed out → keep it for after login.
 */
export async function handleNotificationResponse(response: Notifications.NotificationResponse): Promise<void> {
  const key = `${response.notification.request.identifier}:${response.actionIdentifier}`;
  if (handled.has(key)) return;
  handled.add(key);
  const data = response.notification.request.content.data as Record<string, unknown> | undefined;
  reportOpened(data);
  try {
    await Notifications.clearLastNotificationResponseAsync();   // a cold start must not replay it
  } catch {
    // not available on this platform
  }

  const intent = toIntent(data);
  if (!intent) return;
  if (!(await getApiToken())) {
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify({ intent, at: Date.now() })).catch(() => {});
    return;
  }
  await openIntent(intent);
}

/** After login (and on each signed-in start): open a tap that happened while signed out. */
export async function resumePendingIntent(): Promise<void> {
  const raw = await AsyncStorage.getItem(PENDING_KEY).catch(() => null);
  if (!raw) return;
  await clearPendingIntent();
  try {
    const { intent, at } = JSON.parse(raw) as { intent: NotificationIntent; at: number };
    if (Date.now() - at <= PENDING_MAX_AGE_MS && typeof intent?.route === "string") await openIntent(intent);
  } catch {
    // corrupt entry: dropped
  }
}

export async function clearPendingIntent(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_KEY).catch(() => {});
}

/** Check the entity with this account's credentials first; 403/404 → safe screen, no private details. */
async function openIntent(intent: NotificationIntent): Promise<void> {
  if (intent.check) {
    try {
      await api.get(intent.check);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 403 || status === 404) {
        router.push("/notification-unavailable" as any);
        return;
      }
      // Offline or server error: open the screen; it shows its own retry state.
    }
  }
  router.push(intent.route as any);
}

/** S12.3: tell the server the push was opened (delivery/open rates; cancels the SMS fallback) */
function reportOpened(data: Record<string, unknown> | undefined | null) {
  const nid = Number(data?.nid);
  if (Number.isInteger(nid) && nid > 0) api.post(`/me/notifications/${nid}/opened`).catch(() => {});
}
