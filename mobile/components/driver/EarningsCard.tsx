import { View, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { formatRwf } from "@/lib/fare";
import type { components } from "@/lib/apiSchema";

export type DriverEarnings = components["schemas"]["DriverEarnings"];

/** Drive tab: today's ride & hire earnings and what I owe Jali (story S5.4) */
export function EarningsCard() {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: queryKeys.driver.earnings(),
    queryFn: () => api.get<DriverEarnings>("/driver/earnings").then(r => r.data),
    staleTime: 60_000,
  });
  if (!data) return null;
  const today = data.periods.today;

  return (
    <TouchableOpacity onPress={() => router.push("/driver/earnings" as any)} accessibilityLabel={t("earnings.title")}
      style={{ backgroundColor: C.white, borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: data.blocked ? C.orange : C.border }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontWeight: "900", fontSize: 16, color: C.dark }}>{t("earnings.today")}</Text>
        <Ionicons name="chevron-forward" size={18} color={C.muted} />
      </View>
      <View style={{ flexDirection: "row", marginTop: 8, gap: 16 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: "900", color: C.green }}>{formatRwf(today.earnings)}</Text>
          <Text style={{ color: C.mid, fontSize: 12 }}>{t("earnings.trips", { count: today.trips })}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 16, fontWeight: "900", color: data.owed ? C.orange : C.dark }}>{formatRwf(data.owed)}</Text>
          <Text style={{ color: C.mid, fontSize: 12 }}>{t("earnings.owed")}</Text>
        </View>
      </View>
      {data.blocked ? (
        <View style={{ marginTop: 10, backgroundColor: C.orangeLt, borderRadius: 10, padding: 10 }}>
          <Text style={{ color: C.orange, fontWeight: "800" }}>{t("earnings.blocked", { max: formatRwf(data.max_owed) })}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
