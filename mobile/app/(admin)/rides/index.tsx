import { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, TextInput, RefreshControl, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminNav } from "@/components/admin/AdminNavContext";
import { queryKeys } from "@/lib/queryKeys";
import { formatRwf } from "@/lib/fare";
import type { operations, components } from "@/lib/apiSchema";

type Live = operations["getLiveOperations"]["responses"]["200"]["content"]["application/json"];
type Summary = components["schemas"]["AdminRideSummary"];
type Page = { data: Summary[]; next_page: number | null };
type Status = components["schemas"]["RideStatus"];

const STATUS_FILTERS: { key: Status | "all" | "flagged"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "flagged", label: "Flagged" },
  { key: "requested", label: "Requested" },
  { key: "in_progress", label: "On trip" },
  { key: "completed", label: "Completed" },
  { key: "cancelled_by_rider", label: "Rider cancelled" },
  { key: "cancelled_by_driver", label: "Driver cancelled" },
  { key: "expired", label: "Expired" },
];

const STATUS_COLOR: Record<Status, string> = {
  requested: C.orange, accepted: C.teal, arrived: C.teal, in_progress: C.blue, completed: C.green,
  declined: C.muted, expired: C.muted, cancelled_by_rider: C.muted, cancelled_by_driver: C.orange,
};

/** Admin ride operations: live view (S10.1) and searchable list (S10.2) */
export default function AdminRidesScreen() {
  const { user } = useAdminNav();
  const allowed = user?.permissions?.includes("manage-rides") ?? false;
  const [tab, setTab] = useState<"live" | "all">("live");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <AdminHeader title="Rides" showBack />
      <View style={{ flexDirection: "row", margin: 16, marginBottom: 4, backgroundColor: C.white, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: C.border }}>
        {(["live", "all"] as const).map(k => (
          <TouchableOpacity key={k} onPress={() => setTab(k)} accessibilityLabel={k === "live" ? "Live" : "All rides"}
            style={{ flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: "center", backgroundColor: tab === k ? C.teal : "transparent" }}>
            <Text style={{ fontWeight: "800", color: tab === k ? C.white : C.mid }}>{k === "live" ? "Live" : "All rides"}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {!allowed ? (
        <Text style={{ color: C.mid, textAlign: "center", padding: 32 }}>You don't have permission to manage rides.</Text>
      ) : tab === "live" ? <LiveView /> : <RideList />}
    </SafeAreaView>
  );
}

function LiveView() {
  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: queryKeys.admin.ridesLive(),
    queryFn: () => api.get<Live>("/admin/rides/live").then(r => r.data),
    refetchInterval: 10_000,
  });

  if (isLoading || !data) return <ActivityIndicator color={C.teal} style={{ marginTop: 32 }} />;
  const c = data.counters;
  const byClass = Object.entries(c.drivers_online_by_class).map(([k, v]) => `${v} ${k}`).join(" · ") || "—";
  const byStatus = c.rides_by_status as Record<string, number>;

  return (
    <FlatList
      data={data.rides}
      keyExtractor={r => String(r.id)}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.teal} />}
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 12 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Counter label="Drivers online" value={c.drivers_online} sub={byClass} color={C.green} />
            <Counter label="On a trip" value={c.drivers_on_trip} color={C.blue} />
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Counter label="Waiting for driver" value={byStatus.requested ?? 0} color={C.orange} />
            <Counter label="In progress" value={(byStatus.accepted ?? 0) + (byStatus.arrived ?? 0) + (byStatus.in_progress ?? 0)} color={C.teal} />
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Counter label="Expired (1 h)" value={c.expired_last_hour} color={c.expired_last_hour > 0 ? C.orange : C.muted} />
            <Counter label="Completed today" value={c.completed_today} color={C.green} />
          </View>
          <Text style={{ fontWeight: "900", color: C.dark, marginTop: 6 }}>Active rides</Text>
        </View>
      }
      ListEmptyComponent={<Text style={{ color: C.mid, textAlign: "center", padding: 24 }}>No active rides right now.</Text>}
      renderItem={({ item }) => <RideRow ride={item} />}
    />
  );
}

function RideList() {
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]["key"]>("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [who, setWho] = useState<"rider" | "driver">("rider");
  const params = {
    ...(status === "flagged" ? { flagged: 1 } : status !== "all" ? { status } : {}),
    ...(query ? { [who]: query } : {}),
  };

  const { data, isLoading, isRefetching, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: queryKeys.admin.rides(params),
    queryFn: ({ pageParam }) => api.get<Page>("/admin/rides", { params: { ...params, page: pageParam } }).then(r => r.data),
    initialPageParam: 1,
    getNextPageParam: last => last.next_page ?? undefined,
  });
  const rides = data?.pages.flatMap(p => p.data) ?? [];

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.white, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12 }}>
          <Ionicons name="search" size={16} color={C.muted} />
          <TextInput value={search} onChangeText={setSearch} onSubmitEditing={() => setQuery(search.trim())} returnKeyType="search"
            placeholder={`${who === "rider" ? "Rider" : "Driver"} name or phone`} placeholderTextColor={C.muted} accessibilityLabel="Search rides"
            style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, color: C.dark }} />
          <TouchableOpacity onPress={() => setWho(who === "rider" ? "driver" : "rider")} accessibilityLabel="Search riders or drivers"
            style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: C.tealLt }}>
            <Text style={{ color: C.teal, fontWeight: "800", fontSize: 12 }}>{who === "rider" ? "Rider" : "Driver"}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, padding: 16, paddingBottom: 8 }}>
        {STATUS_FILTERS.map(f => (
          <TouchableOpacity key={f.key} onPress={() => setStatus(f.key)} accessibilityLabel={f.label}
            style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: status === f.key ? C.teal : C.white, borderWidth: 1, borderColor: status === f.key ? C.teal : C.border }}>
            <Text style={{ color: status === f.key ? C.white : C.mid, fontWeight: "700", fontSize: 12 }}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <FlatList
        data={rides}
        keyExtractor={r => String(r.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isRefetching && !isFetchingNextPage} onRefresh={refetch} tintColor={C.teal} />}
        onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
        onEndReachedThreshold={0.5}
        ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={C.teal} style={{ margin: 16 }} /> : null}
        ListEmptyComponent={isLoading
          ? <View style={{ gap: 10 }}>{[0, 1, 2].map(i => <View key={i} style={{ height: 76, borderRadius: 14, backgroundColor: C.border, opacity: 0.5 }} />)}</View>
          : <Text style={{ color: C.mid, textAlign: "center", padding: 24 }}>No rides match.</Text>}
        renderItem={({ item }) => <RideRow ride={item} />}
      />
    </View>
  );
}

function Counter({ label, value, sub, color }: { label: string; value: number; sub?: string; color: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.white, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.border }}>
      <Text style={{ fontSize: 24, fontWeight: "900", color }}>{value}</Text>
      <Text style={{ color: C.mid, fontSize: 12, fontWeight: "700" }}>{label}</Text>
      {sub ? <Text numberOfLines={1} style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{sub}</Text> : null}
    </View>
  );
}

function RideRow({ ride }: { ride: Summary }) {
  const when = ride.requested_at ? new Date(ride.requested_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : "";
  return (
    <TouchableOpacity onPress={() => router.push(`/(admin)/rides/${ride.id}` as any)} accessibilityLabel={`Open ride ${ride.id}`}
      style={{ backgroundColor: C.white, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: ride.flagged ? C.orange : C.border }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: C.mid, fontSize: 12 }}>#{ride.id} · {when}</Text>
        <View style={{ backgroundColor: STATUS_COLOR[ride.status], borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ color: C.white, fontSize: 11, fontWeight: "700" }}>{ride.status.replace(/_/g, " ")}</Text>
        </View>
      </View>
      <Text numberOfLines={1} style={{ fontWeight: "800", color: C.dark, marginTop: 6 }}>
        {ride.pickup.address?.split(",")[0] ?? "—"} → {ride.dropoff.address?.split(",")[0] ?? "—"}
      </Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        <Text numberOfLines={1} style={{ color: C.mid, fontSize: 12, flex: 1 }}>
          {ride.rider?.name ?? "—"} → {ride.driver?.name ?? "—"}
        </Text>
        <Text style={{ fontWeight: "800", color: C.dark }}>{formatRwf(ride.final_fare ?? ride.quoted_fare)}</Text>
      </View>
    </TouchableOpacity>
  );
}
