import { View, Text, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import { formatRwf } from "@/lib/fare";
import { LABELS, RentalCar, carTitle } from "../rentals";

/** A car in rental search results: cover photo, key facts, price per day and total for the dates */
export function RentalCarCard({ car, onPress }: { car: RentalCar; onPress: () => void }) {
  const { t } = useTranslation();
  const cover = car.photos[0];
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="button" accessibilityLabel={`${car.name}, ${formatRwf(car.price_per_day)} per day`}
      style={{ backgroundColor: C.white, borderRadius: 18, marginBottom: 14, overflow: "hidden",
        shadowColor: C.dark, shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 3 }}>
      {cover ? (
        <Image source={{ uri: cover }} style={{ width: "100%", height: 170, backgroundColor: C.bg }} resizeMode="cover" />
      ) : (
        <View style={{ height: 120, backgroundColor: C.tealLt, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="car-sport" size={48} color={C.teal} />
        </View>
      )}
      {car.photos.length > 1 && (
        <View style={{ position: "absolute", top: 10, right: 10, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name="images-outline" size={12} color={C.white} />
          <Text style={{ color: C.white, fontSize: 11, fontWeight: "700" }}>{car.photos.length}</Text>
        </View>
      )}
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "900", fontSize: 16, color: C.dark }} numberOfLines={1}>{carTitle(car)}</Text>
            <Text style={{ color: C.mid, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
              {car.pickup_address || car.city || car.type}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: C.teal, fontWeight: "900", fontSize: 16 }}>{formatRwf(car.price_per_day)}</Text>
            <Text style={{ color: C.muted, fontSize: 11 }}>{t("rental.perDay", "per day")}</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 10 }}>
          <Fact icon="people-outline" text={`${car.seats}`} />
          {car.transmission && <Fact icon="cog-outline" text={LABELS.transmission[car.transmission] ?? car.transmission} />}
          {car.fuel_type && <Fact icon="water-outline" text={LABELS.fuel[car.fuel_type] ?? car.fuel_type} />}
          {car.trips_count > 0 && <Fact icon="star" text={`${car.rating.toFixed(1)} (${car.trips_count})`} color={C.orange} />}
          {car.delivery_available && <Fact icon="navigate-outline" text={t("rental.delivers", "Delivers")} />}
        </View>
        {car.quote && (
          <View style={{ marginTop: 12, backgroundColor: C.bg, borderRadius: 12, padding: 10, flexDirection: "row", alignItems: "center" }}>
            <Text style={{ flex: 1, color: C.mid, fontSize: 12 }}>
              {t("rental.totalFor", { count: car.quote.days, defaultValue: `Total for ${car.quote.days} day${car.quote.days > 1 ? "s" : ""}` })}
              {car.quote.discount > 0 ? ` · −${car.quote.discount_pct}%` : ""}
            </Text>
            <Text style={{ color: C.dark, fontWeight: "900", fontSize: 15 }}>{formatRwf(car.quote.total)}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function Fact({ icon, text, color = C.mid }: { icon: keyof typeof Ionicons.glyphMap; text: string; color?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={{ color: C.mid, fontSize: 12, fontWeight: "600" }}>{text}</Text>
    </View>
  );
}
