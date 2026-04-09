import { View, Text, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import type { BUSES } from "@/constants/data";

type Bus = typeof BUSES[number];

interface Props { bus: Bus; onPress: () => void; }

export function BusCard({ bus, onPress }: Props) {
  const { t } = useTranslation();
  const seatColor = bus.seats <= 4 ? C.orange : bus.seats <= 8 ? C.yellow : C.green;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: C.white, borderRadius: 20, padding: 16,
        marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.07,
        shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 3,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
        <View>
          <Text style={{ fontWeight: "800", fontSize: 16, color: C.dark }}>{bus.agency}</Text>
          <Text style={{ color: C.mid, fontSize: 13, marginTop: 2 }}>{bus.from} → {bus.to}</Text>
        </View>
        <View style={{ backgroundColor: C.blueLt, borderRadius: 12, padding: 8, alignItems: "center" }}>
          <Text style={{ color: C.blue, fontWeight: "900", fontSize: 18 }}>{bus.price.toLocaleString()}</Text>
          <Text style={{ color: C.blue, fontWeight: "600", fontSize: 10 }}>RWF</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <View style={{ flexDirection: "row", gap: 14 }}>
          <Text style={{ color: C.mid, fontWeight: "700", fontSize: 13 }}>🕐 {bus.dep} – {bus.arr}</Text>
          <Text style={{ color: C.mid, fontWeight: "700", fontSize: 13 }}>⭐ {bus.rating}</Text>
        </View>
        <Text style={{ color: seatColor, fontWeight: "800", fontSize: 12 }}>{bus.seats} {t('components.busCard.seatsLeft')}</Text>
      </View>

      <View style={{
        backgroundColor: C.blue, borderRadius: 12, paddingVertical: 12,
        alignItems: "center",
      }}>
        <Text style={{ color: C.yellow, fontWeight: "900", fontSize: 15 }}>
          {t('components.busCard.bookNow')} — {(bus.price + 200).toLocaleString()} RWF →
        </Text>
      </View>
    </TouchableOpacity>
  );
}
