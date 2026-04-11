import { useState, useEffect, useCallback } from "react";
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
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { useTranslation } from "react-i18next";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminNav } from "@/components/admin/AdminNavContext";

type NavTile = {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  route: string;
  color: string;
  superadminOnly?: boolean;
};

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { user, isSuperAdmin } = useAdminNav();
  const [earnings, setEarnings] = useState<any>(null);
  const [bookingStats, setBookingStats] = useState<any>(null);
  const [adminProfile, setAdminProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [earningsRes, bookingsRes, profileRes] = await Promise.all([
        api.get("/analytics/earnings"),
        api.get("/analytics/bookings"),
        api.get("/admin/profile"),
      ]);
      setEarnings(earningsRes.data.data ?? null);
      setBookingStats(bookingsRes.data.data ?? null);
      setAdminProfile(profileRes.data);
    } catch {
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Debug log
  useEffect(() => {
    console.warn("[Dashboard] User state:", JSON.stringify(user));
    console.warn("[Dashboard] isSuperAdmin:", isSuperAdmin);
  }, [user, isSuperAdmin]);

  const tiles: NavTile[] = isSuperAdmin
    ? [
        {
          label: t("admin.profile"),
          icon: "person-outline",
          route: "/(admin)/profile/index",
          color: C.blue,
        },
        {
          label: t("admin.logs"),
          icon: "time-outline",
          route: "/(admin)/logs/index",
          color: C.purple,
        },
        {
          label: t("admin.users"),
          icon: "people-outline",
          route: "/(admin)/users/index",
          color: C.blue,
        },
      ]
    : [
        {
          label: t("admin.stations"),
          icon: "location-outline",
          route: "/(admin)/stations/index",
          color: C.orange,
        },
      ];

  if (loading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: C.bg,
        }}
      >
        <ActivityIndicator size="large" color={C.teal} />
      </SafeAreaView>
    );
  }

  const bs = bookingStats?.by_status ?? {};

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />

      <AdminHeader title={t("admin.dashboard")} />

      {/* DEBUG */}
      <View
        style={{
          backgroundColor: C.yellow,
          padding: 12,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={{ fontWeight: "900", fontSize: 13, color: C.dark }}>
          User: {user?.name ?? "(null)"}
        </Text>
        <Text style={{ fontWeight: "900", fontSize: 13, color: C.dark }}>
          Role: {user?.roles ?? "(none)"}
        </Text>
        <View
          style={{
            backgroundColor: isSuperAdmin ? "#7C3AED" : C.teal,
            borderRadius: 6,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}
        >
          <Text style={{ color: C.white, fontWeight: "800", fontSize: 12 }}>
            {isSuperAdmin ? "SUPERADMIN" : "ADMIN"}
          </Text>
        </View>
        <Text
          style={{ fontSize: 10, color: C.dark, width: "100%", marginTop: 4 }}
        >
          RAW: {JSON.stringify(user)}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
          />
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

        {/* Booking status cards */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
          <StatusCard
            label={t("admin.pending")}
            value={bs.pending ?? 0}
            color={C.orange}
            icon="⏳"
          />
          <StatusCard
            label="Taken"
            value={bs.taken ?? 0}
            color={C.blue}
            icon="📋"
          />
          <StatusCard
            label="Ready"
            value={bs.ticket_ready ?? 0}
            color={C.green}
            icon="🎫"
          />
        </View>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
          <StatusCard
            label="Delivered"
            value={bs.delivered ?? 0}
            color={C.teal}
            icon="✅"
          />
          <StatusCard
            label="Total"
            value={bookingStats?.total_bookings ?? 0}
            color={C.dark}
            icon="📊"
          />
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
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: C.white,
        borderRadius: 16,
        padding: 14,
        alignItems: "center",
      }}
    >
      <Text style={{ fontSize: 20, marginBottom: 4 }}>{icon}</Text>
      <Text style={{ color, fontWeight: "900", fontSize: 20 }}>{value}</Text>
      <Text style={{ color: C.muted, fontSize: 10, fontWeight: "600" }}>
        {label}
      </Text>
    </View>
  );
}
