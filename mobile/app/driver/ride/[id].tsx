import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { formatRwf } from "@/lib/fare";
import { Ride, isActive, openNavigation, callPhone, DRIVER_CANCEL_REASONS, RATING_TAGS_FOR_RIDER } from "@/lib/rides";
import { Stars } from "@/components/rides/Stars";
import { ReasonSheet } from "@/components/rides/ReasonSheet";

/** Driver's trip screen: go to pickup → arrived → PIN start → drive → complete & rate rider (S5.3–S5.6) */
export default function DriverTripScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const rideId = Number(id);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<string[]>([]);

  const { data: ride, isLoading } = useQuery({
    queryKey: queryKeys.rides.detail(rideId),
    queryFn: () => api.get<Ride>(`/rides/${rideId}`).then(r => r.data),
    // Polling catches a rider cancellation; transitions we make ourselves update the cache directly
    refetchInterval: q => (isActive(q.state.data as Ride | undefined) ? 5_000 : false),
  });

  async function act(path: string, body?: object, onError?: (err: any) => boolean) {
    setBusy(true);
    try {
      const res = await api.post<Ride>(`/rides/${rideId}/${path}`, body);
      queryClient.setQueryData(queryKeys.rides.detail(rideId), res.data);
      if (!isActive(res.data)) queryClient.invalidateQueries({ queryKey: queryKeys.rides.active() });
      return true;
    } catch (err: any) {
      if (!onError?.(err)) Alert.alert(err?.response?.data?.message ?? "Error");
      queryClient.invalidateQueries({ queryKey: queryKeys.rides.detail(rideId) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    setPinError(null);
    await act("start", { pin }, err => {
      const status = err?.response?.status;
      if (status === 422 || status === 423) {
        setPinError(err?.response?.data?.message ?? t("ride.driverTrip.enterPin"));
        return true;
      }
      return false;
    });
  }

  async function complete(method: "cash" | "momo") {
    setPayOpen(false);
    await act("complete", { payment_method: method });
  }

  async function cancel(reason: string) {
    if (await act("cancel", { reason })) setCancelOpen(false);
  }

  async function rate() {
    if (!stars) return;
    setBusy(true);
    try {
      await api.post(`/rides/${rideId}/rate`, { stars, tags });
      queryClient.setQueryData(queryKeys.rides.detail(rideId), (old: Ride | undefined) => old && { ...old, my_rating: stars });
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

  const riderName = ride.rider?.name ?? t("ride.driverTrip.rider");
  const toPickup = ride.status === "accepted" || ride.status === "arrived";
  const target = toPickup ? ride.pickup : ride.dropoff;
  const headline = {
    requested: t("ride.driverTrip.newRequest"),
    accepted: t("ride.driverTrip.goToPickup"),
    arrived: t("ride.driverTrip.enterPin"),
    in_progress: t("ride.driverTrip.goToDestination"),
    completed: t("ride.driverTrip.completed"),
    declined: t("ride.trip.cancelledByDriver"),
    expired: t("ride.driverTrip.taken"),
    cancelled_by_rider: t("ride.trip.cancelledByRider"),
    cancelled_by_driver: t("ride.trip.cancelledByDriver"),
  }[ride.status];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />
      <View style={{ backgroundColor: C.white, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <TouchableOpacity onPress={() => router.replace("/(tabs)/drive")} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={C.dark} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontWeight: "900", fontSize: 18, color: C.dark }}>{headline}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ backgroundColor: C.white, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="person" size={24} color={C.mid} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "900", fontSize: 17, color: C.dark }}>{riderName}</Text>
              {ride.rider?.rating ? <Text style={{ color: C.mid }}>★ {ride.rider.rating.toFixed(1)}</Text> : null}
            </View>
            {isActive(ride) && ride.rider?.phone ? (
              <TouchableOpacity onPress={() => callPhone(ride.rider?.phone)} accessibilityLabel={t("ride.driverTrip.callRider")}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="call-outline" size={20} color={C.dark} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={{ backgroundColor: C.white, borderRadius: 18, padding: 16, marginTop: 12, borderWidth: 1, borderColor: C.border, gap: 10 }}>
          <Stop color={C.green} text={ride.pickup.address ?? "—"} active={toPickup} />
          <Stop color={C.dark} text={ride.dropoff.address ?? "—"} square active={ride.status === "in_progress"} />
          {isActive(ride) ? (
            <TouchableOpacity onPress={() => openNavigation(target.lat, target.lng)} accessibilityLabel={t("ride.driverTrip.navigate")}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.teal, borderRadius: 12, paddingVertical: 12, marginTop: 4 }}>
              <Ionicons name="navigate" size={18} color={C.white} />
              <Text style={{ color: C.white, fontWeight: "800" }}>{t("ride.driverTrip.navigate")}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={{ backgroundColor: C.white, borderRadius: 18, padding: 16, marginTop: 12, borderWidth: 1, borderColor: C.border }}>
          <Line label={t("ride.trip.total")} value={formatRwf(ride.final_fare ?? ride.quoted_fare)} bold />
          {ride.driver_earnings != null ? (
            <Text style={{ color: C.green, fontWeight: "800", marginTop: 4 }}>{t("ride.driverTrip.youEarn", { amount: formatRwf(ride.driver_earnings) })}</Text>
          ) : null}
          {ride.cancel_fee ? <Line label={t("ride.trip.cancel")} value={formatRwf(ride.cancel_fee)} /> : null}
          <Text style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{t("ride.driverTrip.tripKm", { km: ride.est_distance_km.toFixed(1) })}</Text>
        </View>

        {ride.status === "accepted" ? (
          <PrimaryButton label={t("ride.driverTrip.arrivedBtn")} onPress={() => act("arrive")} loading={busy} />
        ) : null}

        {ride.status === "arrived" ? (
          <View style={{ backgroundColor: C.white, borderRadius: 18, padding: 16, marginTop: 12, borderWidth: 1, borderColor: C.border }}>
            <Text style={{ fontWeight: "800", color: C.dark, marginBottom: 8 }}>{t("ride.driverTrip.enterPin")}</Text>
            <TextInput
              value={pin} onChangeText={v => setPin(v.replace(/\D/g, "").slice(0, 4))}
              keyboardType="number-pad" maxLength={4} placeholder="••••" placeholderTextColor={C.muted}
              accessibilityLabel={t("ride.driverTrip.enterPin")}
              style={{ borderWidth: 1, borderColor: pinError ? C.orange : C.border, borderRadius: 12, padding: 14, fontSize: 28, fontWeight: "900", letterSpacing: 12, textAlign: "center", color: C.dark }}
            />
            {pinError ? <Text style={{ color: C.orange, marginTop: 6 }}>{pinError}</Text> : null}
            <PrimaryButton label={t("ride.driverTrip.startTrip")} onPress={start} loading={busy} disabled={pin.length !== 4} />
          </View>
        ) : null}

        {ride.status === "in_progress" ? (
          payOpen ? (
            <View style={{ backgroundColor: C.white, borderRadius: 18, padding: 16, marginTop: 12, borderWidth: 1, borderColor: C.border, gap: 10 }}>
              <Text style={{ fontWeight: "800", color: C.dark }}>{t("ride.driverTrip.howPaid")}</Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {(["cash", "momo"] as const).map(m => (
                  <TouchableOpacity key={m} onPress={() => complete(m)} disabled={busy} accessibilityLabel={t(`ride.driverTrip.${m}`)}
                    style={{ flex: 1, backgroundColor: C.dark, borderRadius: 14, paddingVertical: 14, alignItems: "center" }}>
                    <Text style={{ color: C.white, fontWeight: "900" }}>{t(`ride.driverTrip.${m}`)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <PrimaryButton label={t("ride.driverTrip.complete")} onPress={() => setPayOpen(true)} loading={busy} />
          )
        ) : null}

        {ride.status === "completed" && !ride.my_rating ? (
          <View style={{ backgroundColor: C.white, borderRadius: 18, padding: 16, marginTop: 12, borderWidth: 1, borderColor: C.border, gap: 12 }}>
            <Text style={{ fontWeight: "900", fontSize: 16, color: C.dark, textAlign: "center" }}>{t("ride.driverTrip.rateRider", { name: riderName })}</Text>
            <Stars value={stars} onChange={setStars} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {RATING_TAGS_FOR_RIDER.map(tag => {
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

        {!isActive(ride) && (ride.status !== "completed" || ride.my_rating) ? (
          <PrimaryButton label={t("ride.trip.done")} onPress={() => router.replace("/(tabs)/drive")} />
        ) : null}

        {ride.status === "accepted" || ride.status === "arrived" ? (
          <TouchableOpacity onPress={() => setCancelOpen(true)} accessibilityLabel={t("ride.driverTrip.cancel")} style={{ marginTop: 18, alignItems: "center" }}>
            <Text style={{ color: C.orange, fontWeight: "800" }}>{t("ride.driverTrip.cancel")}</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <ReasonSheet
        visible={cancelOpen} busy={busy}
        title={t("ride.driverTrip.cancelTitle")}
        reasons={DRIVER_CANCEL_REASONS}
        labelFor={r => t(`ride.driverTrip.reason_${r}`)}
        onPick={cancel}
        onClose={() => setCancelOpen(false)}
        keepLabel={t("ride.trip.keep")}
      />
    </SafeAreaView>
  );
}

function Stop({ color, text, square, active }: { color: string; text: string; square?: boolean; active?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ width: 10, height: 10, borderRadius: square ? 0 : 5, backgroundColor: color }} />
      <Text numberOfLines={2} style={{ flex: 1, color: C.dark, fontWeight: active ? "800" : "400" }}>{text}</Text>
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
