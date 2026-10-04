import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StatusBar,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import { useDriverMode } from "@/lib/DriverModeContext";
import {
  DriverStats,
  DriverTrip,
  DriverListing,
  DriverCar,
} from "@/constants/data";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useMe, isDriverRole } from "@/lib/useMe";

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
  const queryClient = useQueryClient();
  const { driverType, setDriverType } = useDriverMode();
  const isRental = driverType === "rental";
  // /driver/* is role-gated; don't fire requests that can only 403.
  const { data: me } = useMe();
  const isDriver = isDriverRole(me);

  const [online, setOnline] = useState(false);
  const [activeZones, setActiveZones] = useState<number[]>([0, 1]);
  const [tab, setTab] = useState<"upcoming" | "history">("upcoming");

  const statsQuery = useQuery({
    queryKey: queryKeys.driver.stats(),
    queryFn: () => api.get("/driver/stats").then(r => r.data as DriverStats),
    staleTime: 2 * 60_000,
    enabled: isDriver,
  });

  const tripsQuery = useQuery({
    queryKey: queryKeys.driver.trips(),
    queryFn: () => api.get("/driver/trips").then(r => r.data as DriverTrip[]),
    staleTime: 60_000,
    enabled: isDriver,
  });

  const carsQuery = useQuery({
    queryKey: queryKeys.driver.cars(),
    queryFn: () => api.get("/driver/cars").then(r => r.data as DriverCar[]),
    staleTime: 5 * 60_000,
    enabled: isDriver && isRental,
  });

  const listingsQuery = useQuery({
    queryKey: queryKeys.driver.listings(),
    queryFn: () => api.get("/driver/listings").then(r => r.data as DriverListing[]),
    staleTime: 5 * 60_000,
    enabled: isDriver && !isRental,
  });

  const stats    = statsQuery.data ?? null;
  const trips    = tripsQuery.data ?? [];
  const driverCars     = carsQuery.data ?? [];
  const driverListings = listingsQuery.data ?? [];

  const isLoading = statsQuery.isLoading || tripsQuery.isLoading;
  const isRefetching = statsQuery.isRefetching || tripsQuery.isRefetching
    || carsQuery.isRefetching || listingsQuery.isRefetching;

  function onRefresh() {
    queryClient.invalidateQueries({ queryKey: queryKeys.driver.stats() });
    queryClient.invalidateQueries({ queryKey: queryKeys.driver.trips() });
    if (isRental) queryClient.invalidateQueries({ queryKey: queryKeys.driver.cars() });
    else queryClient.invalidateQueries({ queryKey: queryKeys.driver.listings() });
  }

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
    <SafeAreaView style={{ flex: 1, backgroundColor: C.teal }}>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />
      <View style={{ flex: 1, backgroundColor: C.bg }}>

      {/* Header */}
      <DriverHeader
        stats={stats}
        loading={isLoading}
        online={online}
        onToggleOnline={() => setOnline((o) => !o)}
      />

      {/* Driver type banner */}
      <DriverTypeBanner isRental={isRental} onChangeType={handleChangeType} />

      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
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
      </View>
    </SafeAreaView>
  );
}
