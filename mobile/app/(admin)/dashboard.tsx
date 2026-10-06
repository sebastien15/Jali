import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { useTranslation } from "react-i18next";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminNav } from "@/components/admin/AdminNavContext";
import { queryKeys } from "@/lib/queryKeys";

type NavTile = {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  route: string;
  color: string;
  superadminOnly?: boolean;
};

export default function AdminDashboard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user, isSuperAdmin } = useAdminNav();
  const canManageLocations = user?.permissions?.includes("manage-locations") ?? false;
  const canManageAgencies = user?.permissions?.includes("manage-agencies") ?? false;
  const canVerifyDrivers = user?.permissions?.includes("verify-drivers") ?? false;

  const earningsQuery = useQuery({
    queryKey: queryKeys.admin.analytics.earnings(),
    queryFn: () => api.get("/analytics/earnings").then(r => r.data.data ?? null),
    staleTime: 5 * 60_000,
  });

  const bookingStatsQuery = useQuery({
    queryKey: queryKeys.admin.analytics.bookings(),
    queryFn: () => api.get("/analytics/bookings").then(r => r.data.data ?? null),
    staleTime: 5 * 60_000,
  });

  const earnings     = earningsQuery.data ?? null;
  const bookingStats = bookingStatsQuery.data ?? null;

  const isLoading    = earningsQuery.isLoading || bookingStatsQuery.isLoading;
  const isRefetching = earningsQuery.isRefetching || bookingStatsQuery.isRefetching;

  function onRefresh() {
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.analytics.earnings() });
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.analytics.bookings() });
  }

  const tiles: NavTile[] = [
    // Bookings — all admins
    { label: "Bookings", icon: "calendar-outline" as const, route: "/(admin)/bookings", color: C.teal },
    // Profile — all admins
    { label: t("admin.profile"), icon: "person-outline" as const, route: "/(admin)/profile", color: C.blue },
    // Analytics — all admins
    { label: "Analytics", icon: "bar-chart-outline" as const, route: "/(admin)/analytics", color: C.green },
    // Superadmin-only
    ...(isSuperAdmin ? [
      { label: t("admin.users"), icon: "people-outline" as const, route: "/(admin)/users", color: C.blue },
      { label: t("admin.stations"), icon: "location-outline" as const, route: "/(admin)/stations", color: C.orange },
      { label: t("admin.logs"), icon: "time-outline" as const, route: "/(admin)/logs", color: C.purple },
      { label: "Roles", icon: "shield-outline" as const, route: "/(admin)/roles", color: C.teal },
      { label: "Ride pricing", icon: "pricetags-outline" as const, route: "/(admin)/settings/rides", color: C.orange },
    ] : []),
    // Driver applications — verify-drivers
    ...(canVerifyDrivers ? [
      { label: "Drivers", icon: "id-card-outline" as const, route: "/(admin)/drivers", color: C.green },
    ] : []),
    // Locations (bus stops) — superadmin or manage-locations
    ...(isSuperAdmin || canManageLocations ? [
      { label: "Bus Stops", icon: "bus-outline" as const, route: "/(admin)/locations", color: C.teal },
    ] : []),
    // Agencies — all admins with permission (limited view for non-superadmin)
    ...(canManageAgencies ? [
      { label: "Agencies", icon: "business-outline" as const, route: "/(admin)/agencies", color: C.purple },
      ...(isSuperAdmin ? [{ label: "Trips", icon: "train-outline" as const, route: "/(admin)/trips", color: C.blue }] : []),
    ] : []),
  ];

  if (isLoading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: C.bg,
        }}
        edges={["top", "left", "right"]}
      >
        <ActivityIndicator size="large" color={C.teal} />
      </SafeAreaView>
    );
  }

  const bs = bookingStats?.by_status ?? {};

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />

      <AdminHeader title={t("admin.dashboard")} />

      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />
        }
      >
        {/* Earnings summary */}
        {earnings && (
          <View
            style={{
              backgroundColor: C.white,
              borderRadius: 20,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                color: C.muted,
                fontSize: 12,
                fontWeight: "700",
                marginBottom: 12,
              }}
            >
              {t("admin.yourEarnings")}
            </Text>
            <Text
              style={{
                color: C.teal,
                fontWeight: "900",
                fontSize: 28,
                marginBottom: 12,
              }}
            >
              {(earnings.total_earnings ?? 0).toLocaleString()}
              <Text style={{ fontSize: 14, fontWeight: "600", color: C.muted }}>
                {" "}
                RWF
              </Text>
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <MiniStat
                label={t("admin.today")}
                value={earnings.today_earnings ?? 0}
              />
              <MiniStat
                label={t("admin.week")}
                value={earnings.week_earnings ?? 0}
              />
              <MiniStat
                label={t("admin.month")}
                value={earnings.month_earnings ?? 0}
              />
            </View>
          </View>
        )}

        {/* Booking status cards — tap to open bookings filtered by status */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
          <StatusCard label={t("admin.pending")} value={bs.pending ?? 0} color={C.orange} icon="⏳"
            onPress={() => router.push({ pathname: "/(admin)/bookings", params: { status: "pending" } } as any)} />
          <StatusCard label="Taken" value={bs.taken ?? 0} color={C.blue} icon="📋"
            onPress={() => router.push({ pathname: "/(admin)/bookings", params: { status: "taken" } } as any)} />
          <StatusCard label="Ready" value={bs.ticket_ready ?? 0} color={C.green} icon="🎫"
            onPress={() => router.push({ pathname: "/(admin)/bookings", params: { status: "ticket_ready" } } as any)} />
        </View>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
          <StatusCard label="Delivered" value={bs.delivered ?? 0} color={C.teal} icon="✅"
            onPress={() => router.push({ pathname: "/(admin)/bookings", params: { status: "delivered" } } as any)} />
          <StatusCard label="Total" value={bookingStats?.total_bookings ?? 0} color={C.dark} icon="📊"
            onPress={() => router.push("/(admin)/bookings" as any)} />
        </View>

        {/* Nav tiles */}
        <Text
          style={{
            color: C.muted,
            fontWeight: "700",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            marginBottom: 10,
          }}
        >
          {isSuperAdmin ? "Management" : "Station Management"}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {tiles.map((tile) => (
            <TouchableOpacity
              key={tile.label}
              onPress={() => router.push(tile.route as any)}
              style={{
                width: "47%",
                backgroundColor: C.white,
                borderRadius: 20,
                padding: 18,
                shadowColor: "#000",
                shadowOpacity: 0.07,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 2 },
                elevation: 3,
              }}
            >
              <View
                style={{
                  backgroundColor: tile.color + "18",
                  borderRadius: 12,
                  width: 42,
                  height: 42,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 10,
                }}
              >
                <Ionicons name={tile.icon} size={20} color={tile.color} />
              </View>
              <Text style={{ color: C.dark, fontWeight: "800", fontSize: 14 }}>
                {tile.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: C.bg,
        borderRadius: 10,
        padding: 10,
        alignItems: "center",
      }}
    >
      <Text style={{ color: C.teal, fontWeight: "900", fontSize: 16 }}>
        {value.toLocaleString()}
      </Text>
      <Text style={{ color: C.muted, fontSize: 10, fontWeight: "600" }}>
        {label}
      </Text>
    </View>
  );
}

function StatusCard({
  label, value, color, icon, onPress,
}: {
  label: string; value: number; color: string; icon: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flex: 1, backgroundColor: C.white, borderRadius: 16,
        padding: 14, alignItems: "center",
        shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6,
        shadowOffset: { width: 0, height: 1 }, elevation: 2,
      }}
    >
      <Text style={{ fontSize: 20, marginBottom: 4 }}>{icon}</Text>
      <Text style={{ color, fontWeight: "900", fontSize: 20 }}>{value}</Text>
      <Text style={{ color: C.muted, fontSize: 10, fontWeight: "600" }}>{label}</Text>
    </TouchableOpacity>
  );
}
