import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { formatRwf } from "@/lib/fare";
import { callPhone, openNavigation } from "@/lib/platformActions";
import { DriverHire, isActiveHire, formatWhen, DRIVER_CANCEL_REASONS, RATING_TAGS_FOR_HIRE_CUSTOMER } from "../hire";
import { Stars } from "@/components/rides/Stars";
import { ReasonSheet } from "@/components/rides/ReasonSheet";

/** Driver's hire screen: accept → navigate → check in → check out (cash/MoMo, overtime) → rate (S6.4) */
export default function DriverHireScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const hireId = Number(id);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<string[]>([]);

  const { data: hire, isLoading } = useQuery({
    queryKey: queryKeys.hire.detail(hireId),
    queryFn: () => api.get<DriverHire>(`/driver-hire/${hireId}`).then(r => r.data),
    refetchInterval: q => (isActiveHire(q.state.data as DriverHire | undefined) ? 20_000 : false),
  });

  async function act(path: string, body?: object) {
    setBusy(true);
    try {
      const res = await api.post<DriverHire>(`/driver-hire/${hireId}/${path}`, body);
      queryClient.setQueryData(queryKeys.hire.detail(hireId), res.data);
      queryClient.invalidateQueries({ queryKey: ["driver", "hires"] });
      return true;
    } catch (err: any) {
      Alert.alert(err?.response?.data?.message ?? "Error");
      queryClient.invalidateQueries({ queryKey: queryKeys.hire.detail(hireId) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function rate() {
    setBusy(true);
    try {
      await api.post(`/driver-hire/${hireId}/rate`, { stars, tags });
      queryClient.setQueryData(queryKeys.hire.detail(hireId), (old: DriverHire | undefined) => old && { ...old, my_rating: stars });
    } catch (err: any) {
      Alert.alert(err?.response?.data?.message ?? "Error");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading || !hire) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.white, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={C.teal} />
      </SafeAreaView>
    );
  }

  const customer = hire.customer?.name ?? t("hire.driver.customer");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />
      <View style={{ backgroundColor: C.white, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <TouchableOpacity onPress={() => router.replace("/(tabs)/drive")} accessibilityLabel={t("common.back", "Back")}>
          <Ionicons name="arrow-back" size={24} color={C.dark} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "900", fontSize: 18, color: C.dark }}>{t(`hire.driverStatus.${hire.status}`)}</Text>
          <Text style={{ color: C.teal, fontWeight: "700", marginTop: 2 }}>{formatWhen(hire.start_at, i18n.language)}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}>
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="person" size={24} color={C.mid} />
            </View>
            <Text style={{ flex: 1, fontWeight: "900", fontSize: 17, color: C.dark }}>{customer}</Text>
            {hire.customer?.phone ? (
              <TouchableOpacity onPress={() => callPhone(hire.customer?.phone)} accessibilityLabel={t("hire.driver.callCustomer")}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="call-outline" size={20} color={C.dark} />
              </TouchableOpacity>
            ) : null}
          </View>
          {hire.car_description ? <Text style={{ color: C.dark, marginTop: 10 }}>🚗 {hire.car_description}</Text> : null}
          {hire.notes ? <Text style={{ color: C.mid, marginTop: 4 }}>“{hire.notes}”</Text> : null}
        </Card>

        <Card>
          <Line label={t("hire.detail.duration")} value={hire.duration_type === "days" ? t("hire.days", { count: hire.duration_value }) : t("hire.hours", { count: hire.duration_value })} />
          <Line label={t("hire.detail.until")} value={formatWhen(hire.end_at, i18n.language)} />
          <Line label={t("hire.search.tripType")} value={t(`hire.trip_${hire.trip_type}`)} />
          <Line label={t("hire.search.transmission")} value={t(`hire.tr_${hire.transmission}`)} />
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center", marginTop: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.green }} />
            <Text style={{ flex: 1, color: C.dark }}>{hire.pickup.address ?? "—"}</Text>
          </View>
          {hire.status === "accepted" ? (
            <TouchableOpacity onPress={() => openNavigation(hire.pickup.lat, hire.pickup.lng)} accessibilityLabel={t("ride.driverTrip.navigate")}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.teal, borderRadius: 12, paddingVertical: 12, marginTop: 10 }}>
              <Ionicons name="navigate" size={18} color={C.white} />
              <Text style={{ color: C.white, fontWeight: "800" }}>{t("ride.driverTrip.navigate")}</Text>
            </TouchableOpacity>
          ) : null}
        </Card>

        <Card>
          <Line label={t("hire.confirm.driverPrice")} value={formatRwf(hire.driver_total)} />
          {hire.overtime_amount ? <Line label={t("hire.detail.overtime", { min: hire.overtime_minutes })} value={formatRwf(hire.overtime_amount)} /> : null}
          <Line label={t("hire.driver.customerPays")} value={formatRwf(hire.final_total ?? hire.quoted_total)} bold />
          {hire.driver_earnings != null ? (
            <Text style={{ color: C.green, fontWeight: "800", marginTop: 4 }}>{t("ride.driverTrip.youEarn", { amount: formatRwf(hire.driver_earnings) })}</Text>
          ) : null}
        </Card>

        {hire.status === "requested" ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Secondary label={t("ride.driverTrip.decline")} onPress={() => act("decline")} />
            <Primary label={t("ride.driverTrip.accept")} onPress={() => act("accept")} loading={busy} flex />
          </View>
        ) : null}
        {hire.status === "accepted" ? <Primary label={t("hire.driver.checkIn")} onPress={() => act("check-in")} loading={busy} /> : null}
        {hire.status === "started" ? (
          payOpen ? (
            <Card>
              <Text style={{ fontWeight: "800", color: C.dark, marginBottom: 8 }}>{t("ride.driverTrip.howPaid")}</Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {(["cash", "momo"] as const).map(m => (
                  <TouchableOpacity key={m} onPress={() => { setPayOpen(false); act("check-out", { payment_method: m }); }} disabled={busy}
                    accessibilityLabel={t(`ride.driverTrip.${m}`)}
                    style={{ flex: 1, backgroundColor: C.dark, borderRadius: 14, paddingVertical: 14, alignItems: "center" }}>
                    <Text style={{ color: C.white, fontWeight: "900" }}>{t(`ride.driverTrip.${m}`)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Card>
          ) : <Primary label={t("hire.driver.checkOut")} onPress={() => setPayOpen(true)} loading={busy} />
        ) : null}

        {hire.status === "completed" && !hire.my_rating ? (
          <Card>
            <Text style={{ fontWeight: "900", fontSize: 16, color: C.dark, textAlign: "center", marginBottom: 10 }}>{t("ride.driverTrip.rateRider", { name: customer })}</Text>
            <Stars value={stars} onChange={setStars} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 10 }}>
              {RATING_TAGS_FOR_HIRE_CUSTOMER.map(tag => {
                const on = tags.includes(tag);
                return (
                  <TouchableOpacity key={tag} onPress={() => setTags(on ? tags.filter(x => x !== tag) : [...tags, tag])} accessibilityLabel={t(`hire.tag_${tag}`)}
                    style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: on ? C.teal : C.bg }}>
                    <Text style={{ color: on ? C.white : C.mid, fontWeight: "700", fontSize: 12 }}>{t(`hire.tag_${tag}`)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Primary label={t("ride.trip.rateSend")} onPress={rate} loading={busy} disabled={!stars} />
          </Card>
        ) : null}

        {hire.status === "accepted" ? (
          <TouchableOpacity onPress={() => setCancelOpen(true)} accessibilityLabel={t("hire.detail.cancel")} style={{ marginTop: 6, alignItems: "center" }}>
            <Text style={{ color: C.orange, fontWeight: "800" }}>{t("hire.detail.cancel")}</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <ReasonSheet
        visible={cancelOpen} busy={busy}
        title={t("hire.detail.cancelTitle")}
        reasons={DRIVER_CANCEL_REASONS}
        labelFor={r => t(`hire.reason_${r}`)}
        onPick={async r => { if (await act("cancel", { reason: r })) setCancelOpen(false); }}
        onClose={() => setCancelOpen(false)}
        keepLabel={t("ride.trip.keep")}
      />
    </SafeAreaView>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={{ backgroundColor: C.white, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.border }}>{children}</View>;
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, gap: 8 }}>
      <Text style={{ color: bold ? C.dark : C.mid, fontWeight: bold ? "900" : "400", fontSize: bold ? 16 : 14 }}>{label}</Text>
      <Text style={{ color: C.dark, fontWeight: bold ? "900" : "600", fontSize: bold ? 16 : 14, flexShrink: 1, textAlign: "right" }}>{value}</Text>
    </View>
  );
}

function Primary({ label, onPress, loading, disabled, flex }: { label: string; onPress: () => void; loading?: boolean; disabled?: boolean; flex?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={loading || disabled} accessibilityLabel={label}
      style={{ flex: flex ? 2 : undefined, backgroundColor: disabled ? C.muted : C.dark, borderRadius: 16, paddingVertical: 15, alignItems: "center", marginTop: flex ? 0 : 4 }}>
      {loading ? <ActivityIndicator color={C.white} /> : <Text style={{ color: C.white, fontWeight: "900", fontSize: 16 }}>{label}</Text>}
    </TouchableOpacity>
  );
}

function Secondary({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} accessibilityLabel={label}
      style={{ flex: 1, backgroundColor: C.white, borderRadius: 16, paddingVertical: 15, alignItems: "center", borderWidth: 1, borderColor: C.border }}>
      <Text style={{ color: C.dark, fontWeight: "800", fontSize: 16 }}>{label}</Text>
    </TouchableOpacity>
  );
}
