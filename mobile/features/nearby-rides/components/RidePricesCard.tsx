import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";

/** Entry to driver-set ride prices (on-demand rides, story S2.1). */
export function RidePricesCard() {
  const { t } = useTranslation();

  return (
    <TouchableOpacity
      onPress={() => router.push("/driver/rates")}
      accessibilityLabel={t("ride.rates.cardTitle")}
      style={{
        backgroundColor: C.white,
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        borderWidth: 1,
        borderColor: C.border,
      }}
    >
      <View style={{ backgroundColor: C.tealLt, borderRadius: 12, width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="pricetags-outline" size={22} color={C.teal} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "800", fontSize: 15, color: C.dark }}>{t("ride.rates.cardTitle")}</Text>
        <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{t("ride.rates.cardSub")}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={C.muted} />
    </TouchableOpacity>
  );
}
