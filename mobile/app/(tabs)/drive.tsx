import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import { useDriverMode } from "@/lib/DriverModeContext";
import {
  DriverStats,
  DriverTrip,
  DriverListing,
  DriverCar,
} from "@/constants/data";
import api from "@/lib/api";

const ZONES = [
  "Kigali CBD",
  "Nyabugogo",
  "Remera",
  "Kimironko",
  "Gikondo",
  "Kicukiro",
  "Kanombe",
];

export default function DriveScreen() {
  const { t } = useTranslation();
  const { driverType, setDriverType } = useDriverMode();
  const isRental = driverType === "rental";

  function handleChangeType() {
    Alert.alert(t("drive.changeEarningMode"), t("drive.earningQuestion"), [
      {
        text: t("drive.privateSeatDriver"),
        onPress: () => setDriverType("private"),
      },
      {
        text: t("drive.fleetOwner"),
        onPress: () => setDriverType("rental"),
      },
      { text: t("profile.cancel"), style: "cancel" },
    ]);
  }

  const [online, setOnline] = useState(false);
  const [activeZones, setActiveZones] = useState<number[]>([0, 1]);
  const [tab, setTab] = useState<"upcoming" | "history">("upcoming");
  const [stats, setStats] = useState<DriverStats | null>(null);
  const [trips, setTrips] = useState<DriverTrip[]>([]);
  const [driverCars, setDriverCars] = useState<DriverCar[]>([]);
  const [driverListings, setDriverListings] = useState<DriverListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const [statsRes, tripsRes, roleRes] = await Promise.all([
          api.get("/driver/stats"),
          api.get("/driver/trips"),
          isRental ? api.get("/driver/cars") : api.get("/driver/listings"),
        ]);
        setStats(statsRes.data);
        setTrips(tripsRes.data);
        if (isRental) setDriverCars(roleRes.data);
        else setDriverListings(roleRes.data);
      } catch {
        // errors shown via null/empty state
      } finally {
        if (isRefresh) setRefreshing(false);
        else setLoading(false);
      }
    },
    [isRental],
  );

  useEffect(() => {
    load();
  }, [load]);

  function toggleZone(i: number) {
    setActiveZones((z) =>
      z.includes(i) ? z.filter((x) => x !== i) : [...z, i],
    );
  }

  const upcoming = trips.filter((t) => t.status === "upcoming");
  const history = trips.filter((t) => t.status !== "upcoming");
  const shown = tab === "upcoming" ? upcoming : history;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />

      {/* Header */}
      <View
        style={{
          backgroundColor: C.teal,
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 20,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <View>
            <Text
              style={{
                color: "rgba(255,255,255,0.7)",
                fontSize: 13,
                fontWeight: "600",
              }}
            >
              {t("drive.driverMode")}
            </Text>
            <Text style={{ color: C.white, fontWeight: "900", fontSize: 24 }}>
              {t("drive.dashboard")}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <TouchableOpacity
              onPress={() => setOnline((o) => !o)}
              style={{
                backgroundColor: online ? C.green : "rgba(255,255,255,0.2)",
                borderRadius: 14,
                paddingHorizontal: 18,
                paddingVertical: 10,
              }}
            >
              <Text style={{ color: C.white, fontWeight: "800", fontSize: 14 }}>
                {online
                  ? `🟢 ${t("drive.online")}`
                  : `⚫ ${t("drive.offline")}`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/driver/setup")}
              style={{
                backgroundColor: "rgba(255,255,255,0.2)",
                borderRadius: 12,
                width: 40,
                height: 40,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="settings-outline" size={20} color={C.white} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats row */}
        {loading && !stats ? (
          <ActivityIndicator color={C.yellow} />
        ) : (
          <View style={{ flexDirection: "row", gap: 10 }}>
            {[
              {
                v: stats ? stats.todayEarnings.toLocaleString() : "—",
                l: t("drive.todayRwf"),
              },
              { v: `${stats?.todayTrips ?? 0}`, l: t("drive.tripsToday") },
              { v: `${stats?.rating ?? "—"}`, l: `${t("drive.rating")} ⭐` },
            ].map((e, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  backgroundColor: "rgba(255,255,255,0.15)",
                  borderRadius: 14,
                  padding: 12,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ color: C.yellow, fontWeight: "900", fontSize: 17 }}
                >
                  {e.v}
                </Text>
                <Text
                  style={{
                    color: "rgba(255,255,255,0.7)",
                    fontSize: 11,
                    fontWeight: "600",
                  }}
                >
                  {e.l}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Driver type banner */}
      <View
        style={{
          backgroundColor: isRental ? C.blueLt : C.tealLt,
          paddingHorizontal: 16,
          paddingVertical: 10,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons
            name={isRental ? "car-sport-outline" : "people-outline"}
            size={16}
            color={isRental ? C.blue : C.teal}
          />
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: isRental ? C.blue : C.teal,
            }}
          >
            Earning as:{" "}
            {isRental ? "Fleet / Car Rental Owner" : "Private Seat Driver"}
          </Text>
        </View>
        <TouchableOpacity onPress={handleChangeType}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: "800",
              color: C.mid,
              textDecorationLine: "underline",
            }}
          >
            {t("drive.change")}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={C.teal}
          />
        }
      >
        {/* Week summary card */}
        {stats && (
          <View
            style={{
              backgroundColor: C.tealLt,
              borderRadius: 16,
              padding: 16,
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 20,
            }}
          >
            <View>
              <Text style={{ color: C.mid, fontSize: 12, fontWeight: "600" }}>
                {t("drive.thisWeek")}
              </Text>
              <Text style={{ color: C.dark, fontWeight: "900", fontSize: 20 }}>
                {stats.weekEarnings.toLocaleString()} RWF
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ color: C.mid, fontSize: 12, fontWeight: "600" }}>
                {t("drive.trips")}
              </Text>
              <Text style={{ color: C.teal, fontWeight: "900", fontSize: 20 }}>
                {stats.weekTrips}
              </Text>
            </View>
          </View>
        )}

        {/* Role-specific action card */}
        {isRental ? (
          <TouchableOpacity
            onPress={() => router.push("/driver/fleet")}
            style={{
              backgroundColor: C.white,
              borderRadius: 16,
              padding: 16,
              marginBottom: 20,
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              shadowColor: "#000",
              shadowOpacity: 0.05,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2,
              borderLeftWidth: 4,
              borderLeftColor: C.teal,
            }}
          >
            <View
              style={{
                backgroundColor: C.tealLt,
                borderRadius: 12,
                width: 44,
                height: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="car-sport" size={22} color={C.teal} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "800", fontSize: 15, color: C.dark }}>
                {t("drive.myFleet")} ({driverCars.length} cars)
              </Text>
              <Text style={{ color: C.mid, fontSize: 12, marginTop: 2 }}>
                {driverCars.filter((c) => c.status === "available").length}{" "}
                {t("drive.available")} ·{" "}
                {driverCars.filter((c) => c.status === "rented").length}{" "}
                {t("drive.rented")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.muted} />
          </TouchableOpacity>
        ) : (
          <View style={{ marginBottom: 20 }}>
            <TouchableOpacity
              onPress={() => router.push("/driver/listing")}
              style={{
                backgroundColor: C.teal,
                borderRadius: 14,
                padding: 14,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <Ionicons name="add-circle-outline" size={20} color={C.white} />
              <Text style={{ color: C.white, fontWeight: "800", fontSize: 15 }}>
                {t("drive.newTripListing")}
              </Text>
            </TouchableOpacity>

            {driverListings.map((l) => (
              <TouchableOpacity
                key={l.id}
                onPress={() =>
                  router.push({
                    pathname: "/driver/listing",
                    params: { id: String(l.id) },
                  })
                }
                style={{
                  backgroundColor: C.white,
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 8,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  shadowColor: "#000",
                  shadowOpacity: 0.04,
                  shadowRadius: 4,
                  shadowOffset: { width: 0, height: 1 },
                  elevation: 1,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ fontWeight: "800", fontSize: 14, color: C.dark }}
                  >
                    {l.from} → {l.to}
                  </Text>
                  <Text style={{ color: C.mid, fontSize: 12, marginTop: 2 }}>
                    {l.date} · {l.dep} · {l.seats} seats ·{" "}
                    {l.price.toLocaleString()} RWF
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: l.active ? C.greenLt : C.bg,
                    borderRadius: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  }}
                >
                  <Text
                    style={{
                      color: l.active ? C.green : C.muted,
                      fontWeight: "700",
                      fontSize: 11,
                    }}
                  >
                    {l.active ? t("drive.active") : t("drive.paused")}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.muted} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Pickup zones */}
        <Text
          style={{
            fontWeight: "800",
            fontSize: 15,
            color: C.dark,
            marginBottom: 10,
          }}
        >
          {t("drive.myPickupZones")}
        </Text>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 24,
          }}
        >
          {ZONES.map((z, i) => {
            const active = activeZones.includes(i);
            return (
              <TouchableOpacity
                key={i}
                onPress={() => toggleZone(i)}
                style={{
                  backgroundColor: active ? C.teal : C.bg,
                  borderWidth: active ? 0 : 2,
                  borderColor: C.border,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                }}
              >
                <Text
                  style={{
                    color: active ? C.white : C.mid,
                    fontWeight: "700",
                    fontSize: 13,
                  }}
                >
                  {active ? "✓ " : ""}
                  {z}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Trips tabs */}
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
              onPress={() => setTab(tabKey)}
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

        {shown.length === 0 && (
          <View style={{ alignItems: "center", paddingVertical: 32 }}>
            <Text style={{ fontSize: 36 }}>
              {tab === "upcoming" ? "🛣️" : "📋"}
            </Text>
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
        )}

        {shown.map((r) => (
          <TripRow key={r.id} trip={r} t={t} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function TripRow({
  trip,
  t,
}: {
  trip: DriverTrip;
  t: (key: string) => string;
}) {
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
