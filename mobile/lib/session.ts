import { signOut } from "firebase/auth";
import api, { clearApiToken, getApiToken, setApiToken } from "@/lib/api";
import { auth } from "@/lib/firebase";
import { GoogleSignin } from "@/lib/native/google-signin";
import { clearQueryCache } from "@/lib/queryClient";

/**
 * Begin a session for a freshly issued API token. Wipes any cache left by a
 * previous account (e.g. one whose token simply expired) before storing it.
 */
export async function startSession(token: string): Promise<void> {
  await clearQueryCache();
  setApiToken(token);
}

/**
 * End the session locally first — token, query cache (memory + disk),
 * Google and Firebase — and only then tell the backend, best-effort. A
 * failing /auth/logout (offline, expired token, 5xx) must never leave the
 * user logged in on this device.
 */
export async function endSession(): Promise<void> {
  const token = await getApiToken();
  clearApiToken();
  await clearQueryCache();
  GoogleSignin.signOut().catch(() => {});
  signOut(auth).catch(() => {});
  if (token) {
    api
      .post("/auth/logout", {}, { headers: { Authorization: `Bearer ${token}` } })
      .catch(() => {});
  }
}

/** Local cleanup after the account itself was deleted on the server. */
export async function clearLocalSession(): Promise<void> {
  clearApiToken();
  await clearQueryCache();
  GoogleSignin.signOut().catch(() => {});
  signOut(auth).catch(() => {});
}
