import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import api from "@/lib/api";
import { ROLES } from "@/constants/roles";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

type AdminUser = {
  name: string;
  email: string;
  roles: string[];
  profile_image_url: string | null;
  location: { name: string; city: string } | null;
};

type AdminNavCtx = {
  user: AdminUser | null;
  isSuperAdmin: boolean;
  handleLogout: () => Promise<void>;
};

const Ctx = createContext<AdminNavCtx | null>(null);

export function AdminNavProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        // Get roles from auth endpoint
        console.log("[AdminNav] Fetching /auth/login...");
        const authRes = await api.post("/auth/login");
        console.log(
          "[AdminNav] /auth/login response:",
          JSON.stringify(authRes.data),
        );
        const authRoles = authRes.data.user?.roles ?? [];

        // Get profile data
        try {
          const profileRes = await api.get("/admin/profile");
          console.log(
            "[AdminNav] /admin/profile response:",
            JSON.stringify(profileRes.data),
          );
          if (mountedRef.current) {
            setUser({
              name: profileRes.data.name ?? authRes.data.user?.name ?? "Admin",
              email: profileRes.data.email ?? authRes.data.user?.email ?? "",
              roles: profileRes.data.roles ?? authRoles,
              profile_image_url: profileRes.data.profile_image_url ?? null,
              location: profileRes.data.location ?? null,
            });
          }
        } catch (e) {
          console.log(
            "[AdminNav] /admin/profile failed, falling back to auth data",
          );
          if (mountedRef.current) {
            setUser({
              name: authRes.data.user?.name ?? "Admin",
              email: authRes.data.user?.email ?? "",
              roles: authRoles,
              profile_image_url: null,
              location: null,
            });
          }
        }
      } catch (e) {
        console.log("[AdminNav] /auth/login FAILED:", e);
        if (mountedRef.current) {
          setUser({
            name: "Admin",
            email: "",
            roles: [],
            profile_image_url: null,
            location: null,
          });
        }
      }
    })();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isSuperAdmin = user?.roles?.includes(ROLES.SUPERADMIN) ?? false;

  // Debug
  useEffect(() => {
    console.log(
      "[AdminNav] user:",
      user?.name,
      "roles:",
      user?.roles,
      "isSuperAdmin:",
      isSuperAdmin,
    );
  }, [user]);

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
      router.replace("/(auth)/login");
    } catch {}
  }, []);

  return (
    <Ctx.Provider value={{ user, isSuperAdmin, handleLogout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAdminNav() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAdminNav must be used within AdminNavProvider");
  return ctx;
}
