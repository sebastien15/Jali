import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StatusBar,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
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

// Sub-components
import { DriverHeader } from "@/components/driver/DriverHeader";
import { DriverTypeBanner } from "@/components/driver/DriverTypeBanner";
import { WeekSummaryCard } from "@/components/driver/WeekSummaryCard";
import {
  FleetActionCard,
  PrivateListingsCard,
} from "@/components/driver/DriverActionCard";
import { PickupZones } from "@/components/driver/PickupZones";
import {
  TripsTabs,
  TripsEmptyState,
  TripRow,
} from "@/components/driver/TripsTabs";

export default function DriveScreen() {
  const { t } = useTranslation();
  const { driverType, setDriverType } = useDriverMode();
  const isRental = driverType === "rental";

  // State
  const [online, setOnline] = useState(false);
  const [activeZones, setActiveZones] = useState<number[]>([0, 1]);
  const [tab, setTab] = useState<"upcoming" | "history">("upcoming");
  const [stats, setStats] = useState<DriverStats | null>(null);
  const [trips, setTrips] = useState<DriverTrip[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [driverCars, setDriverCars] = useState<DriverCar[]>([]);
  const [driverListings, setDriverListings] = useState<DriverListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Data loader
  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const [statsRes, tripsRes, roleRes, bookingsRes] = await Promise.all([
          api.get("/driver/stats"),
          api.get("/driver/trips"),
          isRental ? api.get("/driver/cars") : api.get("/driver/listings"),
          api.get("/bookings"),
        ]);
        setStats(statsRes.data);
        setTrips(tripsRes.data);
        setBookings(bookingsRes.data);
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
      <DriverHeader
        stats={stats}
        loading={loading}
        online={online}
        onToggleOnline={() => setOnline((o) => !o)}
      />

      {/* Driver type banner */}
      <DriverTypeBanner isRental={isRental} onChangeType={handleChangeType} />

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
        {stats && <WeekSummaryCard stats={stats} />}

        {/* Role-specific action card */}
        {isRental ? (
          <FleetActionCard driverCars={driverCars} />
        ) : (
          <PrivateListingsCard driverListings={driverListings} />
        )}

        {/* Pickup zones */}
        <PickupZones activeZones={activeZones} onToggleZone={toggleZone} />

        {/* Trips tabs */}
        <TripsTabs
          upcoming={upcoming}
          history={history}
          tab={tab}
          onTabChange={setTab}
        />

        {shown.length === 0 ? (
          <TripsEmptyState tab={tab} />
        ) : (
          shown.map((r) => <TripRow key={r.id} trip={r} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
