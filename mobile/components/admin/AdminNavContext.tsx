import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
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
  isOpen: boolean;
  open: () => void;
  close: () => void;
  user: AdminUser | null;
  isSuperAdmin: boolean;
  handleLogout: () => Promise<void>;
};

const Ctx = createContext<AdminNavCtx | null>(null);

export function AdminNavProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<AdminUser | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        const res = await api.get("/admin/profile");
        if (mountedRef.current) {
          setUser({
            name: res.data.name ?? "Admin",
            email: res.data.email ?? "",
            roles: res.data.roles ?? [],
            profile_image_url: res.data.profile_image_url ?? null,
            location: res.data.location ?? null,
          });
        }
      } catch {
        if (mountedRef.current) {
          setUser({ name: "Admin", email: "", roles: [], profile_image_url: null, location: null });
        }
      }
    })();
    return () => { mountedRef.current = false; };
  }, []);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const isSuperAdmin = user?.roles?.includes(ROLES.SUPERADMIN) ?? false;

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
      router.replace("/(auth)/login");
    } catch {}
  }, []);

  return (
    <Ctx.Provider value={{ isOpen, open, close, user, isSuperAdmin, handleLogout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAdminNav() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAdminNav must be used within AdminNavProvider");
  return ctx;
}
