import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "@/constants/theme";

export type TripDeparture = {
  id: number;
  departure_time: string;
  estimated_arrival_time: string;
};

export type TripResult = {
  id: number; // agency_route_id
  agency_id: number;
  agency_name: string;
  agency_rating: number;
  agency_ratings_count: number;
  from: { id: number; name: string; city: string };
  to: { id: number; name: string; city: string };
  price: number;
  total_seats: number;
  duration_mins: number;
  departures: TripDeparture[];
};

type Props = {
  trip: TripResult;
  onSelectDeparture: (departure: TripDeparture) => void;
  timeFilterMins?: number; // filter out departures before this minute-of-day
};

export function TripCard({ trip, onSelectDeparture, timeFilterMins }: Props) {
  const price = Number(trip.price);

  const visibleDepartures = timeFilterMins != null
    ? trip.departures.filter(d => {
        const [h, m] = d.departure_time.split(":").map(Number);
        return h * 60 + m >= timeFilterMins;
      })
    : trip.departures;

  if (visibleDepartures.length === 0) return null;

  return (
    <View style={{
      backgroundColor: C.white,
      borderRadius: 20,
      padding: 16,
      marginBottom: 12,
      shadowColor: "#000",
      shadowOpacity: 0.07,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    }}>
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View style={{ backgroundColor: C.blueLt, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, alignItems: "center" }}>
            <Text style={{ color: C.blue, fontWeight: "900", fontSize: 17 }}>{price.toLocaleString()}</Text>
            <Text style={{ color: C.blue, fontWeight: "600", fontSize: 10 }}>RWF</Text>
          </View>
        </View>
      </View>

      <View style={{ marginBottom: 12 }}>
        <Text style={{ color: C.green, fontWeight: "600", fontSize: 12 }}>No Jali fees</Text>
      </View>

      {/* Departure time chips */}
      <Text style={{ color: C.muted, fontSize: 11, fontWeight: "700", marginBottom: 8, letterSpacing: 0.5, textTransform: "uppercase" }}>
        Select departure
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {visibleDepartures.map(dep => (
            <TouchableOpacity
              key={dep.id}
              onPress={() => onSelectDeparture(dep)}
              style={{
                backgroundColor: C.blue,
                borderRadius: 10,
                paddingHorizontal: 10,
                paddingVertical: 6,
                alignItems: "center",
                minWidth: 56,
              }}
            >
              <Text style={{ color: C.yellow, fontWeight: "900", fontSize: 13 }}>{dep.departure_time}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

    </View>
  );
}
