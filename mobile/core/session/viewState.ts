import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Account-scoped view state (runbook §5: persona + selected service).
 * View-only: nothing here is ever sent to the server.
 */
export type DriverType = "private" | "rental" | "ride" | "hire" | null;
export type ViewState = { driverMode: boolean; driverType: DriverType };

export const VIEW_STATE_PREFIX = "jali_view_state_v1:";
/** Pre-M05 global key (one value for whichever account was signed in). Read once, then removed. */
export const LEGACY_DRIVER_MODE_KEY = "jali_driver_mode";
/** Id of the account the stored API token belongs to — lets view state hydrate offline. */
export const SESSION_USER_KEY = "jali_session_user_v1";

const DRIVER_TYPES: readonly string[] = ["private", "rental", "ride", "hire"];

export const viewStateKey = (userId: string | number) => `${VIEW_STATE_PREFIX}${userId}`;

function parse(raw: string | null): ViewState | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== "object") return null;
    return {
      driverMode: v.driverMode === true,
      driverType: DRIVER_TYPES.includes(v.driverType) ? v.driverType : null,
    };
  } catch {
    return null;
  }
}

/** The legacy global value, read-only (no migration). */
export async function readLegacyViewState(): Promise<ViewState | null> {
  return parse(await AsyncStorage.getItem(LEGACY_DRIVER_MODE_KEY).catch(() => null));
}

/**
 * Read this account's view state. If it has none yet, migrate the legacy
 * global value once (it was cleared on every logout, so it belongs to the
 * account of the current token) and drop the legacy key. Never touches
 * server-side offered services.
 */
export async function readViewState(userId: string | number): Promise<ViewState | null> {
  const own = parse(await AsyncStorage.getItem(viewStateKey(userId)).catch(() => null));
  if (own) return own;
  const legacy = await readLegacyViewState();
  if (legacy) {
    await AsyncStorage.setItem(viewStateKey(userId), JSON.stringify(legacy)).catch(() => {});
    await AsyncStorage.removeItem(LEGACY_DRIVER_MODE_KEY).catch(() => {});
  }
  return legacy;
}

export function writeViewState(userId: string | number, state: ViewState): void {
  AsyncStorage.setItem(viewStateKey(userId), JSON.stringify(state)).catch(() => {});
}

export async function getSessionUserId(): Promise<string | null> {
  return AsyncStorage.getItem(SESSION_USER_KEY).catch(() => null);
}

export async function setSessionUserId(userId: string | number): Promise<void> {
  await AsyncStorage.setItem(SESSION_USER_KEY, String(userId)).catch(() => {});
}

/** Teardown: remove every account's view state, the legacy key and the session user id. */
export async function clearAllViewState(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const doomed = keys.filter(k => k.startsWith(VIEW_STATE_PREFIX));
    await AsyncStorage.multiRemove([...doomed, LEGACY_DRIVER_MODE_KEY, SESSION_USER_KEY]);
  } catch {
    await AsyncStorage.multiRemove([LEGACY_DRIVER_MODE_KEY, SESSION_USER_KEY]).catch(() => {});
  }
}
