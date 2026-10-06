import { View, Text, TouchableOpacity, ActivityIndicator, FlatList, RefreshControl } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useInfiniteQuery } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { formatRwf } from "@/lib/fare";
import { Ride, isActive } from "@/lib/rides";

type Page = { data: Ride[]; next_page: number | null };

const STATUS_COLOR: Partial<Record<Ride["status"], string>> = {
  completed: C.green, cancelled_by_rider: C.muted, cancelled_by_driver: C.orange, declined: C.muted, expired: C.muted,
};

/** Trips tab → Rides: my on-demand rides, newest first, paginated (story S4.6) */
export function RideHistory() {
  const { t, i18n } = useTranslation();
  const { data, isLoading, isError, refetch, isRefetching, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: queryKeys.rides.mine(),
    queryFn: ({ pageParam }) => api.get<Page>("/rides", { params: { page: pageParam } }).then(r => r.data),
    initialPageParam: 1,
    getNextPageParam: last => last.next_page ?? undefined,
    staleTime: 60_000,
  });
  const rides = data?.pages.flatMap(p => p.data) ?? [];

  if (isLoading) return <SkeletonList />;
  if (isError) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 40 }}>
        <Text style={{ color: C.orange, fontWeight: "700" }}>{t("ride.history.error")}</Text>
        <TouchableOpacity onPress={() => refetch()} accessibilityLabel={t("trips.retry")}
          style={{ marginTop: 16, backgroundColor: C.blue, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
          <Text style={{ color: C.white, fontWeight: "800" }}>{t("trips.retry")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={rides}
      keyExtractor={r => String(r.id)}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={isRefetching && !isFetchingNextPage} onRefresh={refetch} />}
      onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
      onEndReachedThreshold={0.5}
      ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={C.blue} style={{ marginVertical: 16 }} /> : null}
      ListEmptyComponent={
        <View style={{ alignItems: "center", paddingVertical: 40, gap: 12 }}>
          <Ionicons name="car-sport-outline" size={40} color={C.muted} />
          <Text style={{ color: C.muted, fontWeight: "700" }}>{t("ride.history.empty")}</Text>
          <TouchableOpacity onPress={() => router.push("/ride")} accessibilityLabel={t("ride.where.bar")}
            style={{ backgroundColor: C.dark, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 }}>
            <Text style={{ color: C.white, fontWeight: "800" }}>{t("ride.where.bar")}</Text>
          </TouchableOpacity>
        </View>
      }
      renderItem={({ item: ride }) => {
        const when = ride.requested_at ? new Date(ride.requested_at).toLocaleString(i18n.language, { dateStyle: "medium", timeStyle: "short" }) : "";
        const from = ride.pickup.address?.split(",")[0] ?? "—";
        const to = ride.dropoff.address?.split(",")[0] ?? "—";
        const color = isActive(ride) ? C.teal : STATUS_COLOR[ride.status] ?? C.muted;
        return (
          <TouchableOpacity onPress={() => router.push(`/ride/${ride.id}` as any)} accessibilityLabel={`${from} → ${to}`}
            style={{ backgroundColor: C.white, borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: C.mid, fontSize: 12 }}>{when}</Text>
              <View style={{ backgroundColor: color, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: C.white, fontSize: 11, fontWeight: "700" }}>{t(`ride.history.status_${ride.status}`)}</Text>
              </View>
            </View>
            <Text numberOfLines={1} style={{ fontWeight: "800", fontSize: 15, color: C.dark, marginTop: 6 }}>{from} → {to}</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
              <Text style={{ color: C.mid, fontSize: 13 }}>{ride.driver?.name ?? ""}</Text>
              <Text style={{ fontWeight: "800", color: C.dark }}>{formatRwf(ride.final_fare ?? (ride.status.startsWith("cancelled") ? ride.cancel_fee : ride.quoted_fare))}</Text>
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

function SkeletonList() {
  return (
    <View style={{ padding: 16, gap: 10 }}>
      {[0, 1, 2, 3].map(i => (
        <View key={i} style={{ backgroundColor: C.white, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: C.border, gap: 8 }}>
          <View style={{ width: 120, height: 10, borderRadius: 5, backgroundColor: C.bg }} />
          <View style={{ width: "80%", height: 14, borderRadius: 7, backgroundColor: C.bg }} />
          <View style={{ width: "40%", height: 10, borderRadius: 5, backgroundColor: C.bg }} />
        </View>
      ))}
    </View>
  );
}
