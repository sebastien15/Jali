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

type SidebarCtx = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  user: { name: string; email: string; roles: string[] } | null;
  isSuperAdmin: boolean;
  handleLogout: () => Promise<void>;
};

const Ctx = createContext<SidebarCtx | null>(null);

export function AdminSidebarProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<SidebarCtx["user"]>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    api
      .post("/auth/login")
      .then((res) => {
        if (mountedRef.current) {
          setUser({
            name: res.data.user?.name ?? "Admin",
            email: res.data.user?.email ?? "",
            roles: res.data.user?.roles ?? [],
          });
        }
      })
      .catch(() => {});
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const isSuperAdmin = user?.roles?.includes(ROLES.SUPERADMIN) ?? false;

  async function handleLogout() {
    try {
      await signOut(auth);
      router.replace("/(auth)/login");
    } catch {}
  }

  return (
    <Ctx.Provider
      value={{ isOpen, open, close, user, isSuperAdmin, handleLogout }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAdminSidebar() {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error("useAdminSidebar must be used within AdminSidebarProvider");
  return ctx;
}
