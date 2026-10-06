import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { formatRwf } from "@/lib/fare";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminRentalCar } from "../rentals";
import { Chip, Empty } from "../components/ui";

type Status = "pending" | "verified" | "rejected";

/** Admin: rental cars to verify (S24.8) */
export default function AdminRentalCarsScreen() {
  const [status, setStatus] = useState<Status>("pending");
  const { data = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.admin.rentalCars(status),
    queryFn: () => api.get<{ data: AdminRentalCar[] }>("/admin/rental-cars", { params: { status } }).then(r => r.data.data),
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <AdminHeader title="Rental cars" showBack />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Chip label="To review" on={status === "pending"} onPress={() => setStatus("pending")} />
          <Chip label="Live" on={status === "verified"} onPress={() => setStatus("verified")} />
          <Chip label="Rejected" on={status === "rejected"} onPress={() => setStatus("rejected")} />
        </View>
        <TouchableOpacity onPress={() => router.push("/(admin)/rentals" as any)} style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 12, backgroundColor: C.white, borderRadius: 12 }}>
          <Ionicons name="calendar-outline" size={18} color={C.teal} />
          <Text style={{ flex: 1, color: C.dark, fontWeight: "700" }}>All rentals</Text>
          <Ionicons name="chevron-forward" size={16} color={C.muted} />
        </TouchableOpacity>
        {isLoading ? <ActivityIndicator color={C.teal} /> : data.length === 0 ? <Empty icon="checkmark-done-outline" title="Nothing here" /> : data.map(car => (
          <TouchableOpacity key={car.id} onPress={() => router.push({ pathname: "/(admin)/rental-cars/[id]", params: { id: String(car.id) } } as any)}
            style={{ backgroundColor: C.white, borderRadius: 14, padding: 12, flexDirection: "row", gap: 12, alignItems: "center" }}>
            {car.photos[0] ? <Image source={{ uri: car.photos[0] }} style={{ width: 80, height: 60, borderRadius: 8, backgroundColor: C.bg }} />
              : <View style={{ width: 80, height: 60, borderRadius: 8, backgroundColor: C.tealLt, alignItems: "center", justifyContent: "center" }}><Ionicons name="car-sport" size={22} color={C.teal} /></View>}
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "800", color: C.dark }}>{car.name} · {car.plate}</Text>
              <Text style={{ color: C.mid, fontSize: 12 }}>{car.owner?.name} · {car.owner?.phone ?? "—"}</Text>
              <Text style={{ color: car.missing.length ? C.orange : C.green, fontSize: 12, fontWeight: "700" }}>
                {car.missing.length ? `Missing: ${car.missing.join(", ")}` : `Complete · ${formatRwf(car.priceDay)}/day`}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.muted} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
