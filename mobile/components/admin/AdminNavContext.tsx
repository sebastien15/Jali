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
  handleLogout: () => Promise<void>;
};

const Ctx = createContext<AdminNavCtx | null>(null);

export function AdminNavProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        console.warn("[AdminNav] Fetching /me...");
        const res = await api.get("/me");
        console.warn(
          "[AdminNav] /me response:",
          JSON.stringify(res.data, null, 2),
        );
        if (mountedRef.current) {
          console.warn(
            "[AdminNav] Setting user:",
            res.data?.name,
            "Role:",
            res.data?.roles,
          );
          setUser(res.data);
          setLoading(false);
        }
      } catch (e: any) {
        console.error(
          "[AdminNav] /me FAILED:",
          e.response?.status,
          JSON.stringify(e.response?.data),
        );
        if (mountedRef.current) {
          setUser(null);
          setLoading(false);
        }
      }
    })();
    return () => {
      mountedRef.current = false;
    };
  }, []);

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
    <Ctx.Provider value={{ user, isSuperAdmin, loading, handleLogout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAdminNav() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAdminNav must be used within AdminNavProvider");
  return ctx;
}
