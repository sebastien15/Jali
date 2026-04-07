import { createContext, useContext, useState, ReactNode } from "react";

export type DriverType = "private" | "rental" | null;

interface DriverModeCtx {
  driverMode: boolean;
  driverType: DriverType;
  setDriverMode: (v: boolean) => void;
  setDriverType: (t: DriverType) => void;
}

const DriverModeContext = createContext<DriverModeCtx>({
  driverMode: false,
  driverType: null,
  setDriverMode: () => {},
  setDriverType: () => {},
});

export function DriverModeProvider({ children }: { children: ReactNode }) {
  const [driverMode, setDriverMode] = useState(false);
  const [driverType, setDriverType] = useState<DriverType>(null);
  return (
    <DriverModeContext.Provider value={{ driverMode, setDriverMode, driverType, setDriverType }}>
      {children}
    </DriverModeContext.Provider>
  );
}

export function useDriverMode() {
  return useContext(DriverModeContext);
}
