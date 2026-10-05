import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { components } from "@/lib/apiSchema";

export type PresenceState = components["schemas"]["DriverPresenceState"];

const HEARTBEAT_MS = 8_000;

/**
 * Online/offline switch for on-demand rides (story S5.1).
 * Phase 1: foreground only — while online and the app is open, the position is
 * sent every 8 s. If the app is closed the backend marks the driver offline after
 * presence_ttl_sec. Background location (expo-task-manager) is a follow-up.
 */
export function useDriverPresence(enabled: boolean) {
  const queryClient = useQueryClient();
  const [switching, setSwitching] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const watcher = useRef<Location.LocationSubscription | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const position = useRef<Location.LocationObject | null>(null);

  const { data } = useQuery({
    queryKey: queryKeys.driver.presence(),
    queryFn: () => api.get<PresenceState>("/driver/presence").then(r => r.data),
    enabled,
  });

  const stopTracking = useCallback(() => {
    watcher.current?.remove();
    watcher.current = null;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  const send = useCallback(async (online: boolean) => {
    const coords = position.current?.coords;
    const res = await api.post<PresenceState>("/driver/presence", online && coords
      ? { online, lat: coords.latitude, lng: coords.longitude, heading: coords.heading != null && coords.heading >= 0 ? coords.heading : null }
      : { online });
    queryClient.setQueryData(queryKeys.driver.presence(), res.data);
    if (online && !res.data.online) stopTracking();
    return res.data;
  }, [queryClient, stopTracking]);

  const startTracking = useCallback(async () => {
    stopTracking();
    watcher.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 5_000, distanceInterval: 15 },
      loc => { position.current = loc; },
    );
    timer.current = setInterval(() => { send(true).catch(() => {}); }, HEARTBEAT_MS);
  }, [send, stopTracking]);

  const goOnline = useCallback(async () => {
    setSwitching(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationDenied(true);
        return;
      }
      setLocationDenied(false);
      position.current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const state = await send(true);
      if (state.online) await startTracking();
    } finally {
      setSwitching(false);
    }
  }, [send, startTracking]);

  const goOffline = useCallback(async () => {
    setSwitching(true);
    stopTracking();
    try {
      await send(false);
    } finally {
      setSwitching(false);
    }
  }, [send, stopTracking]);

  // Resume heartbeats if the server still thinks we're online (e.g. screen remounted)
  useEffect(() => {
    if (data?.online && !timer.current) {
      Location.getForegroundPermissionsAsync().then(p => { if (p.status === "granted") startTracking(); });
    }
  }, [data?.online, startTracking]);

  useEffect(() => stopTracking, [stopTracking]);

  return {
    online: data?.online ?? false,
    blockedReasons: data?.blocked_reasons ?? [],
    loaded: !!data,
    switching,
    locationDenied,
    goOnline,
    goOffline,
  };
}
