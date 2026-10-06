import { View, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useDriverMode } from "@/core/session/DriverModeContext";
import { DriverHire, isActiveHire, formatWhen } from "../hire";

type Page = { data: DriverHire[]; next_page: number | null };

/** Home entry to Hire a Driver (epic E6); shows my next booking when I have one. */
export function HireDriverBar() {
  const { t, i18n } = useTranslation();
  const { permissions } = useDriverMode();
  const { data } = useQuery({
    queryKey: queryKeys.hire.mine(),
    queryFn: () => api.get<Page>("/driver-hire").then(r => r.data),
    enabled: permissions.includes("request-rides"),
    staleTime: 60_000,
  });
  const next = data?.data.filter(isActiveHire).sort((a, b) => a.start_at.localeCompare(b.start_at))[0];

  return (
    <TouchableOpacity onPress={() => router.push((next ? `/hire/${next.id}` : "/hire") as any)} accessibilityLabel={t("hire.bar")}
      style={{ marginHorizontal: 16, marginTop: 8, marginBottom: 4, backgroundColor: C.white, borderRadius: 16, padding: 14,
        flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: next ? C.teal : C.border }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.teal, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="key" size={19} color={C.white} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "900", fontSize: 16, color: C.dark }}>{next ? t("hire.barNext") : t("hire.bar")}</Text>
        <Text numberOfLines={1} style={{ color: C.muted, fontSize: 12, marginTop: 1 }}>
          {next ? `${formatWhen(next.start_at, i18n.language)} · ${t(`hire.status.${next.status}`, { name: next.driver.name })}` : t("hire.barSub")}
        </Text>
      </View>
      <Ionicons name="arrow-forward" size={20} color={C.dark} />
    </TouchableOpacity>
  );
}
