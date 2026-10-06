import { View, Text, TouchableOpacity, Image, ActivityIndicator, FlatList, RefreshControl } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { formatRwf } from "@/lib/fare";
import { RentalBooking, STATUS_META, formatWhen } from "../rentals";
import { Badge, Empty } from "./ui";

/** My car rentals in the Trips tab (story S24.4) */
export function RentalHistory() {
  const { t, i18n } = useTranslation();
  const { data = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.rentals.bookings(),
    queryFn: () => api.get<{ data: RentalBooking[] }>("/rentals/bookings").then(r => r.data.data),
  });

  if (isLoading) return <ActivityIndicator color={C.teal} style={{ marginTop: 32 }} />;

  return (
    <FlatList
      data={data}
      keyExtractor={b => String(b.id)}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      ListEmptyComponent={<Empty icon="car-outline" title={t("rental.history.none", "No car rentals yet")} text={t("rental.history.noneHint", "Rent a car from the Home tab.")} />}
      renderItem={({ item: b }) => {
        const meta = STATUS_META[b.status];
        return (
          <TouchableOpacity onPress={() => router.push({ pathname: "/rental/[id]", params: { id: String(b.id) } } as any)}
            style={{ backgroundColor: C.white, borderRadius: 16, padding: 12, marginBottom: 10, flexDirection: "row", gap: 12, alignItems: "center" }}>
            {b.car?.photo ? <Image source={{ uri: b.car.photo }} style={{ width: 70, height: 54, borderRadius: 10, backgroundColor: C.bg }} />
              : <View style={{ width: 70, height: 54, borderRadius: 10, backgroundColor: C.tealLt, alignItems: "center", justifyContent: "center" }}><Ionicons name="car-sport" size={24} color={C.teal} /></View>}
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontWeight: "800", color: C.dark }} numberOfLines={1}>{b.car?.name}</Text>
              <Text style={{ color: C.mid, fontSize: 12 }}>{formatWhen(b.start_at, i18n.language)} → {formatWhen(b.end_at, i18n.language)}</Text>
              <Badge label={meta.label} color={meta.color} bg={meta.bg} />
            </View>
            <Text style={{ fontWeight: "900", color: C.dark }}>{formatRwf(b.final_total ?? b.total)}</Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}
