import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { formatRwf } from "@/lib/fare";
import { OwnerRentalCar, OwnerRentalSummary } from "../rentals";
import { Badge, Empty, Header } from "../components/ui";

/** Owner: my rental cars, their review state, and a link to requests (S24.7, S24.8) */
export default function FleetScreen() {
  const { t } = useTranslation();
  const cars = useQuery({
    queryKey: queryKeys.driver.cars(),
    queryFn: () => api.get<OwnerRentalCar[]>("/driver/cars").then(r => r.data ?? []),
  });
  const summary = useQuery({
    queryKey: queryKeys.driver.rentalSummary(),
    queryFn: () => api.get<OwnerRentalSummary>("/driver/rentals/summary").then(r => r.data),
  });
  const s = summary.data;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title={t("rental.fleet.title", "My rental cars")} subtitle={t("rental.fleet.subtitle", "Car rental owner")}
        right={
          <TouchableOpacity onPress={() => router.push({ pathname: "/driver/car/[id]", params: { id: "new" } } as any)} accessibilityLabel={t("rental.fleet.add", "Add a car")}
            style={{ backgroundColor: C.teal, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8 }}>
            <Ionicons name="add" size={18} color={C.white} />
            <Text style={{ color: C.white, fontWeight: "800" }}>{t("rental.fleet.addShort", "Add")}</Text>
          </TouchableOpacity>
        } />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={cars.isRefetching} onRefresh={() => { cars.refetch(); summary.refetch(); }} />}>
        <TouchableOpacity onPress={() => router.push("/driver/rentals" as any)} accessibilityLabel={t("rental.fleet.requests", "Requests and rentals")}
          style={{ backgroundColor: C.white, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, borderLeftWidth: 4, borderLeftColor: (s?.requests ?? 0) > 0 ? C.orange : C.teal }}>
          <Ionicons name="calendar-outline" size={24} color={C.teal} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "800", color: C.dark }}>{t("rental.fleet.requests", "Requests and rentals")}</Text>
            <Text style={{ color: C.mid, fontSize: 12 }}>
              {s ? `${s.requests} new · ${s.upcoming} upcoming · ${s.active} on the road · ${formatRwf(s.income_this_month)} this month` : "…"}
            </Text>
          </View>
          {(s?.requests ?? 0) > 0 && <View style={{ backgroundColor: C.orange, borderRadius: 12, minWidth: 24, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ color: C.white, fontWeight: "900", textAlign: "center" }}>{s!.requests}</Text></View>}
          <Ionicons name="chevron-forward" size={18} color={C.muted} />
        </TouchableOpacity>

        {cars.isLoading ? <ActivityIndicator color={C.teal} style={{ marginTop: 24 }} /> : (cars.data ?? []).length === 0 ? (
          <Empty icon="car-sport-outline" title={t("rental.fleet.none", "No cars yet")} text={t("rental.fleet.noneHint", "Add your car with photos, a description and your rules. Jali checks it, then customers can rent it.")} />
        ) : (cars.data ?? []).map(car => {
          const live = car.verification_status === "verified";
          const rejected = car.verification_status === "rejected";
          return (
            <TouchableOpacity key={car.id} onPress={() => router.push({ pathname: "/driver/car/[id]", params: { id: String(car.id) } } as any)}
              style={{ backgroundColor: C.white, borderRadius: 16, overflow: "hidden" }}>
              <View style={{ flexDirection: "row", gap: 12, padding: 12, alignItems: "center" }}>
                {car.photos[0] ? <Image source={{ uri: car.photos[0] }} style={{ width: 90, height: 68, borderRadius: 10, backgroundColor: C.bg }} />
                  : <View style={{ width: 90, height: 68, borderRadius: 10, backgroundColor: C.tealLt, alignItems: "center", justifyContent: "center" }}><Ionicons name="camera-outline" size={24} color={C.teal} /></View>}
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontWeight: "900", color: C.dark }} numberOfLines={1}>{car.name}</Text>
                  <Text style={{ color: C.mid, fontSize: 12 }}>{car.plate} · {formatRwf(car.priceDay)}/day</Text>
                  <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                    <Badge label={live ? "Live" : rejected ? "Needs changes" : "In review"} color={live ? C.green : C.orange} bg={live ? C.greenLt : C.orangeLt} />
                    {car.status === "maintenance" && <Badge label="Paused" color={C.mid} bg={C.bg} />}
                    {car.open_rentals > 0 && <Badge label={`${car.open_rentals} rental(s)`} color={C.blue} bg={C.blueLt} />}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.muted} />
              </View>
              {car.missing.length > 0 && (
                <View style={{ backgroundColor: C.orangeLt, paddingHorizontal: 12, paddingVertical: 8 }}>
                  <Text style={{ color: C.orange, fontSize: 12, fontWeight: "700" }}>
                    {t("rental.fleet.missing", { count: car.missing.length, defaultValue: `${car.missing.length} thing(s) to add before review` })}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
