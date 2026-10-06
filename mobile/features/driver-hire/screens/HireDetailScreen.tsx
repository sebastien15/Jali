import { useState } from "react";
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
import { callPhone } from "@/lib/platformActions";
import { DriverHire, isActiveHire, formatWhen, CUSTOMER_CANCEL_REASONS, RATING_TAGS_FOR_HIRE_DRIVER } from "../hire";
import { Stars } from "@/components/shared/Stars";
import { ReasonSheet } from "@/components/shared/ReasonSheet";
import { useFormatPrice } from "@/lib/fx";
import { Linking } from "react-native";
import { HelpTopicsCard } from "@/features/support";

/** Customer's hire screen: waiting → confirmed (driver + phone) → in progress → summary & rating (S6.3, S6.4) */
export default function HireDetailScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const hireId = Number(id);
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const fmt = useFormatPrice();

  const { data: hire, isLoading } = useQuery({
    queryKey: queryKeys.hire.detail(hireId),
    queryFn: () => api.get<DriverHire>(`/driver-hire/${hireId}`).then(r => r.data),
    refetchInterval: q => (isActiveHire(q.state.data as DriverHire | undefined) ? 15_000 : false),
  });

  async function cancel(reason: string) {
    setBusy(true);
    try {
      const res = await api.post<DriverHire>(`/driver-hire/${hireId}/cancel`, { reason });
      queryClient.setQueryData(queryKeys.hire.detail(hireId), res.data);
      queryClient.invalidateQueries({ queryKey: queryKeys.hire.mine() });
      setCancelOpen(false);
    } catch (err: any) {
      Alert.alert(err?.response?.data?.message ?? "Error");
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

  const name = hire.driver.name;
  const headline = t(`hire.status.${hire.status}`, { name });
  const canCancel = hire.status === "requested" || hire.status === "accepted";
  const lost = ["declined", "expired", "cancelled_by_driver"].includes(hire.status);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />
      <View style={{ backgroundColor: C.white, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} accessibilityLabel={t("common.back", "Back")}>
          <Ionicons name="arrow-back" size={24} color={C.dark} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "900", fontSize: 18, color: C.dark }}>{headline}</Text>
          <Text style={{ color: C.teal, fontWeight: "700", marginTop: 2 }}>{formatWhen(hire.start_at, i18n.language)}</Text>
        </View>
        {hire.status === "requested" ? <ActivityIndicator color={C.teal} /> : null}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}>
        {hire.status === "requested" ? (
          <Text style={{ color: C.mid, textAlign: "center" }}>{t("hire.detail.waitingSub", { name })}</Text>
        ) : null}

        <Card>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            {hire.driver.photo ? (
              <Image source={{ uri: hire.driver.photo }} style={{ width: 56, height: 56, borderRadius: 28 }} />
            ) : (
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="person" size={26} color={C.mid} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "900", fontSize: 17, color: C.dark }}>{name}</Text>
              <Text style={{ color: C.mid }}>
                {hire.driver.rating ? `★ ${hire.driver.rating.toFixed(1)}` : t("hire.newDriver")}
                {hire.driver.years_experience != null ? ` · ${t("hire.yearsExp", { count: hire.driver.years_experience })}` : ""}
              </Text>
              {hire.driver.languages.length ? <Text style={{ color: C.mid, fontSize: 12 }}>{hire.driver.languages.map(l => t(`hire.lang_${l}`)).join(", ")}</Text> : null}
            </View>
          </View>
          {hire.driver.phone ? (
            <TouchableOpacity onPress={() => callPhone(hire.driver.phone)} accessibilityLabel={t("ride.trip.call")}
              style={{ marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.bg, borderRadius: 12, paddingVertical: 12 }}>
              <Ionicons name="call-outline" size={18} color={C.dark} />
              <Text style={{ fontWeight: "800", color: C.dark }}>{t("ride.trip.call")}</Text>
            </TouchableOpacity>
          ) : null}
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
          {hire.car_description ? <Text style={{ color: C.mid, marginTop: 6 }}>{hire.car_description}</Text> : null}
        </Card>

        <Card>
          <Line label={t("hire.confirm.driverPrice")} value={formatRwf(hire.driver_total)} />
          <Line label={t("ride.trip.jaliFee")} value={formatRwf(hire.service_fee)} />
          {hire.overtime_amount ? <Line label={t("hire.detail.overtime", { min: hire.overtime_minutes })} value={formatRwf(hire.overtime_amount)} /> : null}
          {hire.cancel_fee ? <Line label={t("hire.detail.cancelFee")} value={formatRwf(hire.cancel_fee)} /> : null}
          <View style={{ height: 1, backgroundColor: C.border, marginVertical: 8 }} />
          <Line label={t("ride.trip.total")} value={fmt(hire.final_total ?? hire.quoted_total)} bold />
          {hire.payment_method ? (
            <Text style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{t("ride.trip.paidBy", { method: t(`ride.trip.${hire.payment_method}`) })}</Text>
          ) : null}
        </Card>

        {hire.status === "completed" && !hire.my_rating ? (
          <Card>
            <Text style={{ fontWeight: "900", fontSize: 16, color: C.dark, textAlign: "center", marginBottom: 10 }}>{t("ride.trip.rateTitle", { name })}</Text>
            <Stars value={stars} onChange={setStars} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 10 }}>
              {RATING_TAGS_FOR_HIRE_DRIVER.map(tag => {
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

        {["completed", "cancelled_by_customer", "cancelled_by_driver"].includes(hire.status) ? (
          <TouchableOpacity onPress={() => api.post<{ url: string }>(`/driver-hire/${hire.id}/receipt`).then(r => Linking.openURL(r.data.url)).catch(() => {})}
            accessibilityLabel={t("receipt.open")} style={{ backgroundColor: C.white, borderRadius: 14, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: C.border }}>
            <Text style={{ fontWeight: "800", color: C.dark }}>{t("receipt.open")}</Text>
          </TouchableOpacity>
        ) : null}

        {lost ? <Primary label={t("hire.detail.chooseAnother")} onPress={() => router.replace("/hire")} /> : null}

        {canCancel ? (
          <TouchableOpacity onPress={() => setCancelOpen(true)} accessibilityLabel={t("hire.detail.cancel")} style={{ marginTop: 6, alignItems: "center" }}>
            <Text style={{ color: C.orange, fontWeight: "800" }}>{t("hire.detail.cancel")}</Text>
          </TouchableOpacity>
        ) : null}
        <View style={{ marginTop: 12 }}><HelpTopicsCard service="hire" /></View>
      </ScrollView>

      <ReasonSheet
        visible={cancelOpen} busy={busy}
        title={t("hire.detail.cancelTitle")}
        note={hire.cancel_fee_now ? t("hire.detail.cancelFeeNote", { fee: formatRwf(hire.cancel_fee_now) }) : t("hire.detail.cancelFree")}
        reasons={CUSTOMER_CANCEL_REASONS}
        labelFor={r => t(`hire.reason_${r}`)}
        onPick={cancel}
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

function Primary({ label, onPress, loading, disabled }: { label: string; onPress: () => void; loading?: boolean; disabled?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={loading || disabled} accessibilityLabel={label}
      style={{ backgroundColor: disabled ? C.muted : C.dark, borderRadius: 16, paddingVertical: 15, alignItems: "center", marginTop: 12 }}>
      {loading ? <ActivityIndicator color={C.white} /> : <Text style={{ color: C.white, fontWeight: "900", fontSize: 16 }}>{label}</Text>}
    </TouchableOpacity>
  );
}
