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
        const authRes = await api.post("/auth/login");
        const authUser = authRes.data.user;
        const authRoles: string[] = authUser?.roles ?? [];

        let nextUser: AdminUser = {
          name: authUser?.name ?? "Admin",
          email: authUser?.email ?? "",
          roles: authRoles,
          profile_image_url: null,
          location: null,
        };

        try {
          const profileRes = await api.get("/admin/profile");
          const profile = profileRes.data;
          nextUser = {
            name: profile.name ?? nextUser.name,
            email: profile.email ?? nextUser.email,
            roles: profile.roles ?? authRoles,
            profile_image_url: profile.profile_image_url ?? null,
            location: profile.location ?? null,
          };
        } catch {
          // Fall back to auth payload
        }

        if (mountedRef.current) {
          setUser(nextUser);
          setLoading(false);
        }
      } catch {
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

  const isSuperAdmin = user?.roles?.includes(ROLES.SUPERADMIN) ?? false;

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
      router.replace("/(auth)/login");
    } catch {}
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
