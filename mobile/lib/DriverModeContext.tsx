import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type DriverType = "private" | "rental" | null;

interface DriverModeCtx {
  driverMode: boolean;
  driverType: DriverType;
  setDriverMode: (v: boolean) => void;
  setDriverType: (t: DriverType) => void;
}

const STORAGE_KEY = "jali_driver_mode";

const DriverModeContext = createContext<DriverModeCtx>({
  driverMode: false,
  driverType: null,
  setDriverMode: () => {},
  setDriverType: () => {},
});

/**
 * Mounted in the root layout so every screen — including driver/setup,
 * driver/fleet and driver/listing, which live outside (tabs) — sees the same
 * values. The choice is persisted so it survives app restarts.
 */
export function DriverModeProvider({ children }: { children: ReactNode }) {
  const [driverMode, setDriverModeState] = useState(false);
  const [driverType, setDriverTypeState] = useState<DriverType>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as { driverMode?: boolean; driverType?: DriverType };
        setDriverModeState(!!saved.driverMode);
        if (saved.driverType === "private" || saved.driverType === "rental") {
          setDriverTypeState(saved.driverType);
        }
      })
      .catch(() => {});
  }, []);

  const persist = (mode: boolean, type: DriverType) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ driverMode: mode, driverType: type })).catch(() => {});
  };

  const setDriverMode = useCallback((v: boolean) => {
    setDriverModeState(v);
    setDriverTypeState((type) => { persist(v, type); return type; });
  }, []);

  const setDriverType = useCallback((type: DriverType) => {
    setDriverTypeState(type);
    setDriverModeState((mode) => { persist(mode, type); return mode; });
  }, []);

  return (
    <DriverModeContext.Provider value={{ driverMode, setDriverMode, driverType, setDriverType }}>
      {children}
    </DriverModeContext.Provider>
  );
}

export function useDriverMode() {
  return useContext(DriverModeContext);
}
