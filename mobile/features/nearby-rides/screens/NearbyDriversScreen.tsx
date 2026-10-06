import { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, Image, Modal, ActivityIndicator, StatusBar, RefreshControl, Alert, ScrollView, TextInput } from "react-native";
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
import type { components, operations } from "@/lib/apiSchema";
import { DriversMap } from "../components/DriversMap";
import { useFormatPrice } from "@/lib/fx";

type NearbyDriver = components["schemas"]["NearbyDriver"];
type VehicleClass = components["schemas"]["VehicleClass"];
type NearbyResponse = { trip: { distance_km: number; est_minutes: number }; drivers: NearbyDriver[] };
type Sort = "closest" | "cheapest" | "topRated";
type Estimate = operations["estimateRide"]["responses"]["200"]["content"]["application/json"];

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
  const [view, setView] = useState<"list" | "map">("list");
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const fmt = useFormatPrice();

  const query = pickup && destination ? {
    lat: pickup.lat, lng: pickup.lng, dest_lat: destination.lat, dest_lng: destination.lng,
    ...(vehicleClass ? { class: vehicleClass } : {}),
  } : null;

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: queryKeys.rides.nearby(query),
    queryFn: () => api.get<NearbyResponse>("/rides/nearby", { params: query }).then(r => r.data),
    enabled: !!query,
    // S10.4: outside a live service area the API answers 422 — no point polling
    refetchInterval: q => (q.state.error as any)?.response?.status === 422 ? false : 10_000,
    retry: (count, err: any) => err?.response?.status !== 422 && count < 2,
  });
  const notServed: string | null = (error as any)?.response?.status === 422 && !(error as any)?.response?.data?.errors
    ? ((error as any).response.data?.message ?? t("ride.nearby.notServed", "Not available here yet."))
    : null;

  // Price range and nearest ETA per class (S3.6)
  const estimate = useQuery({
    queryKey: ["rides", "estimate", pickup?.lat, pickup?.lng, destination?.lat, destination?.lng],
    queryFn: () => api.post<Estimate>("/rides/estimate", {
      pickup: { lat: pickup!.lat, lng: pickup!.lng }, dropoff: { lat: destination!.lat, lng: destination!.lng },
    }).then(r => r.data),
    enabled: !!pickup && !!destination,
    staleTime: 30_000,
  });
  const estimateFor = (c: VehicleClass) => estimate.data?.classes.find(x => x.class === c);

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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 8 }}>
          {CLASSES.map(c => {
            const e = c ? estimateFor(c) : undefined;
            const off = !!c && !!estimate.data && !e?.available;
            const on = vehicleClass === c;
            return (
              <TouchableOpacity key={c ?? "all"} onPress={() => setVehicleClass(c)} disabled={off}
                accessibilityLabel={t(`ride.nearby.${c ?? "all"}`)} accessibilityState={{ selected: on, disabled: off }}
                style={{ minWidth: 82, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14, backgroundColor: on ? C.dark : C.bg, opacity: off ? 0.45 : 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  {c ? <Ionicons name={CLASS_ICON[c]} size={14} color={on ? C.white : C.mid} /> : null}
                  <Text style={{ color: on ? C.white : C.dark, fontWeight: "800", fontSize: 12 }}>{t(`ride.nearby.${c ?? "all"}`)}</Text>
                </View>
                {c && e ? (
                  <Text style={{ color: on ? C.white : C.mid, fontSize: 11, marginTop: 1 }}>
                    {e.available && e.min_quote != null && e.max_quote != null
                      ? `${e.min_quote === e.max_quote ? formatRwf(e.min_quote) : `${formatRwf(e.min_quote)}–${formatRwf(e.max_quote)}`} · ${e.nearest_eta_min} min`
                      : t("ride.nearby.noneNow")}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={{ flexDirection: "row", marginTop: 10, backgroundColor: C.bg, borderRadius: 10, padding: 3 }}>
          {(["list", "map"] as const).map(v => (
            <TouchableOpacity key={v} onPress={() => setView(v)} accessibilityLabel={t(`ride.nearby.view_${v}`)} accessibilityState={{ selected: view === v }}
              style={{ flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, paddingVertical: 7, borderRadius: 8, backgroundColor: view === v ? C.white : "transparent" }}>
              <Ionicons name={v === "list" ? "list" : "map-outline"} size={15} color={C.dark} />
              <Text style={{ fontWeight: "800", color: C.dark, fontSize: 12 }}>{t(`ride.nearby.view_${v}`)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {view === "map" ? (
        <View style={{ flex: 1 }}>
          <DriversMap
            center={{ lat: pickup.lat, lng: pickup.lng }}
            drivers={drivers.map(d => ({ id: d.driver_id, lat: d.approx_location.lat ?? pickup.lat, lng: d.approx_location.lng ?? pickup.lng,
              vehicleClass: d.vehicle.class, label: formatRwf(d.quote) }))}
            onSelect={id => setSelected(drivers.find(d => d.driver_id === id) ?? null)}
          />
        </View>
      ) : (
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
        ) : notServed ? (
          <View style={{ alignItems: "center", padding: 32, gap: 10 }}>
            <Ionicons name="map-outline" size={44} color={C.muted} />
            <Text style={{ fontWeight: "800", color: C.dark, fontSize: 16, textAlign: "center" }}>{notServed}</Text>
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
              {fmt(item.quote) !== formatRwf(item.quote) ? <Text style={{ color: C.muted, fontSize: 11 }}>{fmt(item.quote).slice(formatRwf(item.quote).length).trim()}</Text> : null}
              <Text style={{ color: C.muted, fontSize: 11 }}>{t("ride.nearby.perKm", { price: item.per_km })}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
      )}

      {drivers.length > 1 ? (
        <View style={{ backgroundColor: C.white, padding: 12, borderTopWidth: 1, borderTopColor: C.border }}>
          <TouchableOpacity onPress={() => setBroadcastOpen(true)} accessibilityLabel={t("ride.broadcast.button")}
            style={{ backgroundColor: C.teal, borderRadius: 14, paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}>
            <Ionicons name="flash" size={18} color={C.white} />
            <Text style={{ color: C.white, fontWeight: "900", fontSize: 15 }}>{t("ride.broadcast.button")}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <BroadcastSheet visible={broadcastOpen} onClose={() => setBroadcastOpen(false)} pickupParam={params.pickup} destinationParam={params.destination}
        vehicleClass={vehicleClass} suggested={drivers.length ? Math.max(...drivers.map(d => d.quote)) : null} />

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
              <Text style={{ fontWeight: "900", fontSize: 28, color: C.dark, marginTop: 4 }}>{fmt(selected.quote)}</Text>
              <RequestButton driver={selected} pickupParam={params.pickup} destinationParam={params.destination} vehicleClass={selected.vehicle.class} />
            </TouchableOpacity>
          ) : null}
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

/** Send to the nearest drivers under my maximum price; first to accept wins (story S3.5). */
function BroadcastSheet({ visible, onClose, pickupParam, destinationParam, vehicleClass, suggested }: {
  visible: boolean; onClose: () => void; pickupParam?: string; destinationParam?: string; vehicleClass: VehicleClass | null; suggested: number | null;
}) {
  const { t } = useTranslation();
  const [max, setMax] = useState("");
  const [payment, setPayment] = useState<"cash" | "momo">("cash");
  const [sending, setSending] = useState(false);
  useEffect(() => { if (visible && suggested && !max) setMax(String(suggested)); }, [visible, suggested]);

  async function send() {
    const pickup = parsePlace(pickupParam);
    const destination = parsePlace(destinationParam);
    if (!pickup || !destination) return;
    setSending(true);
    try {
      const res = await api.post<{ id: number }>("/rides", {
        mode: "broadcast", vehicle_class: vehicleClass, max_fare: max ? Number(max) : null, payment_method: payment,
        pickup: { lat: pickup.lat, lng: pickup.lng, address: pickup.address || pickup.name },
        dropoff: { lat: destination.lat, lng: destination.lng, address: destination.address || destination.name },
      });
      onClose();
      router.push(`/ride/${res.data.id}` as any);
    } catch (err: any) {
      const errors = err?.response?.data?.errors;
      Alert.alert(errors ? (Object.values(errors)[0] as string[])[0] : err?.response?.data?.message ?? "Error");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 34, gap: 10 }}>
          <Text style={{ fontWeight: "900", fontSize: 18, color: C.dark }}>{t("ride.broadcast.title")}</Text>
          <Text style={{ color: C.mid }}>{t("ride.broadcast.sub")}</Text>
          <Text style={{ color: C.mid, fontWeight: "700", fontSize: 12 }}>{t("ride.broadcast.max")}</Text>
          <TextInput value={max} onChangeText={v => setMax(v.replace(/\D/g, ""))} keyboardType="number-pad" accessibilityLabel={t("ride.broadcast.max")}
            placeholder={t("ride.broadcast.noMax")} placeholderTextColor={C.muted}
            style={{ borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, fontSize: 18, fontWeight: "800", color: C.dark }} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["cash", "momo"] as const).map(m => (
              <TouchableOpacity key={m} onPress={() => setPayment(m)} accessibilityLabel={t(`ride.driverTrip.${m}`)} accessibilityState={{ selected: payment === m }}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center", backgroundColor: payment === m ? C.dark : C.bg }}>
                <Text style={{ color: payment === m ? C.white : C.mid, fontWeight: "800" }}>{t(`ride.driverTrip.${m}`)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={send} disabled={sending} accessibilityLabel={t("ride.broadcast.send")}
            style={{ backgroundColor: C.dark, borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 4 }}>
            {sending ? <ActivityIndicator color={C.white} /> : <Text style={{ color: C.white, fontWeight: "900", fontSize: 16 }}>{t("ride.broadcast.send")}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} accessibilityLabel={t("common.close")} style={{ alignItems: "center", paddingVertical: 6 }}>
            <Text style={{ color: C.mid, fontWeight: "700" }}>{t("common.close")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/** Request this driver (story S3.4): price is computed and locked by the server. */
function RequestButton({ driver, pickupParam, destinationParam }: {
  driver: NearbyDriver; pickupParam?: string; destinationParam?: string; vehicleClass: VehicleClass;
}) {
  const { t } = useTranslation();
  const [payment, setPayment] = useState<"cash" | "momo">("cash");
  const [sending, setSending] = useState(false);
  const pickup = parsePlace(pickupParam);
  const destination = parsePlace(destinationParam);

  async function request() {
    if (!pickup || !destination) return;
    setSending(true);
    try {
      const res = await api.post<{ id: number }>("/rides", {
        mode: "pick", driver_id: driver.driver_id, payment_method: payment,
        pickup: { lat: pickup.lat, lng: pickup.lng, address: pickup.address || pickup.name },
        dropoff: { lat: destination.lat, lng: destination.lng, address: destination.address || destination.name },
      });
      router.push(`/ride/${res.data.id}` as any);
    } catch (err: any) {
      Alert.alert(err?.response?.data?.message ?? "Error");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Text style={{ color: C.mid, fontWeight: "700", fontSize: 12, marginTop: 14, marginBottom: 6 }}>{t("ride.trip.payWith")}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {(["cash", "momo"] as const).map(m => (
          <TouchableOpacity key={m} onPress={() => setPayment(m)} accessibilityLabel={t(`ride.driverTrip.${m}`)} accessibilityState={{ selected: payment === m }}
            style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center", backgroundColor: payment === m ? C.dark : C.bg }}>
            <Text style={{ color: payment === m ? C.white : C.mid, fontWeight: "800" }}>{t(`ride.driverTrip.${m}`)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity onPress={request} disabled={sending} accessibilityLabel={t("ride.nearby.request", { name: driver.name })}
        style={{ backgroundColor: C.dark, borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 14 }}>
        {sending ? <ActivityIndicator color={C.white} />
          : <Text style={{ color: C.white, fontWeight: "900", fontSize: 16 }}>{t("ride.nearby.request", { name: driver.name })}</Text>}
      </TouchableOpacity>
    </>
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
