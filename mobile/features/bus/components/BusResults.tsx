import { useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, Animated, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import { TripCard, TripResult, TripDeparture } from "./TripCard";
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
  timeFilterMins?: number;
  onSelectDeparture: (trip: TripResult, departure: TripDeparture) => void;
  onRetry: () => void;
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
}

export function BusResults({
  trips, loading, error, isFiltered, from, to,
  todaySelected, timeSet, selectedDate, timeFilterMins, onSelectDeparture, onRetry,
  fetchNextPage, hasNextPage, isFetchingNextPage,
}: Props) {
  const { t } = useTranslation();

  if (loading) return <BusResultsSkeleton />;

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
            {trips.length} {trips.length === 1 ? "agency" : "agencies"}
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
        <>
          {trips.map(trip => (
            <TripCard
              key={trip.id}
              trip={trip}
              timeFilterMins={timeFilterMins}
              onSelectDeparture={(dep) => onSelectDeparture(trip, dep)}
            />
          ))}
          {hasNextPage && !isFetchingNextPage && (
            <TouchableOpacity
              onPress={fetchNextPage}
              style={{ paddingVertical: 14, alignItems: "center" }}
            >
              <Text style={{ color: C.blue, fontWeight: "700", fontSize: 14 }}>Load more…</Text>
            </TouchableOpacity>
          )}
          {isFetchingNextPage && (
            <ActivityIndicator color={C.blue} style={{ marginTop: 8, marginBottom: 8 }} />
          )}
        </>
      )}
    </>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────

function SkeletonBox({ width, height, style }: {
  width?: number | `${number}%`;
  height: number;
  style?: object;
}) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 750, useNativeDriver: true }),
      ])
    ).start();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { backgroundColor: C.border, borderRadius: 6, height, opacity },
        width ? { width } : { alignSelf: "stretch" },
        style,
      ]}
    />
  );
}

function TripCardSkeleton() {
  return (
    <View style={{
      backgroundColor: C.white, borderRadius: 20, padding: 16, marginBottom: 12,
      shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 12,
      shadowOffset: { width: 0, height: 2 }, elevation: 3,
    }}>
      {/* Agency name + price badge */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
        <View style={{ flex: 1, marginRight: 12, gap: 8 }}>
          <SkeletonBox height={16} width="55%" />
          <SkeletonBox height={12} width="75%" />
        </View>
        <SkeletonBox height={52} width={72} style={{ borderRadius: 12 }} />
      </View>

      {/* Times + rating */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
        <SkeletonBox height={12} width="48%" />
        <SkeletonBox height={12} width="18%" />
      </View>

      {/* Book button */}
      <SkeletonBox height={42} style={{ borderRadius: 12 }} />
    </View>
  );
}

function BusResultsSkeleton() {
  return (
    <>
      <View style={{ marginBottom: 12, gap: 8 }}>
        <SkeletonBox height={16} width="35%" />
        <SkeletonBox height={12} width="55%" />
      </View>
      {[0, 1, 2, 3].map(i => <TripCardSkeleton key={i} />)}
    </>
  );
}
