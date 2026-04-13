import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import { TripCard, TripResult } from "@/components/TripCard";
import { StationObj } from "@/components/StationPicker";

interface Props {
  trips: TripResult[];
  loading: boolean;
  error: string | null;
  isFiltered: boolean;
  from: StationObj | null;
  to: StationObj | null;
  todaySelected: boolean;
  timeSet: boolean;
  selectedDate: Date;
  onPress: (trip: TripResult) => void;
  onRetry: () => void;
}

export function BusResults({
  trips, loading, error, isFiltered, from, to,
  todaySelected, timeSet, selectedDate, onPress, onRetry,
}: Props) {
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

  const afterTimeLabel = todaySelected && timeSet
    ? ` · After ${selectedDate.toLocaleTimeString("en-RW", { hour: "2-digit", minute: "2-digit" })}`
    : "";

  return (
    <>
      {isFiltered ? (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontWeight: "800", fontSize: 15, color: C.dark }}>
            {trips.length} {trips.length === 1 ? "trip" : "trips"}
          </Text>
          <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
            {from?.name ?? ""}{to ? ` → ${to.name}` : ""}{afterTimeLabel}
          </Text>
        </View>
      ) : (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontWeight: "900", fontSize: 16, color: C.dark }}>Available trips</Text>
          <Text style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>
            Select terminals above to filter by route
          </Text>
        </View>
      )}

      {trips.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 40 }}>
          <Text style={{ fontSize: 40 }}>🚌</Text>
          <Text style={{ color: C.muted, fontWeight: "700", fontSize: 14, marginTop: 8 }}>
            {isFiltered ? "No trips found for this route" : "No trips available right now"}
          </Text>
        </View>
      ) : (
        trips.map(trip => (
          <TripCard key={trip.id} trip={trip} onPress={() => onPress(trip)} />
        ))
      )}
    </>
  );
}
