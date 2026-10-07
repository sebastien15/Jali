import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { formatRwf } from "@/lib/fare";
import type { components } from "@/lib/apiSchema";

type Match = components["schemas"]["JourneyMatch"];
type SearchResult = { data: Match[]; nearby_dates: { date: string; journeys: number }[] };

/**
 * Shared journeys passing through my origin before my destination (S25.3).
 * Shows my part of the route, its fare and seats left; tapping opens the journey.
 */
export function JourneyResults({ from, to, date, onPickDate }: { from: string; to: string; date: string; onPickDate?: (ymd: string) => void }) {
  const { t, i18n } = useTranslation();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.journeys.search(from, to, date),
    queryFn: () => api.get<SearchResult>("/journeys/search", { params: { from, to, date } }).then(r => r.data),
    staleTime: 60_000,
  });

  if (isLoading) return <ActivityIndicator color={C.orange} style={{ marginTop: 24 }} />;
  if (isError) {
    return (
      <TouchableOpacity onPress={() => refetch()} accessibilityLabel={t("common.retry", "Retry")} style={{ alignItems: "center", padding: 20 }}>
        <Text style={{ color: C.orange, fontWeight: "700" }}>{t("journeys.error", "Could not load journeys. Tap to retry.")}</Text>
      </TouchableOpacity>
    );
  }
  if (!data?.data.length) {
    return (
      <View style={{ alignItems: "center", padding: 24, gap: 10 }}>
        <Ionicons name="car-outline" size={40} color={C.muted} />
        <Text style={{ color: C.mid, textAlign: "center" }}>{t("journeys.none", "No shared journey for this route that day.")}</Text>
        {(data?.nearby_dates ?? []).map(d => (
          <TouchableOpacity key={d.date} onPress={() => onPickDate?.(d.date)} accessibilityLabel={d.date}
            style={{ backgroundColor: C.orangeLt, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
            <Text style={{ color: C.orange, fontWeight: "800" }}>
              {new Date(`${d.date}T12:00:00`).toLocaleDateString(i18n.language, { weekday: "short", day: "numeric", month: "short" })} · {t("journeys.count", { count: d.journeys, defaultValue: `${d.journeys} journey(s)` })}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      {data.data.map(m => {
        const partial = m.route[0] !== m.from.name || m.route[m.route.length - 1] !== m.to.name;
        return (
          <TouchableOpacity key={`${m.listing_id}-${m.from.seq}-${m.to.seq}`} accessibilityLabel={`${m.driver.name ?? ""} ${m.from.name} ${m.to.name}`}
            onPress={() => router.push({ pathname: "/journey/[id]", params: { id: String(m.listing_id), date: m.date, from: String(m.from.seq), to: String(m.to.seq) } } as any)}
            style={{ backgroundColor: C.white, borderRadius: 16, padding: 14, gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontWeight: "900", fontSize: 18, color: C.dark }}>{m.from.time}</Text>
              <Text style={{ flex: 1, color: C.dark, fontWeight: "700" }} numberOfLines={1}>{m.from.name} → {m.to.name}</Text>
              <Text style={{ fontWeight: "900", color: C.orange }}>{formatRwf(m.fare)}</Text>
            </View>
            <Text style={{ color: C.mid, fontSize: 12 }} numberOfLines={1}>
              {partial ? t("journeys.via", { route: m.route.join(" → "), defaultValue: `Driver's route: ${m.route.join(" → ")}` }) : m.route.join(" → ")}
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Text style={{ color: C.dark, fontSize: 12 }}>👤 {m.driver.name}{m.driver.rating ? ` ★ ${m.driver.rating.toFixed(1)}` : ""}</Text>
              <Text style={{ color: C.green, fontSize: 12, fontWeight: "700" }}>{t("journeys.seatsLeft", { count: m.seats_left, defaultValue: `${m.seats_left} seat(s) left` })}</Text>
            </View>
            <Text style={{ color: C.muted, fontSize: 12 }}>{t("journeys.pickup", { place: m.pickup_point, defaultValue: `Pickup: ${m.pickup_point}` })}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
