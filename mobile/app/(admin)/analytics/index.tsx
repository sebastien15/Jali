import {
  View,
  Text,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import AdminHeader from "@/components/admin/AdminHeader";
import { queryKeys } from "@/lib/queryKeys";
import { useAdminNav } from "@/components/admin/AdminNavContext";
import { useTranslation } from "react-i18next";

export default function AdminAnalyticsScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { isSuperAdmin } = useAdminNav();

  const revenueQuery = useQuery({
    queryKey: queryKeys.admin.analytics.revenue(),
    queryFn: () => api.get("/analytics/revenue").then(r => r.data.data),
    staleTime: 5 * 60_000,
  });
  const bookingsQuery = useQuery({
    queryKey: queryKeys.admin.analytics.bookings(),
    queryFn: () => api.get("/analytics/bookings").then(r => r.data.data),
    staleTime: 5 * 60_000,
  });
  const earningsQuery = useQuery({
    queryKey: queryKeys.admin.analytics.earnings(),
    queryFn: () => api.get("/analytics/earnings").then(r => r.data.data),
    staleTime: 5 * 60_000,
  });

  const revenue  = revenueQuery.data;
  const bookings = bookingsQuery.data;
  const earnings = earningsQuery.data;

  const isLoading = revenueQuery.isLoading || bookingsQuery.isLoading || earningsQuery.isLoading;
  const isRefetching = revenueQuery.isRefetching || bookingsQuery.isRefetching || earningsQuery.isRefetching;

  function onRefresh() {
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.analytics.revenue() });
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.analytics.bookings() });
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.analytics.earnings() });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />

      <AdminHeader title="Analytics" />

      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />
        }
      >
        {isLoading ? (
          <ActivityIndicator color={C.teal} style={{ marginTop: 32 }} />
        ) : (
          <>
            {/* ── Earnings (50% split) ── */}
            <Label text="Your Earnings (50% of Service Fee)" />
            <View
              style={{
                backgroundColor: C.white,
                borderRadius: 20,
                padding: 16,
                marginBottom: 20,
              }}
            >
              <Text style={{ color: C.teal, fontWeight: "900", fontSize: 28 }}>
                {(earnings?.total_earnings ?? 0).toLocaleString()}
                <Text
                  style={{ fontSize: 14, fontWeight: "600", color: C.muted }}
                >
                  {" "}
                  RWF
                </Text>
              </Text>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <EarningBar
                  label="Today"
                  value={earnings?.today_earnings ?? 0}
                />
                <EarningBar label="Week" value={earnings?.week_earnings ?? 0} />
                <EarningBar
                  label="Month"
                  value={earnings?.month_earnings ?? 0}
                />
              </View>
              <Text style={{ color: C.muted, fontSize: 11, marginTop: 8 }}>
                {earnings?.delivered_count ?? 0} delivered bookings
              </Text>
            </View>

            {/* ── Revenue Breakdown ── */}
            <Label text="Revenue Breakdown" />
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
              <BigCard
                label="Total Paid"
                value={(revenue?.total_user_paid ?? 0).toLocaleString()}
                color={C.teal}
              />
              <BigCard
                label="Service Fee"
                value={(revenue?.total_service_fee ?? 0).toLocaleString()}
                color={C.green}
              />
            </View>
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 24 }}>
              <BigCard
                label="Platform 50%"
                value={(revenue?.platform_share ?? 0).toLocaleString()}
                color={C.blue}
              />
              <BigCard
                label="Admin 50%"
                value={(revenue?.admin_share ?? 0).toLocaleString()}
                color={C.orange}
              />
            </View>

            {/* ── Booking Statuses (4) ── */}
            <Label text="Bookings by Status" />
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
              <StatusBadge
                label="Pending"
                value={bookings?.by_status?.pending ?? 0}
                color={C.orange}
                icon="⏳"
              />
              <StatusBadge
                label="Taken"
                value={bookings?.by_status?.taken ?? 0}
                color={C.blue}
                icon="📋"
              />
            </View>
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 24 }}>
              <StatusBadge
                label="Ready"
                value={bookings?.by_status?.ticket_ready ?? 0}
                color={C.green}
                icon="🎫"
              />
              <StatusBadge
                label="Delivered"
                value={bookings?.by_status?.delivered ?? 0}
                color={C.teal}
                icon="✅"
              />
              <StatusBadge
                label={t("adminBookings.statusCancelled")}
                value={bookings?.by_status?.cancelled ?? 0}
                color={C.muted}
                icon="❌"
              />
            </View>

            {/* ── By Type — superadmin only ── */}
            {isSuperAdmin && (
              <>
                <Label text="By Transport Type" />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {/* Bus-company trips are booked as type "trip"; "bus" is the legacy type */}
                  <StatCard
                    label={t("admin.bus")}
                    value={(bookings?.by_type?.trip ?? 0) + (bookings?.by_type?.bus ?? 0)}
                    color={C.blue}
                  />
                  <StatCard label={t("admin.rental")}  value={bookings?.by_type?.rental ?? 0}  color={C.teal} />
                  <StatCard label={t("admin.private")} value={bookings?.by_type?.private ?? 0} color={C.orange} />
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Label({ text }: { text: string }) {
  return (
    <Text
      style={{
        color: C.muted,
        fontSize: 11,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 10,
      }}
    >
      {text}
    </Text>
  );
}

function EarningBar({ label, value }: { label: string; value: number }) {
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
      <Text style={{ color: C.teal, fontWeight: "900", fontSize: 15 }}>
        {value.toLocaleString()}
      </Text>
      <Text style={{ color: C.muted, fontSize: 10, fontWeight: "600" }}>
        {label}
      </Text>
    </View>
  );
}

function BigCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: C.white,
        borderRadius: 16,
        padding: 14,
        shadowColor: "#000",
        shadowOpacity: 0.07,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
      }}
    >
      <Text
        style={{
          color: C.muted,
          fontSize: 11,
          fontWeight: "600",
          marginBottom: 4,
        }}
      >
        {label}
      </Text>
      <Text style={{ color, fontWeight: "900", fontSize: 18 }}>{value}</Text>
      <Text style={{ color: C.muted, fontSize: 11 }}>RWF</Text>
    </View>
  );
}

function StatusBadge({
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
        shadowColor: "#000",
        shadowOpacity: 0.07,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
      }}
    >
      <Text style={{ fontSize: 18, marginBottom: 2 }}>{icon}</Text>
      <Text style={{ color, fontWeight: "900", fontSize: 20 }}>{value}</Text>
      <Text style={{ color: C.muted, fontSize: 10, fontWeight: "600" }}>
        {label}
      </Text>
    </View>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: C.white,
        borderRadius: 16,
        padding: 14,
        shadowColor: "#000",
        shadowOpacity: 0.07,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
      }}
    >
      <Text style={{ color, fontWeight: "900", fontSize: 24 }}>{value}</Text>
      <Text
        style={{
          color: C.muted,
          fontSize: 11,
          fontWeight: "600",
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
