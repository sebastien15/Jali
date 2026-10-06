import { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Alert, ActivityIndicator, TextInput, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminNav } from "@/components/admin/AdminNavContext";
import type { operations } from "@/lib/apiSchema";

type Item = operations["listDriversForReview"]["responses"]["200"]["content"]["application/json"][number];

const REASON: Record<string, string> = { low_rating: "Low rating", high_cancel_rate: "Cancels often" };

/** Drivers needing review: low rating or many cancellations; warn or suspend (story S8.4) */
export default function DriversReviewScreen() {
  const { user } = useAdminNav();
  const allowed = user?.permissions?.includes("verify-drivers") ?? false;
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<{ item: Item; action: "warn" | "suspend" } | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const { data = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["admin", "drivers", "review"],
    queryFn: () => api.get<Item[]>("/admin/drivers/review").then(r => r.data),
    enabled: allowed,
  });

  async function send() {
    if (!target) return;
    setBusy(true);
    try {
      if (target.action === "warn") await api.post(`/admin/drivers/${target.item.user_id}/warn`, { message: text });
      else await api.post(`/admin/drivers/${target.item.user_id}/suspend`, { reason: text });
      setTarget(null);
      setText("");
      queryClient.invalidateQueries({ queryKey: ["admin", "drivers"] });
    } catch (err: any) {
      const errors = err?.response?.data?.errors;
      Alert.alert(errors ? (Object.values(errors)[0] as string[])[0] : err?.response?.data?.message ?? "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <AdminHeader title="Drivers needing review" showBack />
      <FlatList
        data={data}
        keyExtractor={i => String(i.user_id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.teal} />}
        ListEmptyComponent={isLoading ? <ActivityIndicator color={C.teal} /> : (
          <Text style={{ color: C.mid, textAlign: "center", padding: 32 }}>{allowed ? "No driver needs review. 🎉" : "You don't have permission."}</Text>
        )}
        renderItem={({ item }) => (
          <View style={{ backgroundColor: C.white, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border }}>
            <Text style={{ fontWeight: "900", color: C.dark }}>{item.name ?? "—"}</Text>
            <Text style={{ color: C.mid, fontSize: 12 }}>{item.phone ?? ""}</Text>
            <View style={{ flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              {item.reasons.map(r => (
                <Text key={r} style={{ backgroundColor: C.orangeLt, color: C.orange, fontWeight: "800", fontSize: 11, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>{REASON[r] ?? r}</Text>
              ))}
            </View>
            <Text style={{ color: C.dark, marginTop: 6 }}>
              ★ {item.rating.toFixed(1)} ({item.rating_count}) · cancelled {item.cancelled}/{item.accepted} ({item.cancel_pct}%)
            </Text>
            {item.warned_at ? <Text style={{ color: C.muted, fontSize: 12 }}>Warned {new Date(item.warned_at).toLocaleDateString()}</Text> : null}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <TouchableOpacity onPress={() => { setText(""); setTarget({ item, action: "warn" }); }} accessibilityLabel="Warn"
                style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: C.border }}>
                <Text style={{ color: C.dark, fontWeight: "800" }}>Warn</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setText(""); setTarget({ item, action: "suspend" }); }} accessibilityLabel="Suspend"
                style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: C.orange }}>
                <Text style={{ color: C.white, fontWeight: "800" }}>Suspend</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <Modal visible={!!target} transparent animationType="slide" onRequestClose={() => setTarget(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 34, gap: 10 }}>
            <Text style={{ fontWeight: "900", fontSize: 18, color: C.dark }}>
              {target?.action === "warn" ? "Warn" : "Suspend"} {target?.item.name}
            </Text>
            <Text style={{ color: C.mid }}>The driver receives this message.</Text>
            <TextInput value={text} onChangeText={setText} multiline accessibilityLabel="Message"
              style={{ borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, minHeight: 90, textAlignVertical: "top", color: C.dark }} />
            <TouchableOpacity onPress={send} disabled={busy || text.trim().length < 5} accessibilityLabel="Send"
              style={{ backgroundColor: text.trim().length < 5 ? C.muted : C.dark, borderRadius: 14, paddingVertical: 14, alignItems: "center" }}>
              {busy ? <ActivityIndicator color={C.white} /> : <Text style={{ color: C.white, fontWeight: "900" }}>Send</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setTarget(null)} accessibilityLabel="Cancel" style={{ alignItems: "center", paddingVertical: 6 }}>
              <Text style={{ color: C.mid, fontWeight: "700" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
