import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { formatRwf } from "@/lib/fare";
import { OWNER_STATUS_LABEL, OwnerRentalSummary, RentalBooking, STATUS_META, formatWhen } from "../rentals";
import { Badge, Chip, Empty, Header } from "../components/ui";

type Tab = "requested" | "upcoming" | "active" | "past";
const TABS: { id: Tab; label: string }[] = [
  { id: "requested", label: "Requests" }, { id: "upcoming", label: "Upcoming" }, { id: "active", label: "On the road" }, { id: "past", label: "Past" },
];

/** Owner dashboard: requests, upcoming handovers, active rentals, income (S24.7) */
export default function OwnerRentalsScreen() {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<Tab>("requested");
  const summary = useQuery({
    queryKey: queryKeys.driver.rentalSummary(),
    queryFn: () => api.get<OwnerRentalSummary>("/driver/rentals/summary").then(r => r.data),
  });
  const list = useQuery({
    queryKey: queryKeys.driver.rentals(tab),
    queryFn: () => api.get<{ data: RentalBooking[] }>("/driver/rentals", { params: { status: tab } }).then(r => r.data.data),
    refetchInterval: tab === "requested" ? 30_000 : false,
  });
  const s = summary.data;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title={t("rental.owner.title", "Rentals of my cars")} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => { list.refetch(); summary.refetch(); }} />}>
        {s && (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Stat label={t("rental.owner.thisMonth", "This month")} value={formatRwf(s.income_this_month)} color={C.green} />
            <Stat label={t("rental.owner.completed", "Completed")} value={String(s.completed_rentals)} color={C.blue} />
            <Stat label={t("rental.owner.cars", "Cars")} value={`${s.cars}${s.cars_pending ? ` (${s.cars_pending} in review)` : ""}`} color={C.teal} />
          </View>
        )}
        {s?.next_handover && (
          <TouchableOpacity onPress={() => router.push({ pathname: "/driver/rentals/[id]", params: { id: String(s.next_handover!.id) } } as any)}
            style={{ backgroundColor: C.tealLt, borderRadius: 14, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Ionicons name="key-outline" size={22} color={C.teal} />
            <Text style={{ flex: 1, color: C.dark, fontWeight: "700" }}>
              {t("rental.owner.nextHandover", { car: s.next_handover.car, when: formatWhen(s.next_handover.start_at, i18n.language), defaultValue: `Next handover: ${s.next_handover.car}, ${formatWhen(s.next_handover.start_at, i18n.language)}` })}
            </Text>
          </TouchableOpacity>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {TABS.map(tb => (
            <Chip key={tb.id} label={tb.id === "requested" && s?.requests ? `${tb.label} (${s.requests})` : tb.label} on={tab === tb.id} onPress={() => setTab(tb.id)} />
          ))}
        </ScrollView>
        {list.isLoading ? <ActivityIndicator color={C.teal} /> : (list.data ?? []).length === 0 ? (
          <Empty icon="calendar-outline" title={t("rental.owner.empty", "Nothing here yet")} />
        ) : (list.data ?? []).map(b => {
          const meta = STATUS_META[b.status];
          return (
            <TouchableOpacity key={b.id} onPress={() => router.push({ pathname: "/driver/rentals/[id]", params: { id: String(b.id) } } as any)}
              style={{ backgroundColor: C.white, borderRadius: 16, padding: 12, flexDirection: "row", gap: 12, alignItems: "center" }}>
              {b.car?.photo ? <Image source={{ uri: b.car.photo }} style={{ width: 64, height: 50, borderRadius: 8, backgroundColor: C.bg }} />
                : <View style={{ width: 64, height: 50, borderRadius: 8, backgroundColor: C.tealLt, alignItems: "center", justifyContent: "center" }}><Ionicons name="car-sport" size={22} color={C.teal} /></View>}
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontWeight: "800", color: C.dark }} numberOfLines={1}>{b.customer?.name} · {b.car?.name}</Text>
                <Text style={{ color: C.mid, fontSize: 12 }}>{formatWhen(b.start_at, i18n.language)} → {formatWhen(b.end_at, i18n.language)}</Text>
                <Badge label={OWNER_STATUS_LABEL[b.status] ?? meta.label} color={meta.color} bg={meta.bg} />
              </View>
              <Text style={{ fontWeight: "900", color: C.dark }}>{formatRwf(b.final_total ?? b.total)}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.white, borderRadius: 14, padding: 10 }}>
      <Text style={{ color, fontWeight: "900", fontSize: 14 }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{label}</Text>
    </View>
  );
}
