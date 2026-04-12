import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  Alert,
} from "react";
import { ROLES } from "@/constants/roles";
import { router } from "expo-router";
import api, { clearApiToken } from "@/lib/api";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

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
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchUser = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/me");
      if (mountedRef.current) setUser(res.data);
    } catch {
      if (mountedRef.current) setUser(null);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchUser();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchUser]);

  const isSuperAdmin = user?.roles === "superadmin";

  const handleLogout = useCallback(async () => {
    try {
      console.log("[AdminNav] Logging out...");
      await api.post("/auth/logout");
      await clearApiToken();
      try {
        await signOut(auth);
      } catch {}
      try {
        localStorage.clear();
        sessionStorage.clear();
        [
          "firebaseLocalStorageDb",
          "firebaseInstallationsDb",
          "firebase-messaging-store",
        ].forEach((db) => indexedDB.deleteDatabase(db));
      } catch {}
      console.log("[AdminNav] Redirecting to login...");
      router.replace("/(auth)/login");
    } catch (e) {
      console.log("[AdminNav] logout error:", e);
      router.replace("/(auth)/login");
    }
  }, []);

  return (
    <Ctx.Provider value={{ user, isSuperAdmin, loading, refetch: fetchUser, handleLogout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAdminNav() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAdminNav must be used within AdminNavProvider");
  return ctx;
}
