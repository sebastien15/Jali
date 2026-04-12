import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import AdminHeader from "@/components/admin/AdminHeader";

const ROLE_COLOR: Record<string, string> = {
  superadmin: "#7C3AED", admin: C.teal, driver: C.blue, user: C.muted,
};
const ROLE_BG: Record<string, string> = {
  superadmin: "#F3F0FF", admin: C.tealLt, driver: C.blueLt, user: C.bg,
};

export default function AdminUsersScreen() {
  const [users, setUsers]           = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.get("/admin/users");
      setUsers(res.data);
    } catch {
      setUsers([]);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />

      <AdminHeader title="Users" />

      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        {loading && <ActivityIndicator color={C.teal} style={{ marginTop: 32 }} />}

        {!loading && users.length === 0 && (
          <Text style={{ color: C.muted, textAlign: "center", marginTop: 40 }}>No users found.</Text>
        )}

        {!loading && users.map(u => (
          <TouchableOpacity
            key={u.id}
            onPress={() => router.push(`/(admin)/users/${u.id}` as any)}
            style={{
              backgroundColor: C.white, borderRadius: 20, padding: 16, marginBottom: 12,
              shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 10,
              shadowOffset: { width: 0, height: 2 }, elevation: 3,
              flexDirection: "row", alignItems: "center", gap: 12,
            }}
          >
            <View style={{
              backgroundColor: C.tealLt, borderRadius: 14,
              width: 44, height: 44, alignItems: "center", justifyContent: "center",
            }}>
              <Text style={{ color: C.teal, fontWeight: "900", fontSize: 17 }}>
                {u.name?.charAt(0)?.toUpperCase() ?? "?"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.dark, fontWeight: "700", fontSize: 14 }}>{u.name}</Text>
              <Text style={{ color: C.muted, fontSize: 12, marginTop: 1 }}>{u.email}</Text>
            </View>
            <View style={{ backgroundColor: ROLE_BG[u.role] ?? C.bg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ color: ROLE_COLOR[u.role] ?? C.muted, fontSize: 10, fontWeight: "700" }}>{u.role}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.border} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
