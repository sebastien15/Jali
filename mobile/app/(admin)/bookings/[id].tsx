import { useRef, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import AdminHeader from "@/components/admin/AdminHeader";
import { Toast, ToastHandle } from "@/components/Toast";
import { queryKeys } from "@/lib/queryKeys";
import { formatYmd } from "@/lib/date";
import {
  resolveBookingError, statusChangeMessage, changeBookingStatus, pickAndUploadTicket,
  invalidateAfterBookingChange,
} from "@/lib/adminBookings";

const STATUS_META: Record<string, { key: string; color: string; bg: string }> = {
  pending:      { key: "adminBookings.statusPending",     color: C.orange, bg: C.orangeLt },
  taken:        { key: "adminBookings.statusTaken",       color: C.blue,   bg: C.blueLt },
  ticket_ready: { key: "adminBookings.statusTicketReady", color: C.green,  bg: C.greenLt },
  delivered:    { key: "adminBookings.statusDelivered",   color: C.teal,   bg: C.tealLt },
  cancelled:    { key: "adminBookings.statusCancelled",   color: C.muted,  bg: C.bg },
};

export default function AdminBookingDetailScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const toastRef = useRef<ToastHandle>(null);
  const [saving, setSaving] = useState(false);

  // No GET /admin/bookings/{id}: read the station's list and pick the booking.
  const { data: booking, isLoading } = useQuery({
    queryKey: queryKeys.admin.booking(id!),
    queryFn: () =>
      api.get("/admin/bookings").then(r => {
        const found = (r.data as any[]).find(b => String(b.id) === id);
        return found ?? null;
      }),
    staleTime: 30_000,
    initialData: () => {
      // Seed from any already-cached booking list
      for (const [, data] of queryClient.getQueriesData<any[]>({ queryKey: queryKeys.admin.allBookings() })) {
        if (Array.isArray(data)) {
          const found = data.find(b => String(b.id) === id);
          if (found) return found;
        }
      }
      return undefined;
    },
  });

  function refresh() {
    invalidateAfterBookingChange(queryClient);
  }

  async function handleStatus(status: "taken" | "delivered") {
    setSaving(true);
    try {
      await changeBookingStatus(id!, status);
      toastRef.current?.show({ message: statusChangeMessage(status, t), type: "success" });
    } catch (e: any) {
      toastRef.current?.show({ message: resolveBookingError(e, t), type: "error" });
    } finally {
      refresh();
      setSaving(false);
    }
  }

  async function handleUploadTicket() {
    setSaving(true);
    try {
      const uploaded = await pickAndUploadTicket(id!);
      if (uploaded) {
        toastRef.current?.show({ message: t("adminBookings.ticketUploaded"), type: "success" });
        refresh();
      }
    } catch (e: any) {
      toastRef.current?.show({
        message: resolveBookingError(e, t, "adminBookings.uploadTicketFailed"),
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={C.teal} />
      </SafeAreaView>
    );
  }

  const meta = STATUS_META[booking?.status] ?? STATUS_META.pending;
  const total = booking?.total ?? (Number(booking?.price ?? 0) + Number(booking?.service_fee ?? 0));

  let action: { label: string; color: string; onPress: () => void } | null = null;
  if (booking?.status === "pending") {
    action = { label: t("adminBookings.claimBooking"), color: C.teal, onPress: () => handleStatus("taken") };
  } else if (booking?.status === "taken") {
    action = { label: t("adminBookings.uploadTicket"), color: C.blue, onPress: handleUploadTicket };
  } else if (booking?.status === "ticket_ready") {
    action = { label: t("adminBookings.markDelivered"), color: C.green, onPress: () => handleStatus("delivered") };
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />

      <AdminHeader title={`${t("adminBookings.booking")} #${booking?.id ?? id}`} showBack />

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {!booking ? (
          <Text style={{ color: C.muted, textAlign: "center", marginTop: 40 }}>
            {t("adminBookings.notFound")}
          </Text>
        ) : (
          <>
            {/* Details card */}
            <View style={{
              backgroundColor: C.white, borderRadius: 20, padding: 16, marginBottom: 12,
              shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 3,
            }}>
              <Row label={t("adminBookings.status")}>
                <View style={{ backgroundColor: meta.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: meta.color, fontWeight: "700", fontSize: 13 }}>
                    {t(meta.key)}
                  </Text>
                </View>
              </Row>
              <Row label={t("adminBookings.trip")}      value={booking.title} />
              <Row label={t("adminBookings.route")}     value={booking.sub} />
              {!!booking.travel_date && (
                <Row label={t("adminBookings.travelDate")} value={formatYmd(booking.travel_date, i18n.language)} />
              )}
              {(booking.quantity ?? 1) > 1 && (
                <Row label={t("adminBookings.tickets")} value={String(booking.quantity)} />
              )}
              <Row label={t("adminBookings.passenger")} value={booking.user_name} />
              <Row label={t("adminBookings.email")}     value={booking.user_email} />
              <Row label={t("adminBookings.price")}     value={`${Number(total).toLocaleString()} RWF`} />
            </View>

            {/* Ticket preview once uploaded */}
            {!!booking.ticket_photo_url && (
              <Image
                source={{ uri: booking.ticket_photo_url }}
                style={{ width: "100%", height: 240, borderRadius: 16, marginBottom: 12, backgroundColor: C.white }}
                resizeMode="contain"
              />
            )}

            {/* Next step in the claim → upload ticket → deliver flow */}
            {action && (
              <TouchableOpacity
                onPress={action.onPress} disabled={saving}
                style={{ backgroundColor: action.color, borderRadius: 16, paddingVertical: 16, alignItems: "center", marginBottom: 12 }}
              >
                {saving
                  ? <ActivityIndicator color={C.white} />
                  : <Text style={{ color: C.white, fontWeight: "900", fontSize: 16 }}>{action.label}</Text>
                }
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
      <Toast ref={toastRef} />
    </SafeAreaView>
  );
}

function Row({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.border }}>
      <Text style={{ color: C.muted, fontSize: 13 }}>{label}</Text>
      {children ?? <Text style={{ color: C.dark, fontWeight: "600", fontSize: 13, flex: 1, textAlign: "right" }}>{value ?? "—"}</Text>}
    </View>
  );
}
