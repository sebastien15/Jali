import { View, Text, TouchableOpacity } from "react-native";
import { C } from "@/constants/theme";
import type { CARS } from "@/constants/data";

type Car = typeof CARS[number];

interface Props { car: Car; days: number; onPress: () => void; }

const CAR_ICONS: Record<string, string> = {
  SUV: "🚙", Sedan: "🚗", Minivan: "🚐",
};

export function RentalCard({ car, days, onPress }: Props) {
  const total = car.price * days;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: C.white, borderRadius: 20, padding: 16,
        marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.07,
        shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 3,
      }}
    >
      <View style={{ flexDirection: "row", gap: 14, alignItems: "center", marginBottom: 12 }}>
        <View style={{
          backgroundColor: C.greenLt, borderRadius: 14, width: 56, height: 56,
          alignItems: "center", justifyContent: "center",
        }}>
          <Text style={{ fontSize: 30 }}>{CAR_ICONS[car.type] ?? "🚗"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "800", fontSize: 16, color: C.dark }}>{car.name}</Text>
          <Text style={{ color: C.mid, fontSize: 13 }}>{car.type} · {car.seats} seats · ⭐ {car.rating}</Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>{car.plate}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ color: C.green, fontWeight: "900", fontSize: 17 }}>{total.toLocaleString()}</Text>
          <Text style={{ color: C.muted, fontSize: 11, fontWeight: "600" }}>RWF / {days}d</Text>
        </View>
      </View>

      <View style={{
        backgroundColor: C.green, borderRadius: 12, paddingVertical: 12,
        alignItems: "center",
      }}>
        <Text style={{ color: C.white, fontWeight: "900", fontSize: 15 }}>
          Rent for {days} Day{days > 1 ? "s" : ""} — {total.toLocaleString()} RWF →
        </Text>
      </View>
    </TouchableOpacity>
  );
}
