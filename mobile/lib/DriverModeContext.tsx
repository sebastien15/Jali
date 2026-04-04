import { createContext, useContext, useState, ReactNode } from "react";

interface DriverModeCtx {
  driverMode: boolean;
  setDriverMode: (v: boolean) => void;
}

const DriverModeContext = createContext<DriverModeCtx>({
  driverMode: false,
  setDriverMode: () => {},
});

export function DriverModeProvider({ children }: { children: ReactNode }) {
  const [driverMode, setDriverMode] = useState(false);
  return (
    <DriverModeContext.Provider value={{ driverMode, setDriverMode }}>
      {children}
    </DriverModeContext.Provider>
  );
}

export function useDriverMode() {
  return useContext(DriverModeContext);
}
