import { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { formatRwf } from "@/lib/fare";
import { DriverHire, formatWhen } from "../hire";

/** Drive tab: hire requests to answer, upcoming hires, and a link to hire settings (S6.1, S6.4). */
export function HireRequestsCard() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<number | null>(null);

  const requests = useQuery({
    queryKey: queryKeys.driver.hires("requests"),
    queryFn: () => api.get<DriverHire[]>("/driver/hires", { params: { scope: "requests" } }).then(r => r.data),
    refetchInterval: 30_000,
  });
  const upcoming = useQuery({
    queryKey: queryKeys.driver.hires("upcoming"),
    queryFn: () => api.get<DriverHire[]>("/driver/hires", { params: { scope: "upcoming" } }).then(r => r.data),
  });

  async function answer(hire: DriverHire, action: "accept" | "decline") {
    setBusyId(hire.id);
    try {
      await api.post(`/driver-hire/${hire.id}/${action}`);
      if (action === "accept") router.push(`/driver/hire/${hire.id}` as any);
    } catch (err: any) {
      Alert.alert(err?.response?.data?.message ?? "Error");
    } finally {
      setBusyId(null);
      queryClient.invalidateQueries({ queryKey: ["driver", "hires"] });
    }
  }

  return (
    <View style={{ backgroundColor: C.white, borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.border, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.tealLt, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="key" size={18} color={C.teal} />
        </View>
        <Text style={{ flex: 1, fontWeight: "900", fontSize: 16, color: C.dark }}>{t("hire.driver.title")}</Text>
        <TouchableOpacity onPress={() => router.push("/driver/hire-settings" as any)} accessibilityLabel={t("hire.settings.title")}>
          <Text style={{ color: C.teal, fontWeight: "800" }}>{t("hire.driver.settings")}</Text>
        </TouchableOpacity>
      </View>

      {requests.isLoading ? <ActivityIndicator color={C.teal} /> : null}
      {requests.data?.map(h => (
        <View key={h.id} style={{ backgroundColor: C.bg, borderRadius: 14, padding: 12, gap: 4 }}>
          <Text style={{ fontWeight: "900", color: C.dark }}>{t("hire.driver.newRequest")}</Text>
          <Text style={{ color: C.dark }}>{formatWhen(h.start_at, i18n.language)} · {h.duration_type === "days" ? t("hire.days", { count: h.duration_value }) : t("hire.hours", { count: h.duration_value })}</Text>
          <Text style={{ color: C.mid, fontSize: 12 }}>{t(`hire.trip_${h.trip_type}`)} · {t(`hire.tr_${h.transmission}`)} · {h.pickup.address ?? ""}</Text>
          {h.driver_earnings != null ? <Text style={{ color: C.green, fontWeight: "800" }}>{t("ride.driverTrip.youEarn", { amount: formatRwf(h.driver_earnings) })}</Text> : null}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
            <TouchableOpacity onPress={() => answer(h, "decline")} disabled={busyId === h.id} accessibilityLabel={t("ride.driverTrip.decline")}
              style={{ flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: "center", backgroundColor: C.white, borderWidth: 1, borderColor: C.border }}>
              <Text style={{ color: C.dark, fontWeight: "800" }}>{t("ride.driverTrip.decline")}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => answer(h, "accept")} disabled={busyId === h.id} accessibilityLabel={t("ride.driverTrip.accept")}
              style={{ flex: 2, borderRadius: 12, paddingVertical: 11, alignItems: "center", backgroundColor: C.teal }}>
              {busyId === h.id ? <ActivityIndicator color={C.white} /> : <Text style={{ color: C.white, fontWeight: "900" }}>{t("ride.driverTrip.accept")}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {upcoming.data?.length ? (
        <>
          <Text style={{ fontWeight: "800", color: C.mid, fontSize: 12, marginTop: 4 }}>{t("hire.driver.upcoming")}</Text>
          {upcoming.data.map(h => (
            <TouchableOpacity key={h.id} onPress={() => router.push(`/driver/hire/${h.id}` as any)} accessibilityLabel={formatWhen(h.start_at, i18n.language)}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.border }}>
              <Ionicons name={h.status === "started" ? "play-circle" : "calendar-outline"} size={20} color={h.status === "started" ? C.green : C.teal} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "800", color: C.dark }}>{formatWhen(h.start_at, i18n.language)}</Text>
                <Text numberOfLines={1} style={{ color: C.mid, fontSize: 12 }}>{h.customer?.name} · {h.pickup.address ?? ""}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.muted} />
            </TouchableOpacity>
          ))}
        </>
      ) : null}

      {!requests.isLoading && !requests.data?.length && !upcoming.data?.length ? (
        <Text style={{ color: C.mid, fontSize: 13 }}>{t("hire.driver.empty")}</Text>
      ) : null}
    </View>
  );
}
