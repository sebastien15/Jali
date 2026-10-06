import type { ReactNode } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import { useServiceAccess, unavailableMessage, type ServiceId } from "../serviceAccess";

/**
 * Wraps the entry screen of a service (new requests only — booking details
 * and history are never gated). A deep link to a service that isn't taking
 * new requests shows a clear "not available" screen instead (S23.2).
 */
export function ServiceGate({ service, children }: { service: ServiceId; children: ReactNode }) {
  const { t } = useTranslation();
  const access = useServiceAccess();
  const entry = access.entry(service);
  if (access.loading || (entry.discoverable && entry.accepting_new_requests)) return <>{children}</>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
        <Ionicons name={entry.reason_code === "app_update_required" ? "cloud-download-outline" : "time-outline"} size={52} color={C.muted} />
        <Text style={{ fontWeight: "900", fontSize: 18, color: C.dark, textAlign: "center" }}>
          {t("services.notAvailableTitle", "Not available yet")}
        </Text>
        <Text style={{ color: C.mid, textAlign: "center" }}>{unavailableMessage(entry)}</Text>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)" as any))}
          accessibilityLabel={t("services.back", "Back")}
          style={{ backgroundColor: C.teal, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 12, marginTop: 8 }}>
          <Text style={{ color: C.white, fontWeight: "800" }}>{t("services.back", "Back")}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
