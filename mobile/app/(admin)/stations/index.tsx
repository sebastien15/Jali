import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { C } from "@/constants/theme";
import api from "@/lib/api";

export default function AdminStationsScreen() {
  const [stations, setStations]   = useState<any[]>([]);
  const [admins, setAdmins]       = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [stRes, usRes] = await Promise.all([
        api.get("/admin/stations"),
        api.get("/admin/users"),
      ]);
      setStations(stRes.data);
      setAdmins((usRes.data as any[]).filter(u =>
        (u.roles as string[]).some(r => r === "admin" || r === "superadmin")
      ));
    } catch {
      setStations([]);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleReassign(stationId: number, city: string) {
    if (admins.length === 0) {
      Alert.alert("No admins", "No admin users available to assign.");
      return;
    }
    Alert.alert(`Reassign ${city}`, "Choose new admin:", [
      ...admins.map(a => ({
        text: `${a.name}`,
        onPress: async () => {
          try {
            await api.patch(`/admin/stations/${stationId}`, { admin_id: a.id });
            load(true);
          } catch {
            Alert.alert("Error", "Could not reassign station.");
          }
        },
      })),
      { text: "Cancel", style: "cancel" },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />

      <View style={{ backgroundColor: C.teal, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={C.white} />
        </TouchableOpacity>
        <Text style={{ color: C.white, fontWeight: "900", fontSize: 22 }}>Stations</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        {loading && <ActivityIndicator color={C.teal} style={{ marginTop: 32 }} />}

        {!loading && stations.length === 0 && (
          <Text style={{ color: C.muted, textAlign: "center", marginTop: 40 }}>No stations found.</Text>
        )}

        {!loading && stations.map(s => (
          <View key={s.id} style={{
            backgroundColor: C.white, borderRadius: 20, padding: 16, marginBottom: 12,
            shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 10,
            shadowOffset: { width: 0, height: 2 }, elevation: 3,
            flexDirection: "row", alignItems: "center",
          }}>
            <View style={{
              backgroundColor: C.orangeLt, borderRadius: 12,
              width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: 12,
            }}>
              <Ionicons name="location-outline" size={20} color={C.orange} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.dark, fontWeight: "800", fontSize: 15 }}>{s.city}</Text>
              <Text style={{ color: s.admin_name ? C.teal : C.muted, fontSize: 12, marginTop: 2, fontWeight: "600" }}>
                {s.admin_name ?? "Unassigned"}
              </Text>
              {s.admin_email && (
                <Text style={{ color: C.muted, fontSize: 11 }}>{s.admin_email}</Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => handleReassign(s.id, s.city)}
              style={{ backgroundColor: C.tealLt, borderRadius: 10, padding: 10 }}
            >
              <Ionicons name="swap-horizontal-outline" size={18} color={C.teal} />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
