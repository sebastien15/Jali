import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "@/lib/api";

export type DriverType = "private" | "rental" | "ride" | "hire" | null;

/** AsyncStorage key — cleared by clearApiToken() on logout. */
export const DRIVER_MODE_KEY = "jali_driver_mode";

/** Driver type in the app ↔ service name stored on the driver profile (backend). */
const SERVICE_FOR_TYPE: Record<Exclude<DriverType, null>, string> = {
  private: "private_seat",
  rental: "rental",
  ride: "ride",
  hire: "hire",
};

const DRIVER_PERMISSIONS = ["create-private-seats", "offer-rides", "offer-driver-hire"];

interface DriverModeCtx {
  driverMode: boolean;
  driverType: DriverType;
  /** false until the saved state has been read from storage */
  hydrated: boolean;
  /** Permission names from /me (empty until loaded or for signed-out users) */
  permissions: string[];
  setDriverMode: (v: boolean) => void;
  setDriverType: (t: DriverType) => void;
}

const DriverModeContext = createContext<DriverModeCtx>({
  driverMode: false,
  driverType: null,
  hydrated: false,
  permissions: [],
  setDriverMode: () => {},
  setDriverType: () => {},
});

type Stored = { driverMode: boolean; driverType: DriverType };

function typeFromServices(services: string[] | undefined): DriverType {
  if (!services?.length) return null;
  const match = (Object.keys(SERVICE_FOR_TYPE) as Exclude<DriverType, null>[])
    .find(t => services.includes(SERVICE_FOR_TYPE[t]));
  return match ?? null;
}

async function fetchPermissions(): Promise<string[]> {
  const me = await api.get("/me").then(r => r.data?.user ?? r.data);
  return me?.permissions ?? [];
}

/**
 * Mounted in the root layout so every screen — including driver/setup,
 * driver/fleet and driver/listing, which live outside (tabs) — sees the same
 * values. The choice is persisted so it survives app restarts.
 */
export function DriverModeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Stored>({ driverMode: false, driverType: null });
  const [hydrated, setHydrated] = useState(false);
  const [isDriver, setIsDriver] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);

  // 1) Restore what this phone remembers, 2) fill gaps from the server (new phone / reinstall)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let local: Stored | null = null;
      try {
        const raw = await AsyncStorage.getItem(DRIVER_MODE_KEY);
        local = raw ? JSON.parse(raw) : null;
      } catch {
        local = null;
      }
      if (cancelled) return;
      if (local) setState(local);
      setHydrated(true);

      try {
        const perms = await fetchPermissions();
        if (cancelled) return;
        setPermissions(perms);
        if (!DRIVER_PERMISSIONS.some(p => perms.includes(p))) return;
        setIsDriver(true);
        if (local?.driverType) return;
        const profile = await api.get("/driver/profile").then(r => r.data?.profile);
        const serverType = typeFromServices(profile?.services);
        if (!cancelled && serverType) {
          const restored = { driverMode: true, driverType: serverType };
          setState(restored);
          AsyncStorage.setItem(DRIVER_MODE_KEY, JSON.stringify(restored)).catch(() => {});
        }
      } catch {
        // Offline or not a driver yet — the local state is enough
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const persist = useCallback((next: Stored) => {
    AsyncStorage.setItem(DRIVER_MODE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const setDriverMode = useCallback((driverMode: boolean) => {
    setState(prev => {
      const next = { ...prev, driverMode };
      persist(next);
      return next;
    });
  }, [persist]);

  const setDriverType = useCallback((driverType: DriverType) => {
    setState(prev => {
      const next = { ...prev, driverType };
      persist(next);
      return next;
    });
    // Remember the offered service on the server so it follows the driver to a new phone
    if (driverType && isDriver) {
      api.patch("/driver/profile", { services: [SERVICE_FOR_TYPE[driverType]] }).catch(() => {});
    }
  }, [persist, isDriver]);

  return (
    <DriverModeContext.Provider value={{ ...state, hydrated, permissions, setDriverMode, setDriverType }}>
      {children}
    </DriverModeContext.Provider>
  );
}

export function useDriverMode() {
  return useContext(DriverModeContext);
}
