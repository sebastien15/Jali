import { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, Image, Modal, ActivityIndicator, StatusBar, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { formatRwf } from "@/lib/fare";
import { parsePlace } from "@/lib/places";
import type { components } from "@/lib/apiSchema";

type NearbyDriver = components["schemas"]["NearbyDriver"];
type VehicleClass = components["schemas"]["VehicleClass"];
type NearbyResponse = { trip: { distance_km: number; est_minutes: number }; drivers: NearbyDriver[] };
type Sort = "closest" | "cheapest" | "topRated";

const CLASSES: (VehicleClass | null)[] = [null, "moto", "car", "comfort", "van"];
const CLASS_ICON: Record<VehicleClass, React.ComponentProps<typeof Ionicons>["name"]> = {
  moto: "bicycle-outline", car: "car-outline", comfort: "car-sport-outline", van: "bus-outline",
};

/** Nearby drivers, each with their own price for this trip — story S3.2 */
export default function NearbyDriversScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ pickup: string; destination: string }>();
  const pickup = parsePlace(params.pickup);
  const destination = parsePlace(params.destination);
  const [sort, setSort] = useState<Sort>("closest");
  const [vehicleClass, setVehicleClass] = useState<VehicleClass | null>(null);
  const [selected, setSelected] = useState<NearbyDriver | null>(null);

  const query = pickup && destination ? {
    lat: pickup.lat, lng: pickup.lng, dest_lat: destination.lat, dest_lng: destination.lng,
    ...(vehicleClass ? { class: vehicleClass } : {}),
  } : null;

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: queryKeys.rides.nearby(query),
    queryFn: () => api.get<NearbyResponse>("/rides/nearby", { params: query }).then(r => r.data),
    enabled: !!query,
    refetchInterval: 15_000,
  });

  const drivers = useMemo(() => {
    const list = [...(data?.drivers ?? [])];
    if (sort === "cheapest") list.sort((a, b) => a.quote - b.quote || a.eta_min - b.eta_min);
    if (sort === "topRated") list.sort((a, b) => b.rating - a.rating || a.quote - b.quote);
    return list;
  }, [data, sort]);

  const missingTrip = !pickup || !destination;
  useEffect(() => { if (missingTrip) router.replace("/ride"); }, [missingTrip]);
  if (!pickup || !destination) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />
      <View style={{ backgroundColor: C.white, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Back">
            <Ionicons name="arrow-back" size={24} color={C.dark} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontWeight: "900", fontSize: 17, color: C.dark }}>{destination.name}</Text>
            <Text numberOfLines={1} style={{ color: C.muted, fontSize: 12 }}>
              {pickup.name}{data ? ` · ${t("ride.nearby.tripInfo", { km: data.trip.distance_km, min: data.trip.est_minutes })}` : ""}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          {(["closest", "cheapest", "topRated"] as Sort[]).map(s => (
            <Chip key={s} label={t(`ride.nearby.${s}`)} active={sort === s} onPress={() => setSort(s)} />
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          {CLASSES.map(c => (
            <Chip key={c ?? "all"} label={t(`ride.nearby.${c ?? "all"}`)} icon={c ? CLASS_ICON[c] : undefined}
              active={vehicleClass === c} onPress={() => setVehicleClass(c)} small />
          ))}
        </View>
      </View>

      <FlatList
        data={drivers}
        keyExtractor={d => String(d.driver_id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.teal} />}
        ListHeaderComponent={drivers.length ? (
          <Text style={{ color: C.muted, fontSize: 12, marginBottom: 10 }}>{t("ride.nearby.priceNote")}</Text>
        ) : null}
        ListEmptyComponent={isLoading ? (
          <View style={{ gap: 10 }}>
            {[0, 1, 2].map(i => <View key={i} style={{ height: 96, borderRadius: 16, backgroundColor: C.border, opacity: 0.5 }} />)}
          </View>
        ) : (
          <View style={{ alignItems: "center", padding: 32, gap: 10 }}>
            <Ionicons name="car-outline" size={44} color={C.muted} />
            <Text style={{ fontWeight: "800", color: C.dark, fontSize: 16 }}>{t("ride.nearby.empty")}</Text>
            <Text style={{ color: C.mid, textAlign: "center" }}>{t("ride.nearby.emptySub")}</Text>
            <TouchableOpacity onPress={() => refetch()} accessibilityLabel={t("ride.nearby.retry")}
              style={{ backgroundColor: C.teal, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10, marginTop: 6 }}>
              <Text style={{ color: C.white, fontWeight: "800" }}>{t("ride.nearby.retry")}</Text>
            </TouchableOpacity>
          </View>
        )}
        renderItem={({ item, index }) => (
          <TouchableOpacity onPress={() => setSelected(item)} accessibilityLabel={`${item.name}, ${formatRwf(item.quote)}`}
            style={{ backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: "row", gap: 12, alignItems: "center",
              borderWidth: index === 0 ? 2 : 1, borderColor: index === 0 ? C.teal : C.border }}>
            <VehiclePhoto uri={item.vehicle.photo} vehicleClass={item.vehicle.class} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "800", color: C.dark, fontSize: 15 }}>{item.name}</Text>
              <Text numberOfLines={1} style={{ color: C.mid, fontSize: 12, marginTop: 1 }}>
                {item.vehicle.model}{item.vehicle.color ? ` · ${item.vehicle.color}` : ""}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 }}>
                <Text style={{ color: C.dark, fontSize: 12, fontWeight: "700" }}>★ {item.rating.toFixed(1)}</Text>
                <Text style={{ color: C.teal, fontSize: 12, fontWeight: "700" }}>{t("ride.nearby.away", { min: item.eta_min })}</Text>
              </View>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontWeight: "900", fontSize: 17, color: C.dark }}>{formatRwf(item.quote)}</Text>
              <Text style={{ color: C.muted, fontSize: 11 }}>{t("ride.nearby.perKm", { price: item.per_km })}</Text>
            </View>
          </TouchableOpacity>
        )}
      />

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setSelected(null)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }}>
          {selected ? (
            <TouchableOpacity activeOpacity={1} style={{ backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 34 }}>
              <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, marginBottom: 14 }} />
              {selected.vehicle.photo ? (
                <Image source={{ uri: selected.vehicle.photo }} style={{ width: "100%", height: 160, borderRadius: 14, backgroundColor: C.bg, marginBottom: 12 }} resizeMode="cover" />
              ) : null}
              <Text style={{ fontWeight: "900", fontSize: 20, color: C.dark }}>{selected.name}</Text>
              <Text style={{ color: C.mid, marginTop: 2 }}>
                ★ {selected.rating.toFixed(1)} · {t("ride.nearby.trips", { count: selected.trips })} · {t("ride.nearby.away", { min: selected.eta_min })}
              </Text>
              <Text style={{ color: C.dark, marginTop: 8 }}>
                {selected.vehicle.model}{selected.vehicle.color ? ` · ${selected.vehicle.color}` : ""} · {t("ride.nearby.seats", { count: selected.vehicle.seats })}
              </Text>
              {selected.vehicle.amenities.length ? (
                <Text style={{ color: C.muted, marginTop: 4 }}>{selected.vehicle.amenities.join(" · ")}</Text>
              ) : null}
              <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 16 }}>
                <Text style={{ color: C.mid }}>{t("ride.nearby.priceNote")}</Text>
              </View>
              <Text style={{ fontWeight: "900", fontSize: 28, color: C.dark, marginTop: 4 }}>{formatRwf(selected.quote)}</Text>
              <RequestButton driver={selected} pickupParam={params.pickup} destinationParam={params.destination} vehicleClass={selected.vehicle.class} />
            </TouchableOpacity>
          ) : null}
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

/** Wired to POST /rides in S3.4 */
function RequestButton({ driver }: { driver: NearbyDriver; pickupParam?: string; destinationParam?: string; vehicleClass: VehicleClass }) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity disabled accessibilityLabel={t("ride.nearby.request", { name: driver.name })}
      style={{ backgroundColor: C.muted, borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 16 }}>
      <Text style={{ color: C.white, fontWeight: "900", fontSize: 16 }}>{t("ride.nearby.request", { name: driver.name })}</Text>
    </TouchableOpacity>
  );
}

function VehiclePhoto({ uri, vehicleClass }: { uri: string | null; vehicleClass: VehicleClass }) {
  return uri ? (
    <Image source={{ uri }} style={{ width: 64, height: 52, borderRadius: 10, backgroundColor: C.bg }} />
  ) : (
    <View style={{ width: 64, height: 52, borderRadius: 10, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name={CLASS_ICON[vehicleClass]} size={26} color={C.mid} />
    </View>
  );
}

function Chip({ label, active, onPress, icon, small }: {
  label: string; active: boolean; onPress: () => void; icon?: React.ComponentProps<typeof Ionicons>["name"]; small?: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress} accessibilityLabel={label} accessibilityState={{ selected: active }}
      style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: small ? 10 : 14, paddingVertical: small ? 6 : 8, borderRadius: 20,
        backgroundColor: active ? C.dark : C.bg }}>
      {icon ? <Ionicons name={icon} size={14} color={active ? C.white : C.mid} /> : null}
      <Text style={{ color: active ? C.white : C.mid, fontWeight: "700", fontSize: small ? 12 : 13 }}>{label}</Text>
    </TouchableOpacity>
  );
}
