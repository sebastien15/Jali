import { useState, useEffect, useCallback } from "react";
import { useLocalSearchParams } from "expo-router";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { useTranslation } from "react-i18next";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminNav } from "@/components/admin/AdminNavContext";
import { useRef } from "react";
import { Toast, ToastHandle } from "@/components/Toast";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

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
  { key: "all",          label: "All" },
  { key: "pending",      label: "⏳ Pending" },
  { key: "taken",        label: "📋 Taken" },
  { key: "ticket_ready", label: "🎫 Ready" },
  { key: "delivered",    label: "✅ Delivered" },
];

export default function AdminBookingsScreen() {
  const { t } = useTranslation();
  const { isSuperAdmin } = useAdminNav();
  const { status: initialStatus } = useLocalSearchParams<{ status?: string }>();
  const [filter, setFilter] = useState<"all" | BookingStatus>(
    (initialStatus as BookingStatus) ?? "all"
  );
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const toastRef = useRef<ToastHandle>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const params: any = {};
      if (filter !== "all") params.status = filter;
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

  const STATUS_PRIORITY: Record<string, number> = {
    pending: 0,
    taken: 1,
    ticket_ready: 2,
    delivered: 3,
    confirmed: 4,
    completed: 5,
    cancelled: 6,
  };

  const list = (filter === "all" ? bookings : bookings.filter((b) => b.status === filter))
    .slice()
    .sort((a, b) => (STATUS_PRIORITY[a.status] ?? 9) - (STATUS_PRIORITY[b.status] ?? 9));

  // Calculate total service fees (system revenue)
  const totalServiceFees = bookings.reduce((sum, b) => sum + (b.service_fee ?? 0), 0);

  async function doStatusChange(id: number, status: string) {
    console.log(`[Booking] PATCH /admin/bookings/${id} → status: ${status}`);
    setActionLoading(id);
    try {
      const res = await api.patch(`/admin/bookings/${id}`, { status });
      console.log(`[Booking] Success:`, res.data);
      toastRef.current?.show({ message: `Booking updated to ${status.replace("_", " ")}`, type: "success" });
      load();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? "Failed to update booking.";
      console.log(`[Booking] Error:`, e?.response?.status, msg);
      toastRef.current?.show({ message: msg, type: "error" });
    } finally {
      setActionLoading(null);
    }
  }

  function handleStatusChange(id: number, status: string) {
    console.log(`[Booking] button pressed → id=${id} status=${status}`);
    doStatusChange(id, status);
  }

  async function doUploadTicket(id: number) {
    console.log(`[Booking] opening image picker for booking ${id}`);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setActionLoading(id);
    try {
      // Compress images; skip for PDFs and other non-image types
      const isImage = !asset.mimeType || asset.mimeType.startsWith("image/");
      let uri = asset.uri;
      let mimeType = asset.mimeType ?? "image/jpeg";

      if (isImage) {
        const compressed = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 1200 } }], // cap width, height auto-scales
          { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
        );
        uri = compressed.uri;
        mimeType = "image/jpeg";
        console.log(`[Booking] compressed image: ${asset.uri} → ${compressed.uri}`);
      }

      const form = new FormData();
      if (Platform.OS === "web") {
        // On web, fetch the blob URL and append as a real Blob
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

      console.log(`[Booking] ticket uploaded for booking ${id}`);
      toastRef.current?.show({ message: "Ticket uploaded — booking marked ready", type: "success" });
      load();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? "Failed to upload ticket.";
      console.log(`[Booking] upload error:`, e?.response?.status, msg);
      toastRef.current?.show({ message: msg, type: "error" });
    } finally {
      setActionLoading(null);
    }
  }

  function renderActions(b: any) {
    if (b.status === "pending") {
      return (
        <ActionBtn
          label="Claim Booking"
          color={C.teal}
          onPress={() => handleStatusChange(b.id, "taken")}
          loading={actionLoading === b.id}
        />
      );
    }
    if (b.status === "taken") {
      return (
        <ActionBtn
          label="Upload Ticket"
          color={C.blue}
          onPress={() => doUploadTicket(b.id)}
          loading={actionLoading === b.id}
        />
      );
    }
    if (b.status === "ticket_ready") {
      return (
        <ActionBtn
          label="Mark Delivered"
          color={C.green}
          onPress={() => handleStatusChange(b.id, "delivered")}
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
                    {/* Quantity + passenger names */}
                    {b.quantity > 1 && (
                      <Text style={{ color: C.blue, fontSize: 12, marginTop: 4, fontWeight: "700" }}>
                        🎟 {b.quantity} tickets
                        {Array.isArray(b.passenger_names) && b.passenger_names.filter(Boolean).length > 0
                          ? ` · ${b.passenger_names.filter(Boolean).join(", ")}`
                          : ""}
                      </Text>
                    )}
                    {/* Booked at */}
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
