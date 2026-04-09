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

type BookingStatus = "pending" | "confirmed" | "completed";
const STATUS_COLOR: Record<BookingStatus, string> = {
  pending: C.orange, confirmed: C.green, completed: C.muted,
};
const STATUS_BG: Record<BookingStatus, string> = {
  pending: C.orangeLt, confirmed: C.greenLt, completed: C.bg,
};

export default function AdminBookingsScreen() {
  const [filter, setFilter]         = useState<"all" | BookingStatus>("all");
  const [bookings, setBookings]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.get("/admin/bookings");
      setBookings(res.data);
    } catch {
      setBookings([]);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const list = filter === "all" ? bookings : bookings.filter(b => b.status === filter);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />

      <View style={{ backgroundColor: C.teal, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={C.white} />
          </TouchableOpacity>
          <Text style={{ color: C.white, fontWeight: "900", fontSize: 22 }}>Bookings</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 8, paddingBottom: 16 }}>
            {(["all", "pending", "confirmed", "completed"] as const).map(f => (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f)}
                style={{
                  backgroundColor: filter === f ? C.white : "rgba(255,255,255,0.2)",
                  borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8,
                }}
              >
                <Text style={{
                  color: filter === f ? C.teal : C.white,
                  fontWeight: "800", fontSize: 13, textTransform: "capitalize",
                }}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        {loading && <ActivityIndicator color={C.teal} style={{ marginTop: 32 }} />}

        {!loading && list.length === 0 && (
          <Text style={{ color: C.muted, textAlign: "center", marginTop: 40 }}>No bookings found.</Text>
        )}

        {!loading && list.map(b => (
          <TouchableOpacity
            key={b.id}
            onPress={() => router.push(`/(admin)/bookings/${b.id}` as any)}
            style={{
              backgroundColor: C.white, borderRadius: 20, padding: 16,
              marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.07,
              shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 3,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.dark, fontWeight: "800", fontSize: 14 }}>{b.title}</Text>
                <Text style={{ color: C.mid, fontSize: 12, marginTop: 2 }}>{b.sub}</Text>
                <Text style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>
                  {b.user_name} · {b.user_email}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <Text style={{ color: C.dark, fontWeight: "800", fontSize: 13 }}>
                  {(b.price + (b.service_fee ?? 0)).toLocaleString()} RWF
                </Text>
                <View style={{ backgroundColor: STATUS_BG[b.status as BookingStatus], borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: STATUS_COLOR[b.status as BookingStatus], fontSize: 11, fontWeight: "700", textTransform: "capitalize" }}>
                    {b.status}
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
