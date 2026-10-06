import { View, Text, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
type PrivateItem = {
  driver: string; from: string; to: string; dep: string;
  price: number; seats: number; rating: number;
};

interface Props { item: PrivateItem; onPress: () => void; }

export function PrivateCard({ item, onPress }: Props) {
  const { t } = useTranslation();
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
          <Text style={{ fontWeight: "800", fontSize: 16, color: C.dark }}>🧑 {item.driver}</Text>
          <Text style={{ color: C.mid, fontSize: 13, marginTop: 2 }}>
            {item.from} → {item.to} · {item.dep}
          </Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>
            {item.seats} {t('components.privateCard.seatsLeft')} · ⭐ {item.rating}
          </Text>
        </View>
        <View style={{ backgroundColor: C.orangeLt, borderRadius: 12, padding: 8, alignItems: "center" }}>
          <Text style={{ color: C.orange, fontWeight: "900", fontSize: 18 }}>{item.price.toLocaleString()}</Text>
          <Text style={{ color: C.orange, fontWeight: "600", fontSize: 10 }}>RWF</Text>
        </View>
      </View>

      <View style={{
        backgroundColor: C.orange, borderRadius: 12, paddingVertical: 12,
        alignItems: "center",
      }}>
        <Text style={{ color: C.white, fontWeight: "900", fontSize: 15 }}>
          {t('components.privateCard.bookSeat')} →
        </Text>
      </View>
    </TouchableOpacity>
  );
}
