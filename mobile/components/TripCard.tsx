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
  from: { id: number; city: string };
  to: { id: number; city: string };
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
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
      }}
    >
      {/* Agency row */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <Text
          style={{
            fontWeight: "900",
            fontSize: 15,
            color: C.dark,
          }}
        >
          {trip.agency_name}
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Ionicons name="star" size={12} color={C.yellow} />
          <Text style={{ color: C.mid, fontSize: 12 }}>
            {trip.agency_rating > 0
              ? trip.agency_rating.toFixed(1)
              : "New"}
            {trip.agency_ratings_count > 0
              ? ` (${trip.agency_ratings_count})`
              : ""}
          </Text>
        </View>
      </View>

      {/* Route */}
      <Text
        style={{
          color: C.mid,
          fontSize: 13,
          marginTop: 4,
        }}
      >
        {trip.from.city} → {trip.to.city}
      </Text>

      {/* Times and Price row */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: 10,
        }}
      >
        <View>
          <Text
            style={{
              color: C.dark,
              fontWeight: "800",
              fontSize: 20,
            }}
          >
            {trip.departure_time}
          </Text>
          <Text style={{ color: C.muted, fontSize: 11 }}>
            Est. {trip.estimated_arrival_time} *
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text
            style={{
              color: C.blue,
              fontWeight: "900",
              fontSize: 16,
            }}
          >
            {trip.price.toLocaleString()} RWF
          </Text>
          <Text style={{ color: C.muted, fontSize: 11 }}>
            +{fee.toLocaleString()} fee
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
