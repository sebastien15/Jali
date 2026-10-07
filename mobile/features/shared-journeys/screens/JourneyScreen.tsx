import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { formatRwf } from "@/lib/fare";
import type { components } from "@/lib/apiSchema";

type Journey = components["schemas"]["JourneyDetail"];

/** One shared journey: the driver's stops and my part of the route (S25.3) */
export default function JourneyScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string; date: string; from?: string; to?: string }>();
  const id = Number(params.id);
  const fromSeq = Number(params.from ?? 0);
  const { data: j, isLoading, isError } = useQuery({
    queryKey: queryKeys.journeys.detail(id, String(params.date)),
    queryFn: () => api.get<Journey>(`/journeys/${id}`, { params: { date: params.date } }).then(r => r.data),
  });
  const toSeq = params.to != null ? Number(params.to) : (j ? j.stops.length - 1 : 1);
  const fare = j ? j.stops.filter(s => s.seq >= fromSeq && s.seq < toSeq).reduce((a, s) => a + (s.fare_to_next ?? 0), 0) : 0;
  const left = j ? Math.min(...j.seats_left_per_segment.slice(fromSeq, toSeq)) : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />
      <View style={{ backgroundColor: C.white, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)" as any))} accessibilityLabel={t("common.back", "Back")}>
          <Ionicons name="arrow-back" size={24} color={C.dark} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontWeight: "900", fontSize: 18, color: C.dark }}>{t("journeys.title", "Shared journey")}</Text>
      </View>
      {isLoading ? <ActivityIndicator color={C.orange} style={{ marginTop: 32 }} /> : isError || !j ? (
        <Text style={{ color: C.mid, padding: 24, textAlign: "center" }}>{t("journeys.missing", "This journey is not available on that date.")}</Text>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
          <View style={{ backgroundColor: C.white, borderRadius: 16, padding: 14 }}>
            {j.stops.map((s, i) => {
              const mine = s.seq >= fromSeq && s.seq <= toSeq;
              return (
                <View key={s.seq} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                  <View style={{ alignItems: "center", width: 16 }}>
                    <View style={{ width: 12, height: 12, borderRadius: 6, marginTop: 4, backgroundColor: mine ? C.orange : C.border }} />
                    {i < j.stops.length - 1 && <View style={{ width: 2, height: 30, backgroundColor: s.seq >= fromSeq && s.seq < toSeq ? C.orange : C.border }} />}
                  </View>
                  <Text style={{ width: 50, fontWeight: "800", color: mine ? C.dark : C.muted }}>{s.time ?? ""}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: mine ? "800" : "600", color: mine ? C.dark : C.muted }}>{s.name}</Text>
                    {s.fare_to_next != null && i < j.stops.length - 1 && (
                      <Text style={{ color: C.muted, fontSize: 11 }}>
                        {formatRwf(s.fare_to_next)} · {t("journeys.seatsLeft", { count: j.seats_left_per_segment[s.seq] ?? 0, defaultValue: `${j.seats_left_per_segment[s.seq] ?? 0} seat(s) left` })}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
          <View style={{ backgroundColor: C.white, borderRadius: 16, padding: 14, gap: 6 }}>
            <Text style={{ fontWeight: "800", color: C.dark }}>{j.stops[fromSeq]?.name} → {j.stops[toSeq]?.name}</Text>
            <Text style={{ color: C.dark }}>{t("journeys.fareSeat", { fare: formatRwf(fare), defaultValue: `${formatRwf(fare)} per seat` })}</Text>
            <Text style={{ color: C.green, fontWeight: "700" }}>{t("journeys.seatsLeft", { count: left, defaultValue: `${left} seat(s) left` })}</Text>
            <Text style={{ color: C.mid }}>👤 {j.driver.name}{j.driver.rating ? ` ★ ${j.driver.rating.toFixed(1)}` : ""}</Text>
            {fromSeq === 0 && !!j.pickup_station && <Text style={{ color: C.mid }}>{t("journeys.pickup", { place: j.pickup_station, defaultValue: `Pickup: ${j.pickup_station}` })}</Text>}
            {j.allow_custom_pickup && <Text style={{ color: C.mid, fontSize: 12 }}>{t("journeys.doorPickup", { fee: formatRwf(j.custom_pickup_fee ?? 0), defaultValue: `Door pickup possible (+${formatRwf(j.custom_pickup_fee ?? 0)})` })}</Text>}
            {!!j.notes && <Text style={{ color: C.mid, fontSize: 12 }}>{j.notes}</Text>}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
