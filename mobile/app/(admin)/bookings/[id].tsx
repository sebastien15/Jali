import { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, Alert, TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import AdminHeader from "@/components/admin/AdminHeader";
import { queryKeys } from "@/lib/queryKeys";

const STATUS_COLOR: Record<string, string> = {
  pending: C.orange, confirmed: C.green, completed: C.muted,
};
const STATUS_BG: Record<string, string> = {
  pending: C.orangeLt, confirmed: C.greenLt, completed: C.bg,
};

export default function AdminBookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [ticketUrl, setTicketUrl] = useState("");

  const { data: booking, isLoading } = useQuery({
    queryKey: queryKeys.admin.bookings(id),
    queryFn: () =>
      api.get("/admin/bookings").then(r => {
        const found = (r.data as any[]).find(b => String(b.id) === id);
        return found ?? null;
      }),
    staleTime: 30_000,
    initialData: () => {
      // Try to seed from any already-cached booking list
      for (const [, data] of queryClient.getQueriesData<any[]>({ queryKey: queryKeys.admin.allBookings() })) {
        if (Array.isArray(data)) {
          const found = data.find(b => String(b.id) === id);
          if (found) return found;
        }
      }
      return undefined;
    },
  });

  // Sync ticket URL when booking loads
  useEffect(() => {
    if (booking) setTicketUrl(booking.ticket_photo_url ?? "");
  }, [booking]);

  async function handleConfirm() {
    setSaving(true);
    try {
      await api.patch(`/admin/bookings/${id}`, { status: "confirmed" });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.allBookings() });
    } catch {
      Alert.alert("Error", "Could not confirm booking.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveTicket() {
    if (!ticketUrl.trim()) return;
    setSaving(true);
    try {
      await api.patch(`/admin/bookings/${id}`, { ticket_photo_url: ticketUrl.trim() });
      Alert.alert("Saved", "Ticket URL saved.");
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.allBookings() });
    } catch {
      Alert.alert("Error", "Could not save ticket URL.");
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />

      <AdminHeader title={`Booking #${booking?.id}`} showBack />

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Details card */}
        <View style={{
          backgroundColor: C.white, borderRadius: 20, padding: 16, marginBottom: 12,
          shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 3,
        }}>
          <Row label="Status">
            <View style={{ backgroundColor: STATUS_BG[booking?.status], borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: STATUS_COLOR[booking?.status], fontWeight: "700", fontSize: 13, textTransform: "capitalize" }}>
                {booking?.status}
              </Text>
            </View>
          </Row>
          <Row label="Trip"      value={booking?.title} />
          <Row label="Route"     value={booking?.sub} />
          <Row label="Passenger" value={booking?.user_name} />
          <Row label="Email"     value={booking?.user_email} />
          <Row label="Price"     value={`${(booking?.price + (booking?.service_fee ?? 0)).toLocaleString()} RWF`} />
        </View>

        {/* Confirm */}
        {booking?.status === "pending" && (
          <TouchableOpacity
            onPress={handleConfirm} disabled={saving}
            style={{ backgroundColor: C.green, borderRadius: 16, paddingVertical: 16, alignItems: "center", marginBottom: 12 }}
          >
            {saving
              ? <ActivityIndicator color={C.white} />
              : <Text style={{ color: C.white, fontWeight: "900", fontSize: 16 }}>Confirm Booking</Text>
            }
          </TouchableOpacity>
        )}

        {/* Ticket URL */}
        <View style={{
          backgroundColor: C.white, borderRadius: 20, padding: 16,
          shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 3,
        }}>
          <Text style={{ color: C.dark, fontWeight: "800", fontSize: 15, marginBottom: 6 }}>Ticket Photo URL</Text>
          <Text style={{ color: C.muted, fontSize: 12, marginBottom: 10 }}>
            Upload to Firebase Storage and paste the URL. Passenger will see it in their Trips screen.
          </Text>
          <TextInput
            value={ticketUrl} onChangeText={setTicketUrl}
            placeholder="https://firebasestorage..."
            placeholderTextColor={C.muted} autoCapitalize="none"
            style={{
              backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 14,
              paddingVertical: 13, fontSize: 13, color: C.dark,
              borderWidth: 1.5, borderColor: C.border, marginBottom: 12,
            }}
          />
          <TouchableOpacity
            onPress={handleSaveTicket} disabled={saving || !ticketUrl.trim()}
            style={{ backgroundColor: ticketUrl.trim() ? C.teal : C.border, borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
          >
            <Text style={{ color: C.white, fontWeight: "800", fontSize: 14 }}>Save Ticket URL</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
