import { View, Text, TouchableOpacity, ActivityIndicator, FlatList, RefreshControl } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useInfiniteQuery } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { formatRwf } from "@/lib/fare";
import { DriverHire, isActiveHire, formatWhen } from "@/lib/hire";

type Page = { data: DriverHire[]; next_page: number | null };

/** Trips tab → Hires: my hire-a-driver bookings, newest first */
export function HireHistory() {
  const { t, i18n } = useTranslation();
  const { data, isLoading, isError, refetch, isRefetching, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: [...queryKeys.hire.mine(), "pages"],
    queryFn: ({ pageParam }) => api.get<Page>("/driver-hire", { params: { page: pageParam } }).then(r => r.data),
    initialPageParam: 1,
    getNextPageParam: last => last.next_page ?? undefined,
    staleTime: 60_000,
  });
  const hires = data?.pages.flatMap(p => p.data) ?? [];

  if (isLoading) return <ActivityIndicator color={C.blue} style={{ marginTop: 32 }} />;
  if (isError) {
    return (
      <TouchableOpacity onPress={() => refetch()} accessibilityLabel={t("trips.retry")} style={{ alignItems: "center", padding: 32 }}>
        <Text style={{ color: C.orange, fontWeight: "700" }}>{t("hire.history.error")}</Text>
        <Text style={{ color: C.blue, fontWeight: "800", marginTop: 8 }}>{t("trips.retry")}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <FlatList
      data={hires}
      keyExtractor={h => String(h.id)}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={isRefetching && !isFetchingNextPage} onRefresh={refetch} />}
      onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={
        <View style={{ alignItems: "center", paddingVertical: 40, gap: 12 }}>
          <Ionicons name="key-outline" size={40} color={C.muted} />
          <Text style={{ color: C.muted, fontWeight: "700" }}>{t("hire.history.empty")}</Text>
          <TouchableOpacity onPress={() => router.push("/hire" as any)} accessibilityLabel={t("hire.bar")}
            style={{ backgroundColor: C.dark, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 }}>
            <Text style={{ color: C.white, fontWeight: "800" }}>{t("hire.bar")}</Text>
          </TouchableOpacity>
        </View>
      }
      renderItem={({ item: h }) => (
        <TouchableOpacity onPress={() => router.push(`/hire/${h.id}` as any)} accessibilityLabel={h.driver.name}
          style={{ backgroundColor: C.white, borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: isActiveHire(h) ? C.teal : C.border }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
            <Text style={{ color: C.mid, fontSize: 12 }}>{formatWhen(h.start_at, i18n.language)}</Text>
            <Text style={{ color: isActiveHire(h) ? C.teal : C.muted, fontSize: 12, fontWeight: "800" }}>{t(`hire.short.${h.status}`)}</Text>
          </View>
          <Text style={{ fontWeight: "800", fontSize: 15, color: C.dark, marginTop: 6 }}>
            {h.driver.name} · {h.duration_type === "days" ? t("hire.days", { count: h.duration_value }) : t("hire.hours", { count: h.duration_value })}
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
            <Text numberOfLines={1} style={{ color: C.mid, fontSize: 13, flex: 1 }}>{h.pickup.address ?? ""}</Text>
            <Text style={{ fontWeight: "800", color: C.dark }}>{formatRwf(h.final_total ?? (h.status.startsWith("cancelled") ? h.cancel_fee : h.quoted_total))}</Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}
