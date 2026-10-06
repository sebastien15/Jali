import { signOut } from "firebase/auth";
import { router } from "expo-router";
import api, { clearApiToken, getApiToken, setApiToken, setUnauthorizedHandler } from "@/lib/api";
import { auth } from "@/lib/firebase";
import { GoogleSignin } from "@/lib/native/google-signin";
import { clearQueryCache } from "@/lib/queryClient";
import { bumpSessionGeneration, emitSessionChange } from "@/core/session/generation";
import { clearAllViewState, SESSION_USER_KEY } from "@/core/session/viewState";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearPendingIntent } from "@/core/notifications/notificationIntent";

/**
 * The single owner of session start/teardown (architecture runbook §5,
 * protocol 4–5). Every way out — customer logout, admin logout, a 401 and
 * account deletion — goes through endSession(); every login through
 * startSession(). Device preferences (language, currency, recent places)
 * are not session state and are never cleared here.
 */
export type EndSessionReason = "logout" | "admin_logout" | "unauthorized" | "account_deleted";

let ending: Promise<void> | null = null;

/**
 * Begin a session for a freshly issued API token: invalidate the previous
 * generation (abort + ignore its late responses), drop any cache or view
 * state left by a previous account (e.g. one whose token simply expired),
 * then store the token and let session-scoped state re-hydrate.
 */
export async function startSession(token: string): Promise<void> {
  bumpSessionGeneration();
  await clearQueryCache();
  await AsyncStorage.removeItem(SESSION_USER_KEY).catch(() => {});
  setApiToken(token);
  emitSessionChange();
}

/**
 * End the session locally — generation, token (memory + disk), in-flight
 * queries, query cache (memory + persisted), view state, Google and
 * Firebase — and only then tell the backend, best-effort. A failing
 * /auth/logout (offline, expired token, 5xx) never leaves the user signed in
 * on this device. Concurrent calls (a burst of 401s) share one teardown.
 */
export function endSession(reason: EndSessionReason = "logout"): Promise<void> {
  if (ending) return ending;
  ending = (async () => {
    // A failed storage read must not skip local cleanup; we only lose the
    // best-effort server logout.
    const token = await getApiToken().catch(() => null);
    bumpSessionGeneration();
    await clearApiToken();
    await clearQueryCache();
    await clearAllViewState();
    // A tap kept for after login belongs to this device's previous session (S23.5)
    await clearPendingIntent();
    GoogleSignin.signOut().catch(() => {});
    signOut(auth).catch(() => {});
    emitSessionChange();
    const serverLogout = reason === "logout" || reason === "admin_logout";
    if (serverLogout && token) {
      api
        .post("/auth/logout", {}, { headers: { Authorization: `Bearer ${token}` } })
        .catch(() => {});
    }
  })().finally(() => { ending = null; });
  return ending;
}

// A 401 on any authenticated request: tear down, then show the login screen.
setUnauthorizedHandler(async () => {
  await endSession("unauthorized");
  router.replace("/(auth)/login");
});
