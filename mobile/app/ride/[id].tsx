import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { formatRwf } from "@/lib/fare";
import {
  Ride, isActive, pickupEtaMin, secondsLeft, callPhone, RIDER_CANCEL_REASONS, RATING_TAGS_FOR_DRIVER,
} from "@/lib/rides";
import { Stars } from "@/components/rides/Stars";
import { ReasonSheet } from "@/components/rides/ReasonSheet";
import { SafetyBar } from "@/components/rides/SafetyBar";

/** Rider's live trip screen: waiting → driver on the way → arrived (PIN) → in trip → receipt & rating (S4.1–S4.6) */
export default function RiderTripScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const rideId = Number(id);
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [, tick] = useState(0);

  const { data: ride, isLoading } = useQuery({
    queryKey: queryKeys.rides.detail(rideId),
    queryFn: () => api.get<Ride>(`/rides/${rideId}`).then(r => r.data),
    refetchInterval: q => (isActive(q.state.data as Ride | undefined) ? 4_000 : false),
  });

  // Re-render every second for countdowns
  useEffect(() => {
    if (ride?.status !== "requested") return;
    const timer = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(timer);
  }, [ride?.status]);

  useEffect(() => {
    if (ride && !isActive(ride)) queryClient.invalidateQueries({ queryKey: queryKeys.rides.active() });
  }, [ride?.status]);

  async function cancel(reason: string) {
    setBusy(true);
    try {
      const res = await api.post<Ride>(`/rides/${rideId}/cancel`, { reason });
      queryClient.setQueryData(queryKeys.rides.detail(rideId), res.data);
      setCancelOpen(false);
    } catch (err: any) {
      Alert.alert(err?.response?.data?.message ?? "Error");
    } finally {
      setBusy(false);
    }
  }

  async function rate() {
    if (!stars) return;
    setBusy(true);
    try {
      await api.post(`/rides/${rideId}/rate`, { stars, tags });
      queryClient.setQueryData(queryKeys.rides.detail(rideId), (old: Ride | undefined) => old && { ...old, my_rating: stars });
      Alert.alert(t("ride.trip.rated"));
    } catch (err: any) {
      Alert.alert(err?.response?.data?.message ?? "Error");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading || !ride) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.white, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={C.teal} />
      </SafeAreaView>
    );
  }

  const name = ride.driver?.name ?? "";
  const eta = pickupEtaMin(ride);
  const canCancel = ["requested", "accepted", "arrived"].includes(ride.status);
  const headline = {
    requested: ride.mode === "broadcast" && !ride.driver ? t("ride.broadcast.finding") : t("ride.trip.waiting", { name }),
    accepted: t("ride.trip.onTheWay", { name }),
    arrived: t("ride.trip.arrived"),
    in_progress: t("ride.trip.inProgress", { place: ride.dropoff.address?.split(",")[0] ?? "" }),
    completed: t("ride.trip.completed"),
    declined: t("ride.trip.declined", { name }),
    expired: t("ride.trip.expired", { name }),
    cancelled_by_rider: t("ride.trip.cancelledByRider"),
    cancelled_by_driver: t("ride.trip.cancelledByDriver"),
  }[ride.status];
  const sub = ride.status === "requested" ? t("ride.trip.waitingSub", { sec: secondsLeft(ride.expires_at) })
    : ride.status === "accepted" && eta ? t("ride.trip.eta", { min: eta })
    : ride.status === "arrived" ? t("ride.trip.arrivedSub") : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />
      <View style={{ backgroundColor: C.white, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <TouchableOpacity onPress={() => (isActive(ride) ? router.replace("/(tabs)") : router.back())} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={C.dark} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "900", fontSize: 18, color: C.dark }}>{headline}</Text>
          {sub ? <Text style={{ color: C.teal, fontWeight: "700", marginTop: 2 }}>{sub}</Text> : null}
        </View>
        {ride.status === "requested" ? <ActivityIndicator color={C.teal} /> : null}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {ride.driver ? (
          <View style={{ backgroundColor: C.white, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.border }}>
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              {ride.driver.vehicle?.photo ? (
                <Image source={{ uri: ride.driver.vehicle.photo }} style={{ width: 80, height: 60, borderRadius: 10, backgroundColor: C.bg }} />
              ) : (
                <View style={{ width: 80, height: 60, borderRadius: 10, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="car-outline" size={28} color={C.mid} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "900", fontSize: 17, color: C.dark }}>{ride.driver.name}</Text>
                <Text style={{ color: C.mid }}>★ {ride.driver.rating.toFixed(1)}</Text>
                <Text style={{ color: C.mid }}>{[ride.driver.vehicle?.color, ride.driver.vehicle?.model].filter(Boolean).join(" ")}</Text>
              </View>
            </View>
            {ride.driver.vehicle ? (
              <View style={{ marginTop: 12, backgroundColor: C.yellow, borderRadius: 10, paddingVertical: 10, alignItems: "center" }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: C.dark }}>{t("ride.trip.plate")}</Text>
                <Text style={{ fontSize: 28, fontWeight: "900", color: C.dark, letterSpacing: 2 }}>{ride.driver.vehicle.plate}</Text>
              </View>
            ) : null}
            {ride.driver.phone ? (
              <TouchableOpacity onPress={() => callPhone(ride.driver?.phone)} accessibilityLabel={t("ride.trip.call")}
                style={{ marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.bg, borderRadius: 12, paddingVertical: 12 }}>
                <Ionicons name="call-outline" size={18} color={C.dark} />
                <Text style={{ fontWeight: "800", color: C.dark }}>{t("ride.trip.call")}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {isActive(ride) && ride.status !== "requested" ? <SafetyBar rideId={ride.id} canShare /> : null}

        {ride.driver?.momo ? (
          <View style={{ backgroundColor: C.yellow, borderRadius: 18, padding: 16, marginTop: 12 }}>
            <Text style={{ fontWeight: "800", color: C.dark }}>{t("ride.trip.payMomoTo")}</Text>
            <Text style={{ fontWeight: "900", fontSize: 22, color: C.dark, marginTop: 2 }}>{ride.driver.momo.number}</Text>
            {ride.driver.momo.name ? <Text style={{ color: C.dark }}>{ride.driver.momo.name}</Text> : null}
          </View>
        ) : null}

        {ride.start_pin && ["accepted", "arrived"].includes(ride.status) ? (
          <View style={{ backgroundColor: C.dark, borderRadius: 18, padding: 16, marginTop: 12, alignItems: "center" }}>
            <Text style={{ color: C.muted, fontWeight: "700" }}>{t("ride.trip.pin")}</Text>
            <Text style={{ color: C.white, fontSize: 40, fontWeight: "900", letterSpacing: 10 }}>{ride.start_pin}</Text>
            <Text style={{ color: C.muted, fontSize: 12, textAlign: "center" }}>{t("ride.trip.pinHint")}</Text>
          </View>
        ) : null}

        <View style={{ backgroundColor: C.white, borderRadius: 18, padding: 16, marginTop: 12, borderWidth: 1, borderColor: C.border, gap: 10 }}>
          <Stop color={C.green} text={ride.pickup.address ?? "—"} />
          <Stop color={C.dark} text={ride.dropoff.address ?? "—"} square />
        </View>

        <View style={{ backgroundColor: C.white, borderRadius: 18, padding: 16, marginTop: 12, borderWidth: 1, borderColor: C.border }}>
          <Line label={t("ride.trip.driverFare")} value={formatRwf(ride.driver_fare)} />
          <Line label={t("ride.trip.jaliFee")} value={formatRwf(ride.service_fee)} />
          {ride.cancel_fee ? <Line label={t("ride.trip.cancel")} value={formatRwf(ride.cancel_fee)} /> : null}
          <View style={{ height: 1, backgroundColor: C.border, marginVertical: 8 }} />
          <Line label={t("ride.trip.total")} value={formatRwf(ride.final_fare ?? ride.quoted_fare)} bold />
          {ride.payment_method ? (
            <Text style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>
              {t("ride.trip.paidBy", { method: t(`ride.trip.${ride.payment_method}`) })}
            </Text>
          ) : null}
        </View>

        {ride.status === "completed" && !ride.my_rating ? (
          <View style={{ backgroundColor: C.white, borderRadius: 18, padding: 16, marginTop: 12, borderWidth: 1, borderColor: C.border, gap: 12 }}>
            <Text style={{ fontWeight: "900", fontSize: 16, color: C.dark, textAlign: "center" }}>{t("ride.trip.rateTitle", { name })}</Text>
            <Stars value={stars} onChange={setStars} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {RATING_TAGS_FOR_DRIVER.map(tag => {
                const on = tags.includes(tag);
                return (
                  <TouchableOpacity key={tag} onPress={() => setTags(on ? tags.filter(x => x !== tag) : [...tags, tag])} accessibilityLabel={t(`ride.trip.tag_${tag}`)}
                    style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: on ? C.teal : C.bg }}>
                    <Text style={{ color: on ? C.white : C.mid, fontWeight: "700", fontSize: 12 }}>{t(`ride.trip.tag_${tag}`)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <PrimaryButton label={t("ride.trip.rateSend")} onPress={rate} loading={busy} disabled={!stars} />
          </View>
        ) : null}

        {["declined", "expired", "cancelled_by_driver"].includes(ride.status) ? (
          <PrimaryButton label={t("ride.trip.chooseAnother")} onPress={() => router.back()} />
        ) : null}
        {ride.status === "completed" && ride.my_rating ? (
          <PrimaryButton label={t("ride.trip.done")} onPress={() => router.replace("/(tabs)")} />
        ) : null}
        {canCancel ? (
          <TouchableOpacity onPress={() => setCancelOpen(true)} accessibilityLabel={t("ride.trip.cancel")} style={{ marginTop: 18, alignItems: "center" }}>
            <Text style={{ color: C.orange, fontWeight: "800" }}>{t("ride.trip.cancel")}</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <ReasonSheet
        visible={cancelOpen} busy={busy}
        title={t("ride.trip.cancelTitle")}
        note={ride.status === "arrived" ? t("ride.trip.cancelFeeNote", { min: 5 }) : undefined}
        reasons={RIDER_CANCEL_REASONS}
        labelFor={r => t(`ride.trip.reason_${r}`)}
        onPick={cancel}
        onClose={() => setCancelOpen(false)}
        keepLabel={t("ride.trip.keep")}
      />
    </SafeAreaView>
  );
}

function Stop({ color, text, square }: { color: string; text: string; square?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ width: 10, height: 10, borderRadius: square ? 0 : 5, backgroundColor: color }} />
      <Text numberOfLines={2} style={{ flex: 1, color: C.dark }}>{text}</Text>
    </View>
  );
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
      <Text style={{ color: bold ? C.dark : C.mid, fontWeight: bold ? "900" : "400", fontSize: bold ? 16 : 14 }}>{label}</Text>
      <Text style={{ color: C.dark, fontWeight: bold ? "900" : "600", fontSize: bold ? 16 : 14 }}>{value}</Text>
    </View>
  );
}

function PrimaryButton({ label, onPress, loading, disabled }: { label: string; onPress: () => void; loading?: boolean; disabled?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={loading || disabled} accessibilityLabel={label}
      style={{ backgroundColor: disabled ? C.muted : C.dark, borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 14 }}>
      {loading ? <ActivityIndicator color={C.white} /> : <Text style={{ color: C.white, fontWeight: "900", fontSize: 16 }}>{label}</Text>}
    </TouchableOpacity>
  );
}
