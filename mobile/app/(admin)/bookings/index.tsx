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
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { useTranslation } from "react-i18next";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminNav } from "@/components/admin/AdminNavContext";

type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled" | "taken" | "ticket_ready" | "delivered";

const STATUS_META: Record<
  BookingStatus,
  { label: string; color: string; bg: string; icon: string }
> = {
  pending: { label: "Pending", color: C.orange, bg: C.orangeLt, icon: "⏳" },
  confirmed: { label: "Confirmed", color: C.green, bg: C.greenLt, icon: "✅" },
  completed: { label: "Completed", color: C.teal, bg: C.tealLt, icon: "🏁" },
  cancelled: { label: "Cancelled", color: "#DC2626", bg: "#FEE2E2", icon: "❌" },
  taken: { label: "Taken", color: C.blue, bg: C.blueLt, icon: "📋" },
  ticket_ready: { label: "Ticket Ready", color: C.green, bg: C.greenLt, icon: "🎫" },
  delivered: { label: "Delivered", color: C.teal, bg: C.tealLt, icon: "✅" },
};

const TABS: { key: "all" | BookingStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

export default function AdminBookingsScreen() {
  const { t } = useTranslation();
  const { isSuperAdmin } = useAdminNav();
  const [filter, setFilter] = useState<"all" | BookingStatus>("all");
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const params: any = {};
      // For non-superadmins, don't filter by status (backend already scopes)
      if (isSuperAdmin && filter !== "all") {
        params.status = filter;
      }
      const res = await api.get("/admin/bookings", { params });
      setBookings(res.data);
    } catch {
      setBookings([]);
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, [filter, isSuperAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const list = filter === "all" ? bookings : bookings.filter((b) => b.status === filter);

  // Calculate total service fees (system revenue)
  const totalServiceFees = bookings.reduce((sum, b) => sum + (b.service_fee ?? 0), 0);

  async function handleStatusChange(id: number, status: string) {
    setActionLoading(id);
    try {
      await api.patch(`/admin/bookings/${id}`, { status });
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.message ?? "Failed");
    } finally {
      setActionLoading(null);
    }
  }

  function confirmBooking(id: number) {
    Alert.alert(
      t("adminBookings.confirm"),
      "Confirm this booking?",
      [
        { text: t("common.cancel") ?? "Cancel", style: "cancel" },
        {
          text: t("common.confirm"),
          onPress: () => handleStatusChange(id, "confirmed"),
        },
      ],
    );
  }

  function markComplete(id: number) {
    Alert.alert(
      t("adminBookings.markComplete"),
      "Mark this booking as complete?",
      [
        { text: t("common.cancel") ?? "Cancel", style: "cancel" },
        {
          text: t("common.confirm"),
          onPress: () => handleStatusChange(id, "completed"),
        },
      ],
    );
  }

  function renderActions(b: any) {
    if (b.status === "pending") {
      return (
        <ActionBtn
          label={t("adminBookings.confirm") || "Confirm"}
          color={C.green}
          onPress={() => confirmBooking(b.id)}
          loading={actionLoading === b.id}
        />
      );
    }
    if (b.status === "confirmed") {
      return (
        <ActionBtn
          label={t("adminBookings.markComplete") || "Mark Complete"}
          color={C.teal}
          onPress={() => markComplete(b.id)}
          loading={actionLoading === b.id}
        />
      );
    }
    return null;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />

      <View style={{ backgroundColor: C.teal }}>
        <AdminHeader title={t("adminBookings.title") || t("admin.bookings")} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 16 }}>
            {TABS.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setFilter(tab.key)}
                style={{
                  backgroundColor: filter === tab.key ? C.white : "rgba(255,255,255,0.2)",
                  borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
                }}
              >
                <Text style={{ color: filter === tab.key ? C.teal : C.white, fontWeight: "800", fontSize: 13 }}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
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
        {/* Revenue summary for superadmin */}
        {isSuperAdmin && (
          <View
            style={{
              backgroundColor: C.white,
              borderRadius: 16,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <Text style={{ color: C.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase" }}>
              {t("adminBookings.revenueHeader") || "Total Service Fees"}
            </Text>
            <Text style={{ color: C.teal, fontWeight: "900", fontSize: 24, marginTop: 4 }}>
              {totalServiceFees.toLocaleString()} RWF
            </Text>
          </View>
        )}

        {loading && (
          <ActivityIndicator color={C.teal} style={{ marginTop: 32 }} />
        )}

        {!loading && list.length === 0 && (
          <Text style={{ color: C.muted, textAlign: "center", marginTop: 40 }}>
            {t("adminBookings.noBookings") || "No bookings found."}
          </Text>
        )}

        {!loading &&
          list.map((b) => {
            const meta = STATUS_META[b.status as BookingStatus] ?? STATUS_META.pending;
            return (
              <View
                key={b.id}
                style={{
                  backgroundColor: C.white,
                  borderRadius: 20,
                  padding: 16,
                  marginBottom: 12,
                  shadowColor: "#000",
                  shadowOpacity: 0.07,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 3,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.dark, fontWeight: "800", fontSize: 14 }}>
                      {b.title}
                    </Text>
                    <Text style={{ color: C.mid, fontSize: 12, marginTop: 2 }}>
                      {b.sub}
                    </Text>
                    {b.user_name && (
                      <Text style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>
                        {t("adminBookings.booker")}: {b.user_name}
                        {b.user_phone ? ` · ${b.user_phone}` : ""}
                      </Text>
                    )}
                    {b.agency_name && (
                      <Text style={{ color: C.blue, fontSize: 12, marginTop: 2, fontWeight: "700" }}>
                        🏢 {b.agency_name}
                        {b.trip_departure ? ` · Departs ${b.trip_departure}` : ""}
                      </Text>
                    )}
                    {isSuperAdmin && b.confirmed_by_name && (
                      <Text style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
                        {t("adminBookings.confirmedBy")}: {b.confirmed_by_name}
                        {b.confirmed_at ? ` · ${new Date(b.confirmed_at).toLocaleString()}` : ""}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    <Text style={{ color: C.dark, fontWeight: "800", fontSize: 13 }}>
                      {b.total?.toLocaleString() ?? (b.price + (b.service_fee ?? 0)).toLocaleString()} RWF
                    </Text>
                    <View
                      style={{
                        backgroundColor: meta.bg,
                        borderRadius: 8,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                      }}
                    >
                      <Text style={{ color: meta.color, fontSize: 11, fontWeight: "700" }}>
                        {meta.icon} {meta.label}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={{ marginTop: 12 }}>{renderActions(b)}</View>
              </View>
            );
          })}
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionBtn({
  label,
  color,
  onPress,
  loading,
}: {
  label: string;
  color: string;
  onPress: () => void;
  loading: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      style={{
        backgroundColor: color,
        borderRadius: 12,
        paddingVertical: 10,
        alignItems: "center",
      }}
    >
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Text style={{ color: C.white, fontWeight: "800", fontSize: 13 }}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}
