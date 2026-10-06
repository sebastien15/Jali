import { useState } from "react";
import { View, Text, TouchableOpacity, Alert, Share, Linking } from "react-native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { C } from "@/constants/theme";

/** Share my trip (S8.1) and SOS (S8.2) for the rider's and driver's trip screens. */
export function SafetyBar({ rideId, canShare }: { rideId: number; canShare: boolean }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  async function share() {
    setBusy(true);
    try {
      const { data } = await api.post<{ url: string }>(`/rides/${rideId}/share`);
      await Share.share({ message: t("safety.shareMessage", { url: data.url }) });
    } catch (err: any) {
      if (err?.response) Alert.alert(err.response.data?.message ?? "Error");
    } finally {
      setBusy(false);
    }
  }

  function sos() {
    Alert.alert(t("safety.sosTitle"), t("safety.sosConfirm"), [
      { text: t("ride.trip.keep"), style: "cancel" },
      {
        text: t("safety.sosGo"), style: "destructive", onPress: async () => {
          let coords: { lat?: number; lng?: number } = {};
          try {
            const pos = await Location.getLastKnownPositionAsync();
            if (pos) coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          } catch { /* call 112 anyway */ }
          api.post(`/rides/${rideId}/sos`, coords).catch(() => {});
          Linking.openURL("tel:112").catch(() => {});
        },
      },
    ]);
  }

  return (
    <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
      {canShare ? (
        <TouchableOpacity onPress={share} disabled={busy} accessibilityLabel={t("safety.share")}
          style={{ flex: 1, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: C.white, borderRadius: 14, paddingVertical: 12, borderWidth: 1, borderColor: C.border }}>
          <Ionicons name="share-social-outline" size={18} color={C.dark} />
          <Text style={{ fontWeight: "800", color: C.dark }}>{t("safety.share")}</Text>
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity onPress={sos} accessibilityLabel={t("safety.sos")}
        style={{ flex: 1, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: C.orange, borderRadius: 14, paddingVertical: 12 }}>
        <Ionicons name="warning" size={18} color={C.white} />
        <Text style={{ fontWeight: "900", color: C.white }}>{t("safety.sos")}</Text>
      </TouchableOpacity>
    </View>
  );
}
