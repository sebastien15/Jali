import { useState } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import AdminHeader from "@/components/admin/AdminHeader";
import { queryKeys } from "@/lib/queryKeys";
import { formatRwf } from "@/lib/fare";
import type { components } from "@/lib/apiSchema";

type Hire = components["schemas"]["AdminHireDetail"];

const when = (iso?: string | null) => iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
/** "2026-10-14 09:20" in the phone's local time → ISO */
const toIso = (local: string) => { const d = new Date(local.trim().replace(" ", "T")); return isNaN(d.getTime()) ? null : d.toISOString(); };
const toLocal = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Admin: one hire — timeline, quote, ratings and time corrections (S6.6) */
export default function AdminHireScreen() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const queryClient = useQueryClient();
  const { data: h, isLoading } = useQuery({
    queryKey: queryKeys.admin.hire(id),
    queryFn: () => api.get<Hire>(`/admin/hires/${id}`).then(r => r.data),
  });
  const [editing, setEditing] = useState(false);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [note, setNote] = useState("");

  const correct = useMutation({
    mutationFn: () => {
      const body: Record<string, string> = { note: note.trim() };
      if (checkIn && checkIn !== toLocal(h?.checked_in_at)) { const v = toIso(checkIn); if (!v) throw new Error("Check-in: use YYYY-MM-DD HH:MM"); body.checked_in_at = v; }
      if (checkOut && checkOut !== toLocal(h?.checked_out_at)) { const v = toIso(checkOut); if (!v) throw new Error("Check-out: use YYYY-MM-DD HH:MM"); body.checked_out_at = v; }
      return api.post<Hire>(`/admin/hires/${id}/times`, body).then(r => r.data);
    },
    onSuccess: saved => {
      queryClient.setQueryData(queryKeys.admin.hire(id), saved);
      queryClient.invalidateQueries({ queryKey: ["admin", "hires", "list"] });
      setEditing(false); setNote("");
      Alert.alert("Saved ✓", "Times corrected and logged.");
    },
    onError: (err: any) => Alert.alert("Check the times", err?.message && !err?.response ? err.message
      : String(Object.values(err?.response?.data?.errors ?? {})[0] ?? err?.response?.data?.message ?? "Could not save.")),
  });

  if (isLoading || !h) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <AdminHeader title={`Hire #${id}`} showBack />
      <ActivityIndicator color={C.teal} style={{ marginTop: 40 }} />
    </SafeAreaView>
  );
  const canCorrect = h.status === "started" || h.status === "completed";
  const q = h.quote;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <AdminHeader title={`Hire #${id}`} showBack />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Card title={h.status.replace(/_/g, " ")}>
          <Line label="Start" value={when(h.start_at)} />
          <Line label="End (booked)" value={when(h.end_at)} />
          <Line label="Booked" value={`${h.duration.value} ${h.duration.type} · ${h.trip_type.replace(/_/g, " ")} · ${h.transmission}`} />
          <Line label="Pickup" value={h.pickup.address ?? `${h.pickup.lat}, ${h.pickup.lng}`} />
          {!!h.car_description && <Line label="Car" value={h.car_description} />}
          {!!h.notes && <Line label="Notes" value={h.notes} />}
          {!!h.cancel_reason && <Line label="Cancelled" value={`${h.cancelled_by ?? ""} · ${h.cancel_reason}`} />}
        </Card>
        <Card title="People">
          {[["Customer", h.customer], ["Driver", h.driver]].map(([label, p]: any) => (
            <TouchableOpacity key={label} disabled={!p?.phone} onPress={() => Linking.openURL(`tel:${p.phone}`)} accessibilityLabel={`Call ${label}`}>
              <Line label={label} value={p ? `${p.name ?? "—"}${p.phone ? ` · ${p.phone}` : ""}` : "—"} />
            </TouchableOpacity>
          ))}
        </Card>
        <Card title="Price (locked at booking)">
          <Line label="Driver price" value={formatRwf(q.driver_total)} />
          <Line label="Jali fee" value={formatRwf(q.service_fee)} />
          {q.overtime_minutes > 0 && <Line label={`Overtime ${q.overtime_minutes} min`} value={formatRwf(q.overtime_amount)} />}
          <Line label="Total" value={formatRwf(q.final_total ?? q.quoted_total)} bold />
          <Line label={`Commission ${q.commission_pct}%`} value={q.commission != null ? formatRwf(q.commission) : "—"} />
          {q.cancel_fee > 0 && <Line label="Cancel fee" value={formatRwf(q.cancel_fee)} />}
        </Card>
        <Card title="Check-in / check-out">
          <Line label="Checked in" value={when(h.checked_in_at)} />
          <Line label="Checked out" value={when(h.checked_out_at)} />
          {canCorrect && !editing && (
            <TouchableOpacity onPress={() => { setCheckIn(toLocal(h.checked_in_at)); setCheckOut(toLocal(h.checked_out_at)); setEditing(true); }}
              accessibilityLabel="Correct times" style={{ marginTop: 8 }}>
              <Text style={{ color: C.teal, fontWeight: "800" }}>Correct times</Text>
            </TouchableOpacity>
          )}
          {editing && (
            <View style={{ gap: 8, marginTop: 10 }}>
              <Input label="Check-in (YYYY-MM-DD HH:MM)" value={checkIn} onChange={setCheckIn} />
              {h.status === "completed" && <Input label="Check-out (YYYY-MM-DD HH:MM)" value={checkOut} onChange={setCheckOut} />}
              <Input label="Why (required, kept in the log)" value={note} onChange={setNote} multiline />
              <Text style={{ color: C.muted, fontSize: 11 }}>A completed hire's overtime, total and commission are recomputed.</Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity onPress={() => correct.mutate()} disabled={note.trim().length < 5 || correct.isPending} accessibilityLabel="Save correction"
                  style={{ flex: 1, backgroundColor: note.trim().length >= 5 ? C.teal : C.border, borderRadius: 12, paddingVertical: 12, alignItems: "center" }}>
                  {correct.isPending ? <ActivityIndicator color={C.white} /> : <Text style={{ color: C.white, fontWeight: "800" }}>Save</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setEditing(false)} accessibilityLabel="Cancel" style={{ paddingHorizontal: 16, justifyContent: "center" }}>
                  <Text style={{ color: C.mid, fontWeight: "700" }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Card>
        <Card title="Timeline">
          {h.timeline.map((e, i) => (
            <View key={i} style={{ paddingVertical: 4 }}>
              <Text style={{ color: C.dark, fontWeight: "700" }}>{e.type.replace(/[._]/g, " ")} · {when(e.at)}</Text>
              {!!(e.actor || e.note) && <Text style={{ color: C.mid, fontSize: 12 }}>{[e.actor, e.note].filter(Boolean).join(" — ")}</Text>}
            </View>
          ))}
        </Card>
        {h.ratings.length > 0 && (
          <Card title="Ratings">
            {h.ratings.map((r, i) => (
              <Text key={i} style={{ color: C.dark, paddingVertical: 2 }}>
                {r.from}: {"★".repeat(r.stars ?? 0)}{r.tags?.length ? ` · ${r.tags.join(", ")}` : ""}{r.comment ? ` — ${r.comment}` : ""}
              </Text>
            ))}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: C.white, borderRadius: 14, padding: 14 }}>
      <Text style={{ fontWeight: "800", fontSize: 13, color: C.teal, textTransform: "uppercase", marginBottom: 6 }}>{title}</Text>
      {children}
    </View>
  );
}
function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 3 }}>
      <Text style={{ color: C.mid }}>{label}</Text>
      <Text style={{ color: C.dark, fontWeight: bold ? "900" : "600", flexShrink: 1, textAlign: "right" }}>{value}</Text>
    </View>
  );
}
function Input({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  return (
    <View>
      <Text style={{ color: C.mid, fontSize: 11, fontWeight: "700", marginBottom: 4 }}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} multiline={multiline} accessibilityLabel={label}
        style={{ borderWidth: 1.5, borderColor: C.border, borderRadius: 10, padding: 10, color: C.dark, backgroundColor: C.bg, minHeight: multiline ? 70 : undefined }} />
    </View>
  );
}
