import { View, Text, Image, ScrollView, TouchableOpacity, Linking } from "react-native";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import { fuelLabel, formatWhen } from "../rentals";
import { Row, Section } from "./ui";

type Record_ = { odometer_km: number; fuel_level: number; notes: string | null; photos: string[]; at: string };

/** Handover or return record: odometer, fuel, notes and photos */
export function RentalRecordView({ title, record }: { title: string; record: Record_ }) {
  const { t, i18n } = useTranslation();
  return (
    <Section title={`${title} · ${formatWhen(record.at, i18n.language)}`}>
      <Row label={t("rental.odometer", "Odometer")} value={`${record.odometer_km.toLocaleString("en-US")} km`} />
      <Row label={t("rental.fuelLevel", "Fuel")} value={fuelLabel(record.fuel_level)} />
      {!!record.notes && <Text style={{ color: C.dark, marginTop: 6 }}>{record.notes}</Text>}
      {record.photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 10 }}>
          {record.photos.map((uri, i) => (
            <TouchableOpacity key={uri + i} onPress={() => Linking.openURL(uri)} accessibilityLabel={`${title} photo ${i + 1}`}>
              <Image source={{ uri }} style={{ width: 110, height: 82, borderRadius: 10, backgroundColor: C.bg }} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </Section>
  );
}
