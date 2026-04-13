import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "@/constants/theme";
import { tripServiceFee } from "@/lib/serviceFee";

export type TripResult = {
  id: number;
  agency_id: number;
  agency_name: string;
  agency_rating: number;
  agency_ratings_count: number;
  from: { id: number; name: string; city: string };
  to: { id: number; name: string; city: string };
  departure_time: string;
  estimated_arrival_time: string;
  price: number;
  total_seats: number;
};

type Props = {
  trip: TripResult;
  onPress: () => void;
};

export function TripCard({ trip, onPress }: Props) {
  const fee = tripServiceFee(trip.price);
  const total = trip.price + fee;
  const ratingLabel =
    trip.agency_rating > 0 ? trip.agency_rating.toFixed(1) : "New";

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: C.white,
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOpacity: 0.07,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
      }}
    >
      {/* Top row: agency + price badge */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={{ fontWeight: "800", fontSize: 16, color: C.dark }}>
            {trip.agency_name}
          </Text>
          <Text style={{ color: C.mid, fontSize: 13, marginTop: 2 }}>
            {trip.from.name ?? trip.from.city} → {trip.to.name ?? trip.to.city}
          </Text>
        </View>
        <View style={{
          backgroundColor: C.blueLt, borderRadius: 12,
          paddingHorizontal: 10, paddingVertical: 8, alignItems: "center",
        }}>
          <Text style={{ color: C.blue, fontWeight: "900", fontSize: 17 }}>
            {trip.price.toLocaleString()}
          </Text>
          <Text style={{ color: C.blue, fontWeight: "600", fontSize: 10 }}>RWF</Text>
        </View>
      </View>

      {/* Middle row: times + rating */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <View style={{ flexDirection: "row", gap: 14 }}>
          <Text style={{ color: C.mid, fontWeight: "700", fontSize: 13 }}>
            🕐 {trip.departure_time} – {trip.estimated_arrival_time}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Ionicons name="star" size={12} color={C.yellow} />
            <Text style={{ color: C.mid, fontWeight: "700", fontSize: 13 }}>{ratingLabel}</Text>
          </View>
        </View>
        <Text style={{ color: C.muted, fontWeight: "600", fontSize: 12 }}>
          +{fee.toLocaleString()} fee
        </Text>
      </View>

      {/* Book Now button */}
      <View style={{
        backgroundColor: C.blue, borderRadius: 12,
        paddingVertical: 12, alignItems: "center",
      }}>
        <Text style={{ color: C.yellow, fontWeight: "900", fontSize: 15 }}>
          Book Now — {total.toLocaleString()} RWF →
        </Text>
      </View>
    </TouchableOpacity>
  );
}
