import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import AdminHeader from "@/components/admin/AdminHeader";
import { queryKeys } from "@/lib/queryKeys";
import { formatRwf } from "@/lib/fare";
import type { components } from "@/lib/apiSchema";

type Hire = components["schemas"]["AdminHireSummary"];
type Page = { data: Hire[]; next_page: number | null };

const STATUSES = ["", "requested", "accepted", "started", "completed", "cancelled_by_customer", "cancelled_by_driver", "expired", "declined"];
const HIRE_STATUS_COLOR: Record<string, string> = {
  requested: C.orange, accepted: C.blue, started: C.teal, completed: C.green,
  cancelled_by_customer: C.mid, cancelled_by_driver: C.mid, expired: C.muted, declined: C.muted,
};

/** Admin: search driver hires (S6.6) */
export default function AdminHiresScreen() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [who, setWho] = useState<"customer" | "driver">("customer");
  const filters = { ...(status ? { status } : {}), ...(search.trim().length >= 2 ? { [who]: search.trim() } : {}) };

  const q = useInfiniteQuery({
    queryKey: queryKeys.admin.hires(filters),
    queryFn: ({ pageParam }) => api.get<Page>("/admin/hires", { params: { ...filters, page: pageParam } }).then(r => r.data),
    initialPageParam: 1,
    getNextPageParam: last => last.next_page ?? undefined,
  });
  const hires = q.data?.pages.flatMap(p => p.data) ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <AdminHeader title="Driver hires" showBack />
      <View style={{ padding: 12, gap: 8, backgroundColor: C.white }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["customer", "driver"] as const).map(w => (
            <TouchableOpacity key={w} onPress={() => setWho(w)} accessibilityLabel={`Search by ${w}`}
              style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: who === w ? C.teal : C.bg }}>
              <Text style={{ color: who === w ? C.white : C.mid, fontWeight: "700", textTransform: "capitalize" }}>{w}</Text>
            </TouchableOpacity>
          ))}
          <TextInput value={search} onChangeText={setSearch} placeholder="Name or phone" placeholderTextColor={C.muted}
            accessibilityLabel="Search hires" style={{ flex: 1, backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: 10, color: C.dark }} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {STATUSES.map(s => (
            <TouchableOpacity key={s || "all"} onPress={() => setStatus(s)} accessibilityLabel={s || "All"}
              style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: status === s ? C.teal : C.bg }}>
              <Text style={{ color: status === s ? C.white : C.mid, fontWeight: "700", fontSize: 12 }}>{s ? s.replace(/_/g, " ") : "All"}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={hires}
        keyExtractor={h => String(h.id)}
        contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} />}
        onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
        ListEmptyComponent={q.isLoading ? <ActivityIndicator color={C.teal} /> : <Text style={{ color: C.muted, textAlign: "center" }}>No hires.</Text>}
        renderItem={({ item: h }) => (
          <TouchableOpacity onPress={() => router.push({ pathname: "/(admin)/hires/[id]", params: { id: String(h.id) } } as any)}
            accessibilityLabel={`Hire ${h.id}`}
            style={{ backgroundColor: C.white, borderRadius: 12, padding: 12, flexDirection: "row", gap: 10, alignItems: "center" }}>
            <View style={{ width: 4, alignSelf: "stretch", borderRadius: 2, backgroundColor: HIRE_STATUS_COLOR[h.status] ?? C.muted }} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontWeight: "800", color: C.dark }}>#{h.id} · {h.customer?.name ?? "—"} → {h.driver?.name ?? "—"}</Text>
              <Text style={{ color: C.mid, fontSize: 12 }}>
                {new Date(h.start_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {h.status.replace(/_/g, " ")}
              </Text>
            </View>
            <Text style={{ fontWeight: "800", color: C.dark }}>{formatRwf(h.final_total ?? h.quoted_total)}</Text>
            <Ionicons name="chevron-forward" size={16} color={C.muted} />
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}
