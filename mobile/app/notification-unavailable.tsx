import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";

/** A tapped notification points to something deleted or not on this account (S23.5) */
export default function NotificationUnavailable() {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
        <Ionicons name="notifications-off-outline" size={52} color={C.muted} />
        <Text style={{ fontWeight: "900", fontSize: 18, color: C.dark, textAlign: "center" }}>
          {t("notifications.unavailableTitle", "This is no longer available")}
        </Text>
        <Text style={{ color: C.mid, textAlign: "center" }}>
          {t("notifications.unavailableText", "It may have been removed, or it belongs to another account.")}
        </Text>
        <TouchableOpacity onPress={() => router.replace("/" as any)} accessibilityLabel={t("notifications.goHome", "Go to home")}
          style={{ backgroundColor: C.teal, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 12, marginTop: 8 }}>
          <Text style={{ color: C.white, fontWeight: "800" }}>{t("notifications.goHome", "Go to home")}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
