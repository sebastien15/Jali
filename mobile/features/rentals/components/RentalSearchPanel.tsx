import { useState } from "react";
import { View, Text, ActivityIndicator, ScrollView, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { CAR_TYPES, LABELS, RentalCar, RentalCarType, TRANSMISSIONS, apiError } from "../rentals";
import { RentalDatesPicker, RentalDates, datesToIso, defaultDates } from "./RentalDatesPicker";
import { RentalCarCard } from "./RentalCarCard";
import { Chip, Empty } from "./ui";

/**
 * Car rental search on the Home tab (story S24.1): pick dates, filter, see only
 * cars free for those dates with the owner's total price.
 */
export function RentalSearchPanel() {
  const { t } = useTranslation();
  const [dates, setDates] = useState<RentalDates>(defaultDates);
  const [type, setType] = useState<RentalCarType | null>(null);
  const [transmission, setTransmission] = useState<string | null>(null);
  const [sort, setSort] = useState<"price" | "rating">("price");
  const params = { ...datesToIso(dates), ...(type ? { type } : {}), ...(transmission ? { transmission } : {}), sort };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.rentals.search(params),
    queryFn: () => api.get<{ data: RentalCar[]; cities: string[] }>("/rentals/cars", { params }).then(r => r.data),
    staleTime: 60_000,
  });
  const cars = data?.data ?? [];

  return (
    <View style={{ gap: 12 }}>
      <RentalDatesPicker value={dates} onChange={setDates} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Chip label={t("rental.filter.all", "All cars")} on={!type} onPress={() => setType(null)} />
        {CAR_TYPES.map(ct => <Chip key={ct} label={ct} on={type === ct} onPress={() => setType(type === ct ? null : ct)} />)}
      </ScrollView>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {TRANSMISSIONS.map(tr => (
          <Chip key={tr} icon="cog-outline" label={LABELS.transmission[tr]} on={transmission === tr} onPress={() => setTransmission(transmission === tr ? null : tr)} />
        ))}
        <Chip icon="swap-vertical" label={sort === "price" ? t("rental.sort.price", "Cheapest") : t("rental.sort.rating", "Best rated")}
          on={false} onPress={() => setSort(sort === "price" ? "rating" : "price")} />
      </View>
      <Text style={{ color: C.mid, fontSize: 12 }}>{t("rental.noFees", "No Jali fees — prices are set by car owners.")}</Text>

      {isLoading ? <ActivityIndicator color={C.teal} style={{ marginTop: 24 }} /> : error ? (
        <View style={{ alignItems: "center", paddingVertical: 24 }}>
          <Text style={{ color: C.orange, fontWeight: "700", textAlign: "center" }}>{apiError(error, t("rental.search.error", "Could not load cars."))}</Text>
          <TouchableOpacity onPress={() => refetch()} style={{ marginTop: 12, backgroundColor: C.teal, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 }}>
            <Text style={{ color: C.white, fontWeight: "800" }}>{t("home.retry", "Retry")}</Text>
          </TouchableOpacity>
        </View>
      ) : cars.length === 0 ? (
        <Empty icon="car-outline" title={t("rental.search.none", "No cars free for these dates")}
          text={t("rental.search.noneHint", "Try other dates or remove a filter.")} />
      ) : (
        <View>
          <Text style={{ fontWeight: "800", fontSize: 15, color: C.dark, marginBottom: 10 }}>
            {t("rental.search.count", { count: cars.length, defaultValue: `${cars.length} car${cars.length > 1 ? "s" : ""} available` })}
          </Text>
          {cars.map(car => (
            <RentalCarCard key={car.id} car={car}
              onPress={() => router.push({ pathname: "/rental/car/[id]", params: { id: String(car.id), ...datesToIso(dates) } } as any)} />
          ))}
        </View>
      )}
    </View>
  );
}
