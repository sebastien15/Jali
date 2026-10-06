import { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminNav } from "@/components/admin/AdminNavContext";
import { queryKeys } from "@/lib/queryKeys";

type Status = "pending" | "verified" | "rejected" | "suspended";
type Item = {
  user_id: number; name: string | null; phone: string | null;
  services: string[]; status: Status; submitted_at: string | null;
};

const FILTERS: { key: Status; label: string }[] = [
  { key: "pending", label: "To review" },
  { key: "verified", label: "Verified" },
  { key: "rejected", label: "Rejected" },
  { key: "suspended", label: "Suspended" },
];

const SERVICE_LABEL: Record<string, string> = {
  ride: "Rides", hire: "Hire", private_seat: "Seats", rental: "Rental",
};

function waiting(iso: string | null): string {
  if (!iso) return "";
  const hours = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 36e5));
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}

export default function DriverQueueScreen() {
  const { user } = useAdminNav();
  const canReview = user?.permissions?.includes("verify-drivers") ?? false;
  const [status, setStatus] = useState<Status>("pending");

  const { data = [], isLoading, isRefetching, refetch } = useQuery<Item[]>({
    queryKey: queryKeys.admin.drivers(status),
    queryFn: () => api.get("/admin/drivers", { params: { status } }).then(r => r.data),
    enabled: canReview,
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <AdminHeader title="Driver applications" showBack />
      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
        {FILTERS.map(f => (
          <TouchableOpacity key={f.key} onPress={() => setStatus(f.key)} accessibilityLabel={f.label}
            style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: status === f.key ? C.teal : C.white, borderWidth: 1, borderColor: status === f.key ? C.teal : C.border }}>
            <Text style={{ color: status === f.key ? C.white : C.mid, fontWeight: "700", fontSize: 12 }}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={data}
        keyExtractor={i => String(i.user_id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.teal} />}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ gap: 10 }}>
              {[0, 1, 2].map(i => <View key={i} style={{ height: 70, borderRadius: 14, backgroundColor: C.border, opacity: 0.5 }} />)}
            </View>
          ) : (
            <View style={{ alignItems: "center", padding: 32, gap: 8 }}>
              <Ionicons name="checkmark-done-outline" size={36} color={C.muted} />
              <Text style={{ color: C.mid }}>{canReview ? "Nothing here right now." : "You don't have permission to review drivers."}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/(admin)/drivers/${item.user_id}` as any)} accessibilityLabel={`Open application of ${item.name}`}
            style={{ backgroundColor: C.white, borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: C.border }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.tealLt, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="person-outline" size={20} color={C.teal} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "800", color: C.dark }}>{item.name ?? "—"}</Text>
              <Text style={{ color: C.mid, fontSize: 12, marginTop: 2 }}>
                {item.services.map(s => SERVICE_LABEL[s] ?? s).join(" · ")} {item.phone ? `· ${item.phone}` : ""}
              </Text>
            </View>
            <Text style={{ color: C.muted, fontSize: 11 }}>{waiting(item.submitted_at)}</Text>
            <Ionicons name="chevron-forward" size={18} color={C.muted} />
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}
