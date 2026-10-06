import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import AdminHeader from "@/components/admin/AdminHeader";
import { queryKeys } from "@/lib/queryKeys";
import type { components } from "@/lib/apiSchema";

type Inbox = components["schemas"]["SupportInbox"];
type Ticket = components["schemas"]["StaffSupportTicket"];

const FILTERS = [
  { id: "open", label: "Open", params: { status: "open" } },
  { id: "mine", label: "Mine", params: { status: "open", mine: 1 } },
  { id: "answered", label: "Answered", params: { status: "answered" } },
  { id: "resolved", label: "Resolved", params: { status: "resolved" } },
] as const;
const PRIORITY_COLOR = { urgent: C.orange, high: C.purple, normal: C.mid } as const;

/** Support inbox: urgent first, then by first-response deadline (S16.3) */
export default function SupportInboxScreen() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("open");
  const params = FILTERS.find(f => f.id === filter)!.params;
  const inbox = useQuery({
    queryKey: queryKeys.admin.supportInbox(filter),
    queryFn: () => api.get<Inbox>("/admin/support/tickets", { params }).then(r => r.data),
    refetchInterval: 60_000,
  });
  const c = inbox.data?.counts;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <AdminHeader title="Support" showBack />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={inbox.isRefetching} onRefresh={() => inbox.refetch()} />}>
        {c && (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Stat label="Open" value={c.open} color={C.teal} />
            <Stat label="Urgent" value={c.urgent} color={C.orange} />
            <Stat label="Late reply" value={c.overdue} color={c.overdue ? C.orange : C.green} />
          </View>
        )}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {FILTERS.map(f => (
            <TouchableOpacity key={f.id} onPress={() => setFilter(f.id)} accessibilityLabel={f.label}
              style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: filter === f.id ? C.teal : C.white }}>
              <Text style={{ color: filter === f.id ? C.white : C.mid, fontWeight: "700" }}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {inbox.isLoading ? <ActivityIndicator color={C.teal} /> : (inbox.data?.data ?? []).length === 0 ? (
          <Text style={{ color: C.muted, textAlign: "center", marginTop: 20 }}>Nothing here.</Text>
        ) : inbox.data!.data.map(t => <Row key={t.id} ticket={t} />)}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ ticket: t }: { ticket: Ticket }) {
  const due = new Date(t.sla.first_response_due_at);
  return (
    <TouchableOpacity onPress={() => router.push({ pathname: "/(admin)/support/[id]", params: { id: String(t.id) } } as any)}
      accessibilityLabel={`Ticket ${t.id} ${t.category}`}
      style={{ backgroundColor: C.white, borderRadius: 14, padding: 12, gap: 4, borderLeftWidth: 4, borderLeftColor: PRIORITY_COLOR[t.priority] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ flex: 1, fontWeight: "800", color: C.dark }}>#{t.id} · {t.category.replace(/_/g, " ")}</Text>
        {t.priority !== "normal" && <Text style={{ color: PRIORITY_COLOR[t.priority], fontWeight: "900", fontSize: 11 }}>{t.priority.toUpperCase()}</Text>}
      </View>
      <Text style={{ color: C.mid, fontSize: 12 }}>
        {t.user.name}{t.subject ? ` · ${t.subject.label}` : ""}{t.assignee ? ` · ${t.assignee.name}` : " · unassigned"}
      </Text>
      <Text style={{ color: C.dark }} numberOfLines={2}>{t.preview}</Text>
      {t.status === "open" && !t.sla.first_responded_at && (
        <Text style={{ color: t.sla.overdue ? C.orange : C.muted, fontSize: 11, fontWeight: "700" }}>
          {t.sla.overdue ? "First reply late" : `Reply by ${due.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.white, borderRadius: 12, padding: 10 }}>
      <Text style={{ color, fontWeight: "900", fontSize: 18 }}>{value}</Text>
      <Text style={{ color: C.muted, fontSize: 11 }}>{label}</Text>
    </View>
  );
}
