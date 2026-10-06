import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ROLES } from "@/constants/roles";
import { router } from "expo-router";
import api, { getApiToken } from "@/lib/api";
import { endSession } from "@/lib/session";
import { queryKeys } from "@/lib/queryKeys";

type AdminUser = {
  name: string;
  email: string;
  roles: string;
  permissions: string[];
  profile_image_url: string | null;
  location: { name: string; city: string } | null;
};

type AdminNavCtx = {
  user: AdminUser | null;
  isSuperAdmin: boolean;
  loading: boolean;
  refetch: () => Promise<void>;
  handleLogout: () => Promise<void>;
};

const Ctx = createContext<AdminNavCtx | null>(null);

export function AdminNavProvider({ children }: { children: React.ReactNode }) {
  const [tokenChecked, setTokenChecked] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  // Check for token once on mount — gates the /me query
  useEffect(() => {
    getApiToken().then((token) => {
      setHasToken(!!token);
      setTokenChecked(true);
    });
  }, []);

  const { data: user, isLoading, refetch: refetchQuery } = useQuery({
    queryKey: queryKeys.me(),
    queryFn: () => api.get("/me").then((r) => r.data as AdminUser),
    staleTime: Infinity,   // role/permissions never change mid-session
    enabled: hasToken,
    retry: false,
  });

  const isSuperAdmin = user?.roles === ROLES.SUPERADMIN;

  // True while: (a) initial token check not done, or (b) token exists and /me is loading
  const loading = !tokenChecked || (hasToken && isLoading);

  // Called after login — re-checks token then triggers /me fetch
  const refetch = useCallback(async () => {
    const token = await getApiToken();
    if (token) {
      setHasToken(true);
      await refetchQuery();
    }
  }, [refetchQuery]);

  const handleLogout = useCallback(async () => {
    // Local state is cleared first (token, query cache, Firebase); the
    // /auth/logout call is best-effort so a failing request can't keep
    // the admin signed in on this device.
    await endSession();
    try {
      localStorage.clear();
      sessionStorage.clear();
      ["firebaseLocalStorageDb", "firebaseInstallationsDb", "firebase-messaging-store"]
        .forEach((db) => indexedDB.deleteDatabase(db));
    } catch {}
    setHasToken(false);
    router.replace("/(auth)/login");
  }, []);

  return (
    <Ctx.Provider value={{ user: user ?? null, isSuperAdmin, loading, refetch, handleLogout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAdminNav() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAdminNav must be used within AdminNavProvider");
  return ctx;
}
