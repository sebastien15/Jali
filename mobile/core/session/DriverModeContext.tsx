import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import api, { getApiToken } from "@/lib/api";
import { getSessionGeneration, onSessionChange } from "@/core/session/generation";
import {
  DriverType, ViewState, getSessionUserId, readLegacyViewState, readViewState,
  setSessionUserId, writeViewState,
} from "@/core/session/viewState";

export type { DriverType } from "@/core/session/viewState";

/** Pre-M05 global AsyncStorage key; now migrated into `jali_view_state_v1:<userId>`. */
export { LEGACY_DRIVER_MODE_KEY as DRIVER_MODE_KEY } from "@/core/session/viewState";

/** Driver type in the app ↔ service name stored on the driver profile (backend). Read-only here. */
const SERVICE_FOR_TYPE: Record<Exclude<DriverType, null>, string> = {
  private: "private_seat",
  rental: "rental",
  ride: "ride",
  hire: "hire",
};

const DRIVER_PERMISSIONS = ["create-private-seats", "offer-rides", "offer-driver-hire"];

interface DriverModeCtx {
  /** View persona: provider dashboard visible (never the server online/availability state). */
  driverMode: boolean;
  /** Selected service for the provider view (never the server's offered-services set). */
  driverType: DriverType;
  /** false until the saved state has been read from storage */
  hydrated: boolean;
  /** Permission names from /me (empty until loaded or for signed-out users) */
  permissions: string[];
  /** View-only: persisted per account on this device, never sent to the server. */
  setDriverMode: (v: boolean) => void;
  /** View-only: persisted per account on this device, never sent to the server. */
  setDriverType: (t: DriverType) => void;
}

const DEFAULT_VIEW: ViewState = { driverMode: false, driverType: null };

const DriverModeContext = createContext<DriverModeCtx>({
  ...DEFAULT_VIEW,
  hydrated: false,
  permissions: [],
  setDriverMode: () => {},
  setDriverType: () => {},
});

function typeFromServices(services: string[] | undefined): DriverType {
  if (!services?.length) return null;
  const match = (Object.keys(SERVICE_FOR_TYPE) as Exclude<DriverType, null>[])
    .find(t => services.includes(SERVICE_FOR_TYPE[t]));
  return match ?? null;
}

/**
 * Transitional adapter for the view persona + selected service (runbook §5).
 * Mounted in the root layout so every screen — including driver/setup,
 * driver/fleet and driver/listing, which live outside (tabs) — sees the same
 * values. State is stored per account (`jali_view_state_v1:<userId>`) and
 * re-hydrated on every session start/end; setters never mutate the server.
 * Deliberate offered-service edits go through driver/onboarding, which sends
 * the full set.
 */
export function DriverModeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ViewState>(DEFAULT_VIEW);
  const [hydrated, setHydrated] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [sessionGen, setSessionGen] = useState(getSessionGeneration());
  // Account the current view state belongs to (null while unknown / signed out)
  const userIdRef = useRef<string | null>(null);

  useEffect(() => onSessionChange(() => setSessionGen(getSessionGeneration())), []);

  // Per session: 1) restore what this phone remembers for this account,
  // 2) fill gaps from the server (new phone / reinstall) — read-only.
  useEffect(() => {
    let cancelled = false;
    const live = () => !cancelled && getSessionGeneration() === sessionGen;
    userIdRef.current = null;
    setState(DEFAULT_VIEW);
    setPermissions([]);
    setHydrated(false);

    (async () => {
      if (!(await getApiToken())) {
        if (live()) setHydrated(true);
        return;
      }

      // Offline-friendly: the last confirmed account of this token, or the
      // legacy global value (read-only) until /me tells us who this is.
      const cachedUserId = await getSessionUserId();
      let local: ViewState | null = cachedUserId
        ? await readViewState(cachedUserId)
        : await readLegacyViewState();
      if (!live()) return;
      if (cachedUserId) userIdRef.current = cachedUserId;
      if (local) setState(local);
      setHydrated(true);

      try {
        const me = await api.get("/me").then(r => r.data?.user ?? r.data);
        if (!live() || me?.id == null) return;
        const userId = String(me.id);
        if (userId !== cachedUserId) {
          await setSessionUserId(userId);
          local = await readViewState(userId);
          if (!live()) return;
          userIdRef.current = userId;
          setState(local ?? DEFAULT_VIEW);
        }
        const perms: string[] = me?.permissions ?? [];
        setPermissions(perms);
        if (!DRIVER_PERMISSIONS.some(p => perms.includes(p))) return;
        if (local?.driverType) return;
        const profile = await api.get("/driver/profile").then(r => r.data?.profile);
        const serverType = typeFromServices(profile?.services);
        if (live() && serverType) {
          const restored: ViewState = { driverMode: true, driverType: serverType };
          setState(restored);
          writeViewState(userId, restored);
        }
      } catch {
        // Offline or not a driver yet — the local state is enough
      }
    })();
    return () => { cancelled = true; };
  }, [sessionGen]);

  const update = useCallback((patch: Partial<ViewState>) => {
    setState(prev => {
      const next = { ...prev, ...patch };
      if (userIdRef.current) writeViewState(userIdRef.current, next);
      return next;
    });
  }, []);

  const setDriverMode = useCallback((driverMode: boolean) => update({ driverMode }), [update]);
  const setDriverType = useCallback((driverType: DriverType) => update({ driverType }), [update]);

  return (
    <DriverModeContext.Provider value={{ ...state, hydrated, permissions, setDriverMode, setDriverType }}>
      {children}
    </DriverModeContext.Provider>
  );
}

export function useDriverMode() {
  return useContext(DriverModeContext);
}
