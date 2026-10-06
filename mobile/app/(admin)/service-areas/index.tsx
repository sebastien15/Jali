import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminNav } from "@/components/admin/AdminNavContext";
import { queryKeys } from "@/lib/queryKeys";
import type { components } from "@/lib/apiSchema";

type ServiceArea = components["schemas"]["ServiceArea"];

/** Superadmin: cities where Jali works and special zones inside them (S10.4) */
export default function ServiceAreasScreen() {
  const { isSuperAdmin } = useAdminNav();
  const list = useQuery({
    queryKey: queryKeys.admin.serviceAreas(),
    queryFn: () => api.get<{ data: ServiceArea[] }>("/admin/service-areas").then(r => r.data.data),
    enabled: isSuperAdmin,
  });
  const areas = list.data ?? [];
  const cities = areas.filter(a => a.kind === "city");
  const zones = areas.filter(a => a.kind === "zone");
  const open = (id: number | "new") => router.push({ pathname: "/(admin)/service-areas/[id]", params: { id: String(id) } } as any);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <AdminHeader title="Service areas" showBack
        right={isSuperAdmin ? (
          <TouchableOpacity onPress={() => open("new")} accessibilityLabel="Add a city or zone" style={{ padding: 4 }}>
            <Ionicons name="add-circle-outline" size={26} color={C.white} />
          </TouchableOpacity>
        ) : undefined} />
      {!isSuperAdmin ? (
        <Text style={{ color: C.mid, padding: 20 }}>Only the superadmin can change service areas.</Text>
      ) : list.isLoading ? (
        <ActivityIndicator color={C.teal} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => list.refetch()} />}>
          <Text style={{ color: C.mid, fontSize: 13 }}>
            Rides and hire are offered only inside a live city. Turn a city on when you launch there; switch single services off per city.
          </Text>
          <Title text="Cities" />
          {cities.map(a => <AreaRow key={a.id} area={a} onPress={() => open(a.id)} />)}
          <Title text="Zones (airport, stadium, pickup points…)" />
          {zones.length === 0
            ? <Text style={{ color: C.muted }}>No zones yet.</Text>
            : zones.map(a => <AreaRow key={a.id} area={a} onPress={() => open(a.id)} />)}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Title({ text }: { text: string }) {
  return <Text style={{ fontWeight: "800", fontSize: 13, color: C.teal, textTransform: "uppercase", marginTop: 8 }}>{text}</Text>;
}

function AreaRow({ area, onPress }: { area: ServiceArea; onPress: () => void }) {
  const off = Object.entries(area.overrides?.services ?? {}).filter(([, on]) => on === false).map(([k]) => k);
  const sub = area.kind === "city"
    ? [`${area.zones_count} zone(s)`, off.length ? `off: ${off.join(", ")}` : null].filter(Boolean).join(" · ")
    : `${area.zone_type ?? "zone"}${area.parent_name ? ` · ${area.parent_name}` : ""}`;
  return (
    <TouchableOpacity onPress={onPress} accessibilityLabel={`Edit ${area.name}`}
      style={{ backgroundColor: C.white, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Ionicons name={area.kind === "city" ? "business-outline" : "location-outline"} size={22} color={area.active ? C.green : C.muted} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "800", color: C.dark }}>{area.name}</Text>
        <Text style={{ color: C.mid, fontSize: 12 }}>{sub}</Text>
      </View>
      <View style={{ backgroundColor: area.active ? C.greenLt : C.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
        <Text style={{ color: area.active ? C.green : C.muted, fontWeight: "800", fontSize: 11 }}>{area.active ? "Live" : "Off"}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.muted} />
    </TouchableOpacity>
  );
}
