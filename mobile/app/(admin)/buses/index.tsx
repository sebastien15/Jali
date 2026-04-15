import {
  View, Text, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import AdminHeader from "@/components/admin/AdminHeader";
import { queryKeys } from "@/lib/queryKeys";

export default function AdminBusesScreen() {
  const queryClient = useQueryClient();
  const { data: buses = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: queryKeys.admin.buses(),
    queryFn: () => api.get("/admin/buses").then(r => r.data ?? []),
    staleTime: 2 * 60_000,
  });

  async function handleDelete(id: number, agency: string) {
    Alert.alert("Delete bus", `Remove ${agency}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/admin/buses/${id}`);
            queryClient.invalidateQueries({ queryKey: queryKeys.admin.buses() });
          } catch {
            Alert.alert("Error", "Could not delete bus.");
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />

      <AdminHeader
        title="Buses"
        right={
          <TouchableOpacity
            onPress={() => router.push("/(admin)/buses/new" as any)}
            style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}
          >
            <Text style={{ color: C.white, fontWeight: "800", fontSize: 13 }}>+ Add</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {isLoading && <ActivityIndicator color={C.teal} style={{ marginTop: 32 }} />}

        {!isLoading && buses.length === 0 && (
          <Text style={{ color: C.muted, textAlign: "center", marginTop: 40 }}>No buses yet.</Text>
        )}

        {!isLoading && buses.map((bus: any) => (
          <View key={bus.id} style={{
            backgroundColor: C.white, borderRadius: 20, padding: 16,
            marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.07,
            shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 3,
          }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Text style={{ color: C.dark, fontWeight: "800", fontSize: 15 }}>{bus.agency}</Text>
                  <View style={{
                    backgroundColor: bus.active ? C.greenLt : C.orangeLt,
                    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
                  }}>
                    <Text style={{ color: bus.active ? C.green : C.orange, fontSize: 10, fontWeight: "700" }}>
                      {bus.active ? "Active" : "Inactive"}
                    </Text>
                  </View>
                </View>
                <Text style={{ color: C.mid, fontSize: 13 }}>{bus.from} → {bus.to}</Text>
                <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
                  {bus.dep} – {bus.arr} · {bus.seats} seats · {bus.price?.toLocaleString()} RWF
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 4 }}>
                <TouchableOpacity
                  onPress={() => router.push(`/(admin)/buses/${bus.id}` as any)}
                  style={{ padding: 8 }}
                >
                  <Ionicons name="pencil-outline" size={18} color={C.teal} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(bus.id, bus.agency)} style={{ padding: 8 }}>
                  <Ionicons name="trash-outline" size={18} color={C.orange} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
