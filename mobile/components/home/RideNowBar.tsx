import { View, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";

/** Entry to on-demand rides from Home (story S3.1) */
export function RideNowBar() {
  const { t } = useTranslation();
  return (
    <TouchableOpacity onPress={() => router.push("/ride")} accessibilityLabel={t("ride.where.bar")}
      style={{ marginHorizontal: 16, marginTop: 12, marginBottom: 4, backgroundColor: C.white, borderRadius: 16, padding: 14,
        flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: C.border }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.dark, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="car-sport" size={20} color={C.white} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "900", fontSize: 16, color: C.dark }}>{t("ride.where.bar")}</Text>
        <Text style={{ color: C.muted, fontSize: 12, marginTop: 1 }}>{t("ride.where.barSub")}</Text>
      </View>
      <Ionicons name="arrow-forward" size={20} color={C.dark} />
    </TouchableOpacity>
  );
}
