import { useState, useRef } from "react";
import { useLocalSearchParams } from "expo-router";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { useTranslation } from "react-i18next";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminNav } from "@/components/admin/AdminNavContext";
import { Toast, ToastHandle } from "@/components/Toast";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { queryKeys } from "@/lib/queryKeys";

type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled" | "taken" | "ticket_ready" | "delivered";

// Maps backend error messages to i18n keys
const BACKEND_ERROR_KEYS: Record<string, string> = {
  "This action is unauthorized.":           "adminBookings.noPermission",
  "No station assigned to your account.":   "adminBookings.noStation",
  "You can only manage bookings for your assigned station.": "adminBookings.wrongStation",
  "You can only manage bookings for your assigned city.":    "adminBookings.wrongStation",
};

export default function AdminBookingsScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { isSuperAdmin } = useAdminNav();
  const { status: initialStatus } = useLocalSearchParams<{ status?: string }>();
  const [filter, setFilter] = useState<"all" | BookingStatus>(
    (initialStatus as BookingStatus) ?? "all"
  );
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const toastRef = useRef<ToastHandle>(null);

  const TABS: { key: "all" | BookingStatus; label: string }[] = [
    { key: "all",          label: t("adminBookings.tabAll") },
    { key: "pending",      label: `⏳ ${t("adminBookings.tabPending")}` },
    { key: "taken",        label: `📋 ${t("adminBookings.tabTaken")}` },
    { key: "ticket_ready", label: `🎫 ${t("adminBookings.tabReady")}` },
    { key: "delivered",    label: `✅ ${t("adminBookings.tabDelivered")}` },
  ];

  const STATUS_META: Record<BookingStatus, { label: string; color: string; bg: string; icon: string }> = {
    pending:     { label: t("adminBookings.statusPending"),     color: C.orange,  bg: C.orangeLt, icon: "⏳" },
    confirmed:   { label: t("adminBookings.statusConfirmed"),   color: C.green,   bg: C.greenLt,  icon: "✅" },
    completed:   { label: t("adminBookings.statusCompleted"),   color: C.teal,    bg: C.tealLt,   icon: "🏁" },
    cancelled:   { label: t("adminBookings.statusCancelled"),   color: "#DC2626", bg: "#FEE2E2",  icon: "❌" },
    taken:       { label: t("adminBookings.statusTaken"),       color: C.blue,    bg: C.blueLt,   icon: "📋" },
    ticket_ready:{ label: t("adminBookings.statusTicketReady"), color: C.green,   bg: C.greenLt,  icon: "🎫" },
    delivered:   { label: t("adminBookings.statusDelivered"),   color: C.teal,    bg: C.tealLt,   icon: "✅" },
  };

  const { data: bookings = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: queryKeys.admin.bookings(filter !== "all" ? filter : undefined),
    queryFn: () => {
      const params: any = {};
      if (filter !== "all") params.status = filter;
      return api.get("/admin/bookings", { params }).then(r => r.data ?? []);
    },
    staleTime: 30_000,
  });

  const STATUS_PRIORITY: Record<string, number> = {
    pending: 0, taken: 1, ticket_ready: 2, delivered: 3,
    confirmed: 4, completed: 5, cancelled: 6,
  };

  const list = bookings
    .slice()
    .sort((a: any, b: any) => (STATUS_PRIORITY[a.status] ?? 9) - (STATUS_PRIORITY[b.status] ?? 9));

  const totalServiceFees = bookings.reduce((sum: number, b: any) => sum + (b.service_fee ?? 0), 0);

  function resolveError(e: any): string {
    const data = e?.response?.data ?? {};
    const msg: string = data.message ?? data.error ?? "";
    if (e?.response?.status === 403) {
      const key = BACKEND_ERROR_KEYS[msg];
      return key ? t(key) : t("adminBookings.noPermission");
    }
    const key = BACKEND_ERROR_KEYS[msg];
    if (key) return t(key);
    return t("adminBookings.updateFailed");
  }

  async function doStatusChange(id: number, status: string) {
    setActionLoading(id);
    try {
      await api.patch(`/admin/bookings/${id}`, { status });
      toastRef.current?.show({ message: t("adminBookings.statusDelivered"), type: "success" });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.bookings() });
    } catch (e: any) {
      toastRef.current?.show({ message: resolveError(e), type: "error" });
    } finally {
      setActionLoading(null);
    }
  }

  async function doUploadTicket(id: number) {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setActionLoading(id);
    try {
      const isImage = !asset.mimeType || asset.mimeType.startsWith("image/");
      let uri = asset.uri;
      let mimeType = asset.mimeType ?? "image/jpeg";

      if (isImage) {
        const compressed = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 1200 } }],
          { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
        );
        uri = compressed.uri;
        mimeType = "image/jpeg";
      }

      const form = new FormData();
      if (Platform.OS === "web") {
        const response = await fetch(uri);
        const blob = await response.blob();
        form.append("ticket", blob, asset.fileName ?? "ticket.jpg");
      } else {
        form.append("ticket", {
          uri,
          name: asset.fileName ?? "ticket.jpg",
          type: mimeType,
        } as any);
      }

      await api.post(`/admin/bookings/${id}/ticket`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toastRef.current?.show({ message: t("adminBookings.ticketUploaded"), type: "success" });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.bookings() });
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      const key = BACKEND_ERROR_KEYS[msg ?? ""];
      toastRef.current?.show({
        message: key ? t(key) : t("adminBookings.uploadTicketFailed"),
        type: "error",
      });
    } finally {
      setActionLoading(null);
    }
  }

  function renderActions(b: any) {
    if (b.status === "pending") {
      return (
        <ActionBtn
          label={t("adminBookings.claimBooking")}
          color={C.teal}
          onPress={() => doStatusChange(b.id, "taken")}
          loading={actionLoading === b.id}
        />
      );
    }
    if (b.status === "taken") {
      return (
        <ActionBtn
          label={t("adminBookings.uploadTicket")}
          color={C.blue}
          onPress={() => doUploadTicket(b.id)}
          loading={actionLoading === b.id}
        />
      );
    }
    if (b.status === "ticket_ready") {
      return (
        <ActionBtn
          label={t("adminBookings.markDelivered")}
          color={C.green}
          onPress={() => doStatusChange(b.id, "delivered")}
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
        <AdminHeader title={t("adminBookings.title")} />
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
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
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
              {t("adminBookings.revenueHeader")}
            </Text>
            <Text style={{ color: C.teal, fontWeight: "900", fontSize: 24, marginTop: 4 }}>
              {totalServiceFees.toLocaleString()} RWF
            </Text>
          </View>
        )}

        {isLoading && (
          <ActivityIndicator color={C.teal} style={{ marginTop: 32 }} />
        )}

        {!isLoading && list.length === 0 && (
          <Text style={{ color: C.muted, textAlign: "center", marginTop: 40 }}>
            {t("adminBookings.noBookings")}
          </Text>
        )}

        {!isLoading &&
          list.map((b: any) => {
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
                        {b.trip_departure ? ` · ${t("adminBookings.departs")} ${b.trip_departure}` : ""}
                      </Text>
                    )}
                    {isSuperAdmin && b.confirmed_by_name && (
                      <Text style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
                        {t("adminBookings.confirmedBy")}: {b.confirmed_by_name}
                        {b.confirmed_at ? ` · ${new Date(b.confirmed_at).toLocaleString()}` : ""}
                      </Text>
                    )}
                    {b.quantity > 1 && (
                      <Text style={{ color: C.blue, fontSize: 12, marginTop: 4, fontWeight: "700" }}>
                        🎟 {b.quantity} tickets
                        {Array.isArray(b.passenger_names) && b.passenger_names.filter(Boolean).length > 0
                          ? ` · ${b.passenger_names.filter(Boolean).join(", ")}`
                          : ""}
                      </Text>
                    )}
                    {b.created_at && (
                      <Text style={{ color: C.muted, fontSize: 11, marginTop: 3 }}>
                        🕐 {new Date(b.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
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
      <Toast ref={toastRef} />
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
