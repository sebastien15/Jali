import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import { DriverCar } from "@/constants/data";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { OwnerRentalSummary } from "../rentals";

interface RentalCardProps {
  driverCars: DriverCar[];
}

/** Drive tab: my rental cars and new rental requests (S24.7) */
export function FleetActionCard({ driverCars }: RentalCardProps) {
  const { t } = useTranslation();
  const { data: s } = useQuery({
    queryKey: queryKeys.driver.rentalSummary(),
    queryFn: () => api.get<OwnerRentalSummary>("/driver/rentals/summary").then(r => r.data),
    refetchInterval: 60_000,
  });
  const requests = s?.requests ?? 0;

  return (
    <View style={{ marginBottom: 20, gap: 10 }}>
      <TouchableOpacity onPress={() => router.push("/driver/fleet")} accessibilityLabel={t("drive.myFleet")}
        style={{ backgroundColor: C.white, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 14,
          shadowColor: C.dark, shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2, borderLeftWidth: 4, borderLeftColor: C.teal }}>
        <View style={{ backgroundColor: C.tealLt, borderRadius: 12, width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="car-sport" size={22} color={C.teal} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "800", fontSize: 15, color: C.dark }}>{t("drive.myFleet")} ({driverCars.length})</Text>
          <Text style={{ color: C.mid, fontSize: 12, marginTop: 2 }}>
            {s ? `${s.upcoming} upcoming · ${s.active} on the road${s.cars_pending ? ` · ${s.cars_pending} in review` : ""}` : t("rental.fleet.subtitle", "Car rental owner")}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.muted} />
      </TouchableOpacity>
      {requests > 0 && (
        <TouchableOpacity onPress={() => router.push("/driver/rentals" as any)} accessibilityLabel={t("rental.fleet.requests", "Requests and rentals")}
          style={{ backgroundColor: C.orangeLt, borderRadius: 14, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Ionicons name="notifications-outline" size={20} color={C.orange} />
          <Text style={{ flex: 1, color: C.dark, fontWeight: "800" }}>
            {t("rental.fleet.newRequests", { count: requests, defaultValue: `${requests} new rental request${requests > 1 ? "s" : ""} — answer within 12 h` })}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={C.orange} />
        </TouchableOpacity>
      )}
    </View>
  );
}
