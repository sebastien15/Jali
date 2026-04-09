import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { C } from "@/constants/theme";
import api from "@/lib/api";

type NavTile = {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  route: string;
  color: string;
  superadminOnly?: boolean;
};

const TILES: NavTile[] = [
  { label: "Buses",     icon: "bus-outline",       route: "/(admin)/buses/index",     color: C.blue   },
  { label: "Bookings",  icon: "calendar-outline",  route: "/(admin)/bookings/index",  color: C.teal   },
  { label: "Analytics", icon: "bar-chart-outline", route: "/(admin)/analytics/index", color: C.green  },
  { label: "Stations",  icon: "location-outline",  route: "/(admin)/stations/index",  color: C.orange, superadminOnly: true },
  { label: "Users",     icon: "people-outline",    route: "/(admin)/users/index",     color: C.blue,   superadminOnly: true },
];

export default function AdminDashboard() {
  const [stats, setStats]           = useState<any>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [adminName, setAdminName]   = useState("");
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [meRes, analyticsRes] = await Promise.all([
        api.post("/auth/login"),
        api.get("/analytics/bookings"),
      ]);
      const roles: string[] = meRes.data.user?.roles ?? [];
      setIsSuperAdmin(roles.includes("superadmin"));
      setAdminName(meRes.data.user?.name ?? "Admin");
      setStats(analyticsRes.data.data ?? null);
    } catch {}
    finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleLogout() {
    await signOut(auth);
    router.replace("/(auth)/login");
  }

  const tiles = TILES.filter(t => !t.superadminOnly || isSuperAdmin);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />

      {/* Header */}
      <View style={{ backgroundColor: C.teal, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View>
            <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: "600" }}>
              {isSuperAdmin ? "Superadmin" : "Admin"} · {adminName}
            </Text>
            <Text style={{ color: C.white, fontWeight: "900", fontSize: 24, marginTop: 2 }}>
              Dashboard
            </Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={{ padding: 4 }}>
            <Ionicons name="log-out-outline" size={22} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        {loading ? (
          <ActivityIndicator color={C.teal} style={{ marginTop: 32 }} />
        ) : (
          <>
            {/* Stats row */}
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
              <StatCard label="Total" value={stats?.total_bookings ?? 0} color={C.teal} />
              <StatCard label="Pending"   value={stats?.by_status?.pending   ?? 0} color={C.orange} />
              <StatCard label="Confirmed" value={stats?.by_status?.confirmed ?? 0} color={C.green}  />
            </View>

            {/* Revenue card */}
            <View style={{
              backgroundColor: C.white, borderRadius: 20, padding: 16,
              marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.07,
              shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 3,
            }}>
              <Text style={{ color: C.muted, fontSize: 12, fontWeight: "700", marginBottom: 4 }}>
                TOTAL REVENUE
              </Text>
              <Text style={{ color: C.dark, fontWeight: "900", fontSize: 28 }}>
                {(stats?.total_revenue ?? 0).toLocaleString()}
                <Text style={{ fontSize: 14, fontWeight: "600", color: C.muted }}> RWF</Text>
              </Text>
            </View>

            {/* Nav tiles */}
            <Text style={{ color: C.muted, fontWeight: "700", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
              Management
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {tiles.map(tile => (
                <TouchableOpacity
                  key={tile.label}
                  onPress={() => router.push(tile.route as any)}
                  style={{
                    width: "47%", backgroundColor: C.white, borderRadius: 20,
                    padding: 18, shadowColor: "#000", shadowOpacity: 0.07,
                    shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 3,
                  }}
                >
                  <View style={{
                    backgroundColor: tile.color + "18", borderRadius: 12,
                    width: 42, height: 42, alignItems: "center", justifyContent: "center", marginBottom: 10,
                  }}>
                    <Ionicons name={tile.icon} size={20} color={tile.color} />
                  </View>
                  <Text style={{ color: C.dark, fontWeight: "800", fontSize: 14 }}>{tile.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{
      flex: 1, backgroundColor: C.white, borderRadius: 16, padding: 14,
      shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 10,
      shadowOffset: { width: 0, height: 2 }, elevation: 3,
    }}>
      <Text style={{ color, fontWeight: "900", fontSize: 22 }}>{value}</Text>
      <Text style={{ color: C.muted, fontSize: 11, fontWeight: "600", marginTop: 2 }}>{label}</Text>
    </View>
  );
}
