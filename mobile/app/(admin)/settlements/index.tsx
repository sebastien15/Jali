import { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminNav } from "@/components/admin/AdminNavContext";
import { queryKeys } from "@/lib/queryKeys";
import { formatRwf } from "@/lib/fare";
import type { operations } from "@/lib/apiSchema";

type Item = operations["listSettlements"]["responses"]["200"]["content"]["application/json"][number];
type Status = "pending" | "confirmed" | "rejected";

/** Confirm drivers' MoMo commission payments (story S7.2) */
export default function SettlementsScreen() {
  const { user } = useAdminNav();
  const allowed = user?.permissions?.includes("manage-rides") ?? false;
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>("pending");
  const [busy, setBusy] = useState<number | null>(null);

  const { data = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: queryKeys.admin.settlements(status),
    queryFn: () => api.get<Item[]>("/admin/settlements", { params: { status } }).then(r => r.data),
    enabled: allowed,
  });

  async function act(item: Item, action: "confirm" | "reject") {
    const go = async (note?: string) => {
      setBusy(item.id);
      try {
        await api.post(`/admin/settlements/${item.id}/${action}`, note ? { note } : undefined);
        queryClient.invalidateQueries({ queryKey: ["admin", "settlements"] });
      } catch (err: any) {
        Alert.alert(err?.response?.data?.message ?? "Error");
      } finally {
        setBusy(null);
      }
    };
    if (action === "confirm") {
      Alert.alert("Confirm payment", `Did you receive ${formatRwf(item.amount)} with MoMo ID ${item.reference}?`, [
        { text: "Cancel", style: "cancel" }, { text: "Yes, received", onPress: () => go() },
      ]);
    } else {
      Alert.alert("Reject payment", "The driver will be told the payment was not found.", [
        { text: "Cancel", style: "cancel" }, { text: "Reject", style: "destructive", onPress: () => go("We could not find this MoMo payment. Check the transaction ID.") },
      ]);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <AdminHeader title="Driver settlements" showBack />
      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
        {(["pending", "confirmed", "rejected"] as Status[]).map(s => (
          <TouchableOpacity key={s} onPress={() => setStatus(s)} accessibilityLabel={s}
            style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: status === s ? C.teal : C.white, borderWidth: 1, borderColor: status === s ? C.teal : C.border }}>
            <Text style={{ color: status === s ? C.white : C.mid, fontWeight: "700", fontSize: 12, textTransform: "capitalize" }}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={data}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.teal} />}
        ListEmptyComponent={isLoading ? <ActivityIndicator color={C.teal} /> : (
          <Text style={{ color: C.mid, textAlign: "center", padding: 32 }}>{allowed ? "Nothing here." : "You don't have permission."}</Text>
        )}
        renderItem={({ item }) => (
          <View style={{ backgroundColor: C.white, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontWeight: "900", color: C.dark }}>{item.driver.name}</Text>
              <Text style={{ fontWeight: "900", color: C.dark }}>{formatRwf(item.amount)}</Text>
            </View>
            <Text style={{ color: C.mid, fontSize: 12 }}>{item.driver.phone} · MoMo ID {item.reference}</Text>
            <Text style={{ color: C.mid, fontSize: 12 }}>Owes now: {formatRwf(item.owed)}</Text>
            {item.status === "pending" ? (
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                <TouchableOpacity onPress={() => act(item, "reject")} disabled={busy === item.id} accessibilityLabel="Reject"
                  style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: C.border }}>
                  <Text style={{ color: C.orange, fontWeight: "800" }}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => act(item, "confirm")} disabled={busy === item.id} accessibilityLabel="Confirm"
                  style={{ flex: 2, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: C.teal }}>
                  {busy === item.id ? <ActivityIndicator color={C.white} /> : <Text style={{ color: C.white, fontWeight: "800" }}>Confirm received</Text>}
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        )}
      />
    </SafeAreaView>
  );
}
