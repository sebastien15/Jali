import { Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { Ride, isActive } from "../rides";
import { useDriverMode } from "@/lib/DriverModeContext";

/** Shared /rides/active query — the rider's or driver's current ride, or null. */
export function useActiveRide(enabled = true) {
  return useQuery({
    queryKey: queryKeys.rides.active(),
    queryFn: () => api.get<Ride | null>("/rides/active").then(r => r.data ?? null),
    enabled,
    refetchInterval: 15_000,
  });
}

/** "Your ride" (Home) / "Current ride" (Drive tab) banner that reopens the live trip screen. */
export function ActiveRideBanner({ role }: { role: "rider" | "driver" }) {
  const { t } = useTranslation();
  // Guests and users without ride access never call the API (a 401 would bounce them to login)
  const { permissions } = useDriverMode();
  const { data: ride } = useActiveRide(permissions.includes("request-rides"));
  if (!ride || !isActive(ride) || ride.role !== role) return null;

  const title = role === "rider" ? t("ride.trip.yourRide") : t("ride.driverTrip.currentRide");
  const sub = role === "rider" ? t("ride.trip.yourRideSub") : t("ride.driverTrip.currentRideSub");
  const href = role === "rider" ? `/ride/${ride.id}` : `/driver/ride/${ride.id}`;

  return (
    <TouchableOpacity onPress={() => router.push(href as any)} accessibilityLabel={title}
      style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: C.dark, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.teal, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="car" size={20} color={C.white} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "900", fontSize: 16, color: C.white }}>{title}</Text>
        <Text numberOfLines={1} style={{ color: C.muted, fontSize: 12, marginTop: 1 }}>{sub} · {ride.dropoff.address?.split(",")[0] ?? ""}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={C.white} />
    </TouchableOpacity>
  );
}
