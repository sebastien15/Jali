import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import { RentalCard } from "./RentalCard";

interface Props {
  cars: any[];
  loading: boolean;
  error: string | null;
  days: number;
  onChangeDays: (days: number) => void;
  onPress: (car: any, days: number) => void;
  onRetry: () => void;
}

export function RentalResults({ cars, loading, error, days, onChangeDays, onPress, onRetry }: Props) {
  const { t } = useTranslation();

  if (loading) return <ActivityIndicator color={C.blue} style={{ marginTop: 32 }} />;

  if (error) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 40 }}>
        <Text style={{ fontSize: 40 }}>⚠️</Text>
        <Text style={{ color: C.orange, fontWeight: "700", fontSize: 14, marginTop: 8, textAlign: "center" }}>
          {error}
        </Text>
        <TouchableOpacity
          onPress={onRetry}
          style={{ marginTop: 16, backgroundColor: C.blue, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
        >
          <Text style={{ color: C.white, fontWeight: "800", fontSize: 14 }}>{t('home.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Text style={{ fontWeight: "800", fontSize: 16, color: C.dark }}>
          {cars.length} {t('home.carsInCity')}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <TouchableOpacity
            onPress={() => onChangeDays(Math.max(1, days - 1))}
            style={{ backgroundColor: C.green, borderRadius: 8, width: 28, height: 28, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ color: C.white, fontWeight: "900", fontSize: 18 }}>−</Text>
          </TouchableOpacity>
          <Text style={{ fontWeight: "800", color: C.green, fontSize: 14 }}>{days}d</Text>
          <TouchableOpacity
            onPress={() => onChangeDays(days + 1)}
            style={{ backgroundColor: C.green, borderRadius: 8, width: 28, height: 28, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ color: C.white, fontWeight: "900", fontSize: 18 }}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {cars.map(c => (
        <RentalCard key={c.id} car={c} days={days} onPress={() => onPress(c, days)} />
      ))}
    </>
  );
}
