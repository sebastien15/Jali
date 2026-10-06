import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminNav } from "@/components/admin/AdminNavContext";
import { queryKeys } from "@/lib/queryKeys";
import { formatRwf } from "@/lib/fare";
import type { components } from "@/lib/apiSchema";

type Detail = components["schemas"]["AdminRideDetail"];

const EVENT_LABEL: Record<string, string> = {
  requested: "Requested", accepted: "Accepted", declined: "Declined", arrived: "Driver arrived",
  wrong_pin: "Wrong PIN entered", flagged: "Flagged for support", started: "Trip started", completed: "Completed",
  cancelled: "Cancelled", expired: "Expired (no answer)", rated: "Rated", adjusted: "Fare adjusted by admin",
};

/** Admin ride detail: people, timeline, fare breakdown, ratings, adjustment (S10.2) */
export default function AdminRideDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const rideId = Number(id);
  const { user } = useAdminNav();
  const allowed = user?.permissions?.includes("manage-rides") ?? false;
  const queryClient = useQueryClient();
  const [fare, setFare] = useState("");
  const [commission, setCommission] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const { data: ride, isLoading } = useQuery({
    queryKey: queryKeys.admin.ride(rideId),
    queryFn: () => api.get<Detail>(`/admin/rides/${rideId}`).then(r => r.data),
    enabled: allowed,
  });

  async function adjust() {
    setErrors({});
    setBusy(true);
    try {
      const res = await api.post<Detail>(`/admin/rides/${rideId}/adjust`, {
        final_fare: fare ? Number(fare) : null,
        commission: commission ? Number(commission) : null,
        note: note.trim(),
      });
      queryClient.setQueryData(queryKeys.admin.ride(rideId), res.data);
      queryClient.invalidateQueries({ queryKey: ["admin", "rides", "list"] });
      setFare(""); setCommission(""); setNote("");
      Alert.alert("Saved", "The adjustment is recorded in the ride timeline and activity log.");
    } catch (err: any) {
      const fieldErrors = err?.response?.data?.errors;
      if (fieldErrors) setErrors(Object.fromEntries(Object.entries(fieldErrors).map(([k, v]) => [k, (v as string[])[0]])));
      else Alert.alert(err?.response?.data?.message ?? "Could not save");
    } finally {
      setBusy(false);
    }
  }

  if (!allowed) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <AdminHeader title="Ride" showBack />
        <Text style={{ color: C.mid, textAlign: "center", padding: 32 }}>You don't have permission to manage rides.</Text>
      </SafeAreaView>
    );
  }
  if (isLoading || !ride) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <AdminHeader title={`Ride #${rideId}`} showBack />
        <ActivityIndicator color={C.teal} style={{ marginTop: 32 }} />
      </SafeAreaView>
    );
  }

  const f = ride.fare;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <AdminHeader title={`Ride #${ride.id}`} showBack />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 12 }} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={{ fontWeight: "900", fontSize: 16, color: C.dark }}>{ride.status.replace(/_/g, " ")}{ride.flagged ? "  ⚑ flagged" : ""}</Text>
          <Text style={{ color: C.mid, marginTop: 4 }}>{ride.pickup.address ?? "—"}</Text>
          <Text style={{ color: C.mid }}>→ {ride.dropoff.address ?? "—"}</Text>
          {ride.cancel_reason ? <Text style={{ color: C.orange, marginTop: 6 }}>Cancelled by {ride.cancelled_by}: {ride.cancel_reason.replace(/_/g, " ")}</Text> : null}
          {ride.pin_attempts > 0 ? <Text style={{ color: C.orange, marginTop: 4 }}>Wrong PIN attempts: {ride.pin_attempts}</Text> : null}
        </Card>

        <Card>
          <Person label="Rider" person={ride.rider} />
          <Person label="Driver" person={ride.driver} />
          {ride.vehicle ? <Text style={{ color: C.mid, marginTop: 4 }}>{[ride.vehicle.color, ride.vehicle.model].filter(Boolean).join(" ")} · {ride.vehicle.plate}</Text> : null}
        </Card>

        <Card title="Fare">
          <Row label={`Trip ${f.est_distance_km} km · ${f.est_minutes} min · pickup ${f.pickup_km} km`} value="" />
          <Row label="Driver fare" value={formatRwf(f.driver_fare)} />
          <Row label="Jali service fee" value={formatRwf(f.service_fee)} />
          <Row label="Quoted to rider" value={formatRwf(f.quoted_fare)} />
          {f.cancel_fee ? <Row label="Cancellation fee" value={formatRwf(f.cancel_fee)} /> : null}
          <Row label={`Commission (${f.commission_pct}%)`} value={f.commission != null ? formatRwf(f.commission) : "—"} />
          <Row label="Final fare" value={f.final_fare != null ? formatRwf(f.final_fare) : "—"} bold />
          {ride.payment_method ? <Row label="Paid by" value={ride.payment_method === "momo" ? "MoMo" : "Cash"} /> : null}
        </Card>

        <Card title="Timeline">
          {ride.timeline.map((e, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 10, paddingVertical: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, backgroundColor: e.type === "adjusted" || e.type === "wrong_pin" || e.type === "flagged" ? C.orange : C.teal }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", color: C.dark }}>{EVENT_LABEL[e.type] ?? e.type}</Text>
                <Text style={{ color: C.muted, fontSize: 12 }}>
                  {e.at ? new Date(e.at).toLocaleString() : ""}{e.actor ? ` · ${e.actor}` : ""}
                </Text>
                {e.type === "adjusted" && e.payload && !Array.isArray(e.payload) ? (
                  <Text style={{ color: C.mid, fontSize: 12 }}>{String((e.payload as any).note ?? "")}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </Card>

        {ride.ratings.length ? (
          <Card title="Ratings">
            {ride.ratings.map((r, i) => (
              <View key={i} style={{ paddingVertical: 4 }}>
                <Text style={{ color: C.dark, fontWeight: "700" }}>{r.from === "rider" ? "Rider → driver" : "Driver → rider"}: {"★".repeat(r.stars)}{"☆".repeat(5 - r.stars)}</Text>
                {r.tags.length ? <Text style={{ color: C.mid, fontSize: 12 }}>{r.tags.join(", ")}</Text> : null}
                {r.comment ? <Text style={{ color: C.mid, fontSize: 12 }}>“{r.comment}”</Text> : null}
              </View>
            ))}
          </Card>
        ) : null}

        {ride.status === "completed" ? (
          <Card title="Adjust fare">
            <Text style={{ color: C.mid, fontSize: 12, marginBottom: 8 }}>For disputes and refunds. Leave a field empty to keep it. A note is required and is logged.</Text>
            <Field label="New final fare (RWF)" value={fare} onChange={setFare} error={errors.final_fare} numeric />
            <Field label="New commission (RWF)" value={commission} onChange={setCommission} error={errors.commission} numeric />
            <Field label="Note" value={note} onChange={setNote} error={errors.note} multiline />
            <TouchableOpacity onPress={adjust} disabled={busy || note.trim().length < 5 || (!fare && !commission)} accessibilityLabel="Save adjustment"
              style={{ marginTop: 8, backgroundColor: busy || note.trim().length < 5 || (!fare && !commission) ? C.muted : C.teal, borderRadius: 12, paddingVertical: 13, alignItems: "center" }}>
              {busy ? <ActivityIndicator color={C.white} /> : <Text style={{ color: C.white, fontWeight: "800" }}>Save adjustment</Text>}
            </TouchableOpacity>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: C.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border }}>
      {title ? <Text style={{ fontWeight: "900", color: C.dark, marginBottom: 6 }}>{title}</Text> : null}
      {children}
    </View>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, gap: 8 }}>
      <Text style={{ color: bold ? C.dark : C.mid, fontWeight: bold ? "900" : "400", flex: 1 }}>{label}</Text>
      <Text style={{ color: C.dark, fontWeight: bold ? "900" : "600" }}>{value}</Text>
    </View>
  );
}

function Person({ label, person }: { label: string; person: Detail["rider"] }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 4, gap: 8 }}>
      <Text style={{ color: C.muted, width: 52, fontSize: 12, fontWeight: "700" }}>{label}</Text>
      <Text style={{ flex: 1, color: C.dark, fontWeight: "700" }}>{person?.name ?? "—"}</Text>
      {person?.phone ? (
        <TouchableOpacity onPress={() => Linking.openURL(`tel:${person.phone}`)} accessibilityLabel={`Call ${label.toLowerCase()}`}>
          <Ionicons name="call-outline" size={18} color={C.teal} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function Field({ label, value, onChange, error, numeric, multiline }: {
  label: string; value: string; onChange: (v: string) => void; error?: string; numeric?: boolean; multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ color: C.mid, fontSize: 12, fontWeight: "700", marginBottom: 4 }}>{label}</Text>
      <TextInput value={value} onChangeText={v => onChange(numeric ? v.replace(/\D/g, "") : v)} keyboardType={numeric ? "number-pad" : "default"}
        multiline={multiline} accessibilityLabel={label}
        style={{ borderWidth: 1, borderColor: error ? C.orange : C.border, borderRadius: 10, padding: 10, color: C.dark, minHeight: multiline ? 70 : undefined, textAlignVertical: multiline ? "top" : "center" }} />
      {error ? <Text style={{ color: C.orange, fontSize: 12, marginTop: 2 }}>{error}</Text> : null}
    </View>
  );
}
