import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Vibration } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { formatRwf } from "@/lib/fare";
import { secondsLeft } from "../rides";
import type { components } from "@/lib/apiSchema";

type Card = components["schemas"]["RideRequestCard"];

/** Ride requests for an online driver, with countdown and Accept/Decline (story S5.2). */
export function IncomingRequests() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<number | null>(null);
  const [, tick] = useState(0);

  const { data: cards = [] } = useQuery({
    queryKey: queryKeys.driver.rideRequests(),
    queryFn: () => api.get<Card[]>("/driver/ride-requests").then(r => r.data),
    refetchInterval: 4_000,
  });

  const firstId = cards[0]?.ride_id;
  useEffect(() => { if (firstId) Vibration.vibrate([0, 400, 200, 400]); }, [firstId]);
  useEffect(() => {
    if (!cards.length) return;
    const timer = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(timer);
  }, [cards.length]);

  async function respond(card: Card, action: "accept" | "decline") {
    setBusy(card.ride_id);
    try {
      await api.post(`/rides/${card.ride_id}/${action}`);
      queryClient.invalidateQueries({ queryKey: queryKeys.driver.rideRequests() });
      if (action === "accept") router.push(`/driver/ride/${card.ride_id}` as any);
    } catch (err: any) {
      Alert.alert(err?.response?.status === 409 ? t("ride.driverTrip.taken") : err?.response?.data?.message ?? "Error");
      queryClient.invalidateQueries({ queryKey: queryKeys.driver.rideRequests() });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {cards.filter(c => secondsLeft(c.expires_at) > 0).map(card => (
        <View key={card.ride_id} style={{ backgroundColor: C.dark, borderRadius: 18, padding: 16, marginBottom: 14 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: C.yellow, fontWeight: "900" }}>{t("ride.driverTrip.newRequest")}</Text>
            <Text style={{ color: C.white, fontWeight: "900" }}>{t("ride.driverTrip.expiresIn", { sec: secondsLeft(card.expires_at) })}</Text>
          </View>
          <Text style={{ color: C.white, fontWeight: "900", fontSize: 26, marginTop: 8 }}>
            {t("ride.driverTrip.youEarn", { amount: formatRwf(card.earnings) })}
            {card.broadcast ? `  ·  ${t("ride.broadcast.firstWins")}` : ""}
          </Text>
          <View style={{ marginTop: 10, gap: 6 }}>
            <Row icon="radio-button-on" color={C.green} text={card.pickup_area} />
            <Row icon="square" color={C.white} text={card.dropoff_area} />
          </View>
          <Text style={{ color: C.muted, marginTop: 8, fontSize: 12 }}>
            {t("ride.driverTrip.pickupKm", { km: card.pickup_km })} · {t("ride.driverTrip.tripKm", { km: card.trip_km })}
            {card.rider_rating ? ` · ★ ${card.rider_rating.toFixed(1)}` : ""} · {t(`ride.driverTrip.${card.payment_method}`)}
          </Text>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
            <TouchableOpacity onPress={() => respond(card, "decline")} disabled={busy === card.ride_id} accessibilityLabel={t("ride.driverTrip.decline")}
              style={{ flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: "center", backgroundColor: C.mid }}>
              <Text style={{ color: C.white, fontWeight: "800" }}>{t("ride.driverTrip.decline")}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => respond(card, "accept")} disabled={busy === card.ride_id} accessibilityLabel={t("ride.driverTrip.accept")}
              style={{ flex: 2, borderRadius: 14, paddingVertical: 14, alignItems: "center", backgroundColor: C.green }}>
              {busy === card.ride_id ? <ActivityIndicator color={C.white} /> : <Text style={{ color: C.white, fontWeight: "900", fontSize: 16 }}>{t("ride.driverTrip.accept")}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </>
  );
}

function Row({ icon, color, text }: { icon: React.ComponentProps<typeof Ionicons>["name"]; color: string; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Ionicons name={icon} size={12} color={color} />
      <Text style={{ color: C.white, flex: 1 }} numberOfLines={1}>{text}</Text>
    </View>
  );
}
