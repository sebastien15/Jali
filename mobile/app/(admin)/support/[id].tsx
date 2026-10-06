import { useState } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import AdminHeader from "@/components/admin/AdminHeader";
import { queryKeys } from "@/lib/queryKeys";
import type { components } from "@/lib/apiSchema";

type Ticket = components["schemas"]["StaffSupportTicketDetail"];
type Canned = components["schemas"]["CannedReply"];

/** Staff view of one ticket: assign, reply (with saved replies), resolve (S16.3) */
export default function SupportTicketAdminScreen() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [showCanned, setShowCanned] = useState(false);

  const ticket = useQuery({
    queryKey: queryKeys.admin.supportTicket(id),
    queryFn: () => api.get<Ticket>(`/admin/support/tickets/${id}`).then(r => r.data),
  });
  const canned = useQuery({
    queryKey: queryKeys.admin.cannedReplies(),
    queryFn: () => api.get<{ data: Canned[] }>("/admin/support/canned-replies").then(r => r.data.data),
    enabled: showCanned,
  });
  const done = (t: Ticket) => {
    queryClient.setQueryData(queryKeys.admin.supportTicket(id), t);
    queryClient.invalidateQueries({ queryKey: ["admin", "support", "inbox"] });
  };
  const fail = (err: any) => Alert.alert("Error", err?.response?.data?.message ?? "Could not save.");
  const reply = useMutation({
    mutationFn: () => api.post<Ticket>(`/admin/support/tickets/${id}/messages`, { body: body.trim() }).then(r => r.data),
    onSuccess: t => { setBody(""); done(t); }, onError: fail,
  });
  const assign = useMutation({ mutationFn: () => api.post<Ticket>(`/admin/support/tickets/${id}/assign`).then(r => r.data), onSuccess: done, onError: fail });
  const status = useMutation({
    mutationFn: (s: "open" | "resolved") => api.post<Ticket>(`/admin/support/tickets/${id}/status`, { status: s }).then(r => r.data),
    onSuccess: done, onError: fail,
  });
  const saveCanned = useMutation({
    mutationFn: (title: string) => api.post("/admin/support/canned-replies", { title, body: body.trim() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.cannedReplies() }), onError: fail,
  });

  const t = ticket.data;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <AdminHeader title={`Ticket #${id}`} showBack />
      {!t ? <ActivityIndicator color={C.teal} style={{ marginTop: 40 }} /> : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
            <View style={{ backgroundColor: C.white, borderRadius: 14, padding: 12, gap: 4 }}>
              <Text style={{ fontWeight: "900", color: C.dark }}>{t.category.replace(/_/g, " ")} · {t.priority} · {t.status}</Text>
              <Text style={{ color: C.mid }}>{t.user.name}{t.subject ? ` · ${t.subject.label}` : ""}</Text>
              {!!t.user.phone && (
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${t.user.phone}`)} accessibilityLabel="Call customer">
                  <Text style={{ color: C.teal, fontWeight: "700" }}>📞 {t.user.phone}</Text>
                </TouchableOpacity>
              )}
              <Text style={{ color: t.sla.overdue ? C.orange : C.muted, fontSize: 12 }}>
                {t.sla.first_responded_at ? "First reply sent" : `First reply due ${new Date(t.sla.first_response_due_at).toLocaleString("en-GB")}`}
              </Text>
              <View style={{ flexDirection: "row", gap: 14, marginTop: 6 }}>
                <TouchableOpacity onPress={() => assign.mutate()} accessibilityLabel="Assign to me">
                  <Text style={{ color: C.teal, fontWeight: "800" }}>{t.assignee ? `Assigned: ${t.assignee.name}` : "Assign to me"}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => status.mutate(t.status === "resolved" ? "open" : "resolved")} accessibilityLabel="Change status">
                  <Text style={{ color: t.status === "resolved" ? C.orange : C.green, fontWeight: "800" }}>{t.status === "resolved" ? "Reopen" : "Mark resolved"}</Text>
                </TouchableOpacity>
              </View>
            </View>
            {t.messages.map(m => (
              <View key={m.id} style={{ alignSelf: m.is_staff ? "flex-end" : "flex-start", maxWidth: "85%", backgroundColor: m.is_staff ? C.tealLt : C.white, borderRadius: 14, padding: 12 }}>
                <Text style={{ fontWeight: "800", fontSize: 12, color: m.is_staff ? C.teal : C.dark }}>{m.author}</Text>
                <Text style={{ color: C.dark, marginTop: 2 }}>{m.body}</Text>
                <Text style={{ color: C.muted, fontSize: 10, marginTop: 4 }}>{new Date(m.created_at).toLocaleString("en-GB")}</Text>
              </View>
            ))}
          </ScrollView>
          {showCanned && (
            <ScrollView style={{ maxHeight: 180, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border }} contentContainerStyle={{ padding: 12, gap: 6 }}>
              {canned.isLoading ? <ActivityIndicator color={C.teal} /> : (canned.data ?? []).length === 0 ? (
                <Text style={{ color: C.muted }}>No saved replies yet. Write one below and tap “Save reply”.</Text>
              ) : canned.data!.map(c => (
                <TouchableOpacity key={c.id} onPress={() => { setBody(c.body); setShowCanned(false); }} accessibilityLabel={c.title}
                  style={{ paddingVertical: 6 }}>
                  <Text style={{ fontWeight: "800", color: C.dark }}>{c.title}</Text>
                  <Text style={{ color: C.mid, fontSize: 12 }} numberOfLines={1}>{c.body}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          <View style={{ padding: 12, gap: 8, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border }}>
            <TextInput value={body} onChangeText={setBody} multiline maxLength={2000} placeholder="Reply as Jali support" placeholderTextColor={C.muted}
              accessibilityLabel="Reply" style={{ backgroundColor: C.bg, borderRadius: 12, padding: 10, maxHeight: 140, color: C.dark }} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <TouchableOpacity onPress={() => setShowCanned(v => !v)} accessibilityLabel="Saved replies">
                <Text style={{ color: C.teal, fontWeight: "700" }}>Saved replies</Text>
              </TouchableOpacity>
              {!!body.trim() && (
                <TouchableOpacity accessibilityLabel="Save reply"
                  onPress={() => Alert.prompt ? Alert.prompt("Save reply", "Short title", title => title && saveCanned.mutate(title))
                    : saveCanned.mutate(body.trim().slice(0, 40))}>
                  <Text style={{ color: C.mid, fontWeight: "700" }}>Save reply</Text>
                </TouchableOpacity>
              )}
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={() => reply.mutate()} disabled={!body.trim() || reply.isPending} accessibilityLabel="Send reply"
                style={{ backgroundColor: body.trim() ? C.teal : C.border, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 }}>
                {reply.isPending ? <ActivityIndicator color={C.white} /> : <Text style={{ color: C.white, fontWeight: "800" }}>Send</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}
