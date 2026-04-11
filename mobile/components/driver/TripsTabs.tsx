import { View, Text, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import { DriverTrip } from "@/constants/data";

interface Props {
  upcoming: DriverTrip[];
  history: DriverTrip[];
  tab: "upcoming" | "history";
  onTabChange: (tab: "upcoming" | "history") => void;
}

export function TripsTabs({ upcoming, history, tab, onTabChange }: Props) {
  const { t } = useTranslation();

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: C.white,
        borderRadius: 14,
        padding: 4,
        marginBottom: 14,
      }}
    >
      {(["upcoming", "history"] as const).map((tabKey) => (
        <TouchableOpacity
          key={tabKey}
          onPress={() => onTabChange(tabKey)}
          style={{
            flex: 1,
            paddingVertical: 10,
            borderRadius: 12,
            alignItems: "center",
            backgroundColor: tab === tabKey ? C.teal : "transparent",
          }}
        >
          <Text
            style={{
              fontWeight: "800",
              fontSize: 13,
              textTransform: "capitalize",
              color: tab === tabKey ? C.white : C.mid,
            }}
          >
            {tabKey === "upcoming"
              ? t("drive.upcomingCount", { count: upcoming.length })
              : t("drive.historyCount", { count: history.length })}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function TripsEmptyState({ tab }: { tab: "upcoming" | "history" }) {
  const { t } = useTranslation();

  return (
    <View style={{ alignItems: "center", paddingVertical: 32 }}>
      <Text style={{ fontSize: 36 }}>{tab === "upcoming" ? "🛣️" : "📋"}</Text>
      <Text
        style={{
          color: C.muted,
          fontWeight: "700",
          fontSize: 14,
          marginTop: 8,
        }}
      >
        {tab === "upcoming"
          ? t("drive.noUpcomingRides")
          : t("drive.noTripHistory")}
      </Text>
    </View>
  );
}

export function TripRow({ trip }: { trip: DriverTrip }) {
  const { t } = useTranslation();
  const isUpcoming = trip.status === "upcoming";

  return (
    <View
      style={{
        backgroundColor: C.white,
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
        borderLeftWidth: 4,
        borderLeftColor: isUpcoming
          ? C.teal
          : trip.status === "cancelled"
            ? C.orange
            : C.muted,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "800", fontSize: 14, color: C.dark }}>
          {trip.from} → {trip.to}
        </Text>
        <Text style={{ color: C.mid, fontSize: 12, marginTop: 2 }}>
          {trip.date} · {trip.dep} · {trip.pax} {t("drive.pax")}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ color: C.teal, fontWeight: "900", fontSize: 15 }}>
          {trip.earning.toLocaleString()} RWF
        </Text>
        {isUpcoming && (
          <View
            style={{
              backgroundColor: C.tealLt,
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 2,
              marginTop: 4,
            }}
          >
            <Text style={{ color: C.teal, fontSize: 11, fontWeight: "700" }}>
              {t("drive.upcoming")}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
