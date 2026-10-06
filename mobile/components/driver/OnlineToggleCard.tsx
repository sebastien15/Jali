import { View, Text, TouchableOpacity, ActivityIndicator, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import { useDriverPresence } from "@/lib/useDriverPresence";
import { IncomingRequests } from "@/components/driver/IncomingRequests";

/** Where each blocker can be fixed */
const FIX_ROUTE: Record<string, string> = {
  not_verified: "/driver/onboarding",
  suspended: "/driver/onboarding",
  no_active_vehicle: "/driver/vehicles",
  insurance_expired: "/driver/vehicles",
  no_vehicle_photo: "/driver/vehicles",
  no_rates: "/driver/rates",
  rates_outside_limits: "/driver/rates",
};

/** Big Online/Offline switch for on-demand rides (story S5.1). */
export function OnlineToggleCard({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation();
  const { online, blockedReasons, loaded, switching, locationDenied, goOnline, goOffline } = useDriverPresence(enabled);

  if (!enabled) return null;

  return (
    <>
    {online ? <IncomingRequests /> : null}
    <View style={{
      backgroundColor: online ? C.green : C.white, borderRadius: 18, padding: 16, marginBottom: 20,
      borderWidth: online ? 0 : 1, borderColor: C.border,
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: online ? C.white : C.muted }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "900", fontSize: 18, color: online ? C.white : C.dark }}>
            {online ? t("ride.presence.online") : t("ride.presence.offline")}
          </Text>
          {online ? (
            <Text style={{ color: C.greenLt, fontSize: 12, marginTop: 2 }}>{t("ride.presence.keepOpen")}</Text>
          ) : null}
        </View>
        {switching || !loaded ? (
          <ActivityIndicator color={online ? C.white : C.teal} />
        ) : (
          <Switch
            value={online}
            onValueChange={v => (v ? goOnline() : goOffline())}
            disabled={!online && blockedReasons.length > 0}
            trackColor={{ false: C.border, true: C.greenLt }}
            thumbColor={online ? C.white : C.muted}
            accessibilityLabel={online ? t("ride.presence.goOffline") : t("ride.presence.goOnline")}
          />
        )}
      </View>

      {locationDenied ? (
        <Text style={{ color: C.orange, marginTop: 10, fontWeight: "600" }}>{t("ride.presence.locationDenied")}</Text>
      ) : null}

      {!online && blockedReasons.length > 0 ? (
        <View style={{ marginTop: 12, gap: 6 }}>
          <Text style={{ color: C.mid, fontWeight: "700", fontSize: 12 }}>{t("ride.presence.missing")}</Text>
          {blockedReasons.map(reason => (
            <TouchableOpacity key={reason} onPress={() => router.push(FIX_ROUTE[reason] as any)} accessibilityLabel={t(`ride.presence.${reason}`)}
              style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.orangeLt, borderRadius: 10, padding: 10 }}>
              <Ionicons name="alert-circle-outline" size={16} color={C.orange} />
              <Text style={{ flex: 1, color: C.dark, fontSize: 13 }}>{t(`ride.presence.${reason}`)}</Text>
              <Text style={{ color: C.orange, fontWeight: "800", fontSize: 12 }}>{t("ride.presence.fix")}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
    </>
  );
}
