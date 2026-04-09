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

export default function AdminAnalyticsScreen() {
  const [revenue, setRevenue]     = useState<any>(null);
  const [bookings, setBookings]   = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [revRes, bkRes] = await Promise.all([
        api.get("/analytics/revenue"),
        api.get("/analytics/bookings"),
      ]);
      setRevenue(revRes.data.data);
      setBookings(bkRes.data.data);
    } catch {}
    finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />

      <View style={{ backgroundColor: C.teal, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={C.white} />
        </TouchableOpacity>
        <Text style={{ color: C.white, fontWeight: "900", fontSize: 22 }}>Analytics</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        {loading ? (
          <ActivityIndicator color={C.teal} style={{ marginTop: 32 }} />
        ) : (
          <>
            <Label text="Revenue" />
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
              <BigCard label="Total Paid"    value={(revenue?.total_user_paid ?? 0).toLocaleString()}      color={C.teal} />
              <BigCard label="Jali Revenue"  value={(revenue?.total_jali_revenue ?? 0).toLocaleString()}   color={C.green} />
            </View>
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 24 }}>
              <BigCard label="Platform"      value={(revenue?.platform_share ?? 0).toLocaleString()}       color={C.blue} />
              <BigCard label="Station Share" value={(revenue?.admin_station_share ?? 0).toLocaleString()}  color={C.orange} />
            </View>

            <Label text="Bookings" />
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
              <StatCard label="Total"     value={bookings?.total_bookings        ?? 0} color={C.dark} />
              <StatCard label="Pending"   value={bookings?.by_status?.pending    ?? 0} color={C.orange} />
              <StatCard label="Confirmed" value={bookings?.by_status?.confirmed  ?? 0} color={C.green} />
            </View>

            <Label text="By Type" />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <StatCard label="Bus"     value={bookings?.by_type?.bus     ?? 0} color={C.blue} />
              <StatCard label="Rental"  value={bookings?.by_type?.rental  ?? 0} color={C.teal} />
              <StatCard label="Private" value={bookings?.by_type?.private ?? 0} color={C.orange} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Label({ text }: { text: string }) {
  return (
    <Text style={{ color: C.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
      {text}
    </Text>
  );
}

function BigCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{
      flex: 1, backgroundColor: C.white, borderRadius: 16, padding: 14,
      shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 3,
    }}>
      <Text style={{ color: C.muted, fontSize: 11, fontWeight: "600", marginBottom: 4 }}>{label}</Text>
      <Text style={{ color, fontWeight: "900", fontSize: 18 }}>{value}</Text>
      <Text style={{ color: C.muted, fontSize: 11 }}>RWF</Text>
    </View>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{
      flex: 1, backgroundColor: C.white, borderRadius: 16, padding: 14,
      shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 3,
    }}>
      <Text style={{ color, fontWeight: "900", fontSize: 24 }}>{value}</Text>
      <Text style={{ color: C.muted, fontSize: 11, fontWeight: "600", marginTop: 2 }}>{label}</Text>
    </View>
  );
}
