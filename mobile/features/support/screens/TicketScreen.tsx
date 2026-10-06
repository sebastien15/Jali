import { useState } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { BackHeader, StatusPill, categoryLabel, type SupportTicketDetail } from "../support";

/** One ticket: the conversation with Jali support (S16.3) */
export default function TicketScreen() {
  const { t, i18n } = useTranslation();
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.support.ticket(id),
    queryFn: () => api.get<SupportTicketDetail>(`/support/tickets/${id}`).then(r => r.data),
    refetchInterval: 30_000,
  });
  const update = (ticket: SupportTicketDetail) => {
    queryClient.setQueryData(queryKeys.support.ticket(id), ticket);
    queryClient.invalidateQueries({ queryKey: queryKeys.support.tickets() });
  };
  const reply = useMutation({
    mutationFn: () => api.post<SupportTicketDetail>(`/support/tickets/${id}/messages`, { body: body.trim() }).then(r => r.data),
    onSuccess: ticket => { setBody(""); update(ticket); },
    onError: (err: any) => Alert.alert(t("support.error", "Could not send"), err?.response?.data?.message ?? t("support.tryAgain", "Please try again.")),
  });
  const resolve = useMutation({
    mutationFn: () => api.post<SupportTicketDetail>(`/support/tickets/${id}/resolve`).then(r => r.data),
    onSuccess: update,
  });
  const time = (iso: string) => new Date(iso).toLocaleString(i18n.language, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <BackHeader title={data ? categoryLabel(data.category) : t("support.ticket", "Ticket")} fallback="/support"
        right={data ? <StatusPill status={data.status} /> : undefined} />
      {isLoading ? <ActivityIndicator color={C.teal} style={{ marginTop: 40 }} /> : isError || !data ? (
        <Text style={{ color: C.mid, padding: 20 }}>{t("support.missing", "This ticket is not available.")}</Text>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
            {data.subject && (
              <TouchableOpacity accessibilityLabel={data.subject.label}
                onPress={() => router.push(`/${data.subject!.type}/${data.subject!.id}` as any)}
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="link-outline" size={16} color={C.teal} />
                <Text style={{ color: C.teal, fontWeight: "700" }}>{data.subject.label}</Text>
              </TouchableOpacity>
            )}
            {data.messages.map(m => (
              <View key={m.id} style={{ alignSelf: m.is_staff ? "flex-start" : "flex-end", maxWidth: "85%",
                backgroundColor: m.is_staff ? C.white : C.tealLt, borderRadius: 14, padding: 12 }}>
                <Text style={{ fontWeight: "800", color: m.is_staff ? C.teal : C.dark, fontSize: 12 }}>{m.author}</Text>
                <Text style={{ color: C.dark, marginTop: 2 }}>{m.body}</Text>
                <Text style={{ color: C.muted, fontSize: 10, marginTop: 4 }}>{time(m.created_at)}</Text>
              </View>
            ))}
            {data.status === "open" && (
              <Text style={{ color: C.mid, fontSize: 12, textAlign: "center" }}>
                {data.priority === "urgent" ? t("support.urgentWait", "A Jali agent will answer within the hour.") : t("support.wait", "A Jali agent will answer soon. We'll notify you.")}
              </Text>
            )}
          </ScrollView>
          {data.status === "resolved" ? (
            <View style={{ padding: 16, gap: 8, alignItems: "center" }}>
              <Text style={{ color: C.mid }}>{t("support.resolved", "This ticket is resolved.")}</Text>
              <TouchableOpacity onPress={() => router.push("/support/new" as any)} accessibilityLabel={t("support.new", "New ticket")}>
                <Text style={{ color: C.teal, fontWeight: "800" }}>{t("support.openAnother", "Open a new ticket")}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ padding: 12, gap: 8, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border }}>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
                <TextInput value={body} onChangeText={setBody} multiline maxLength={2000} placeholder={t("support.reply", "Write a reply")}
                  placeholderTextColor={C.muted} accessibilityLabel={t("support.reply", "Write a reply")}
                  style={{ flex: 1, backgroundColor: C.bg, borderRadius: 12, padding: 10, maxHeight: 120, color: C.dark }} />
                <TouchableOpacity onPress={() => reply.mutate()} disabled={!body.trim() || reply.isPending} accessibilityLabel={t("support.sendReply", "Send")}
                  style={{ backgroundColor: body.trim() ? C.teal : C.border, borderRadius: 12, padding: 12 }}>
                  {reply.isPending ? <ActivityIndicator color={C.white} /> : <Ionicons name="send" size={18} color={C.white} />}
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => resolve.mutate()} accessibilityLabel={t("support.solved", "My problem is solved")} style={{ alignSelf: "center" }}>
                <Text style={{ color: C.mid, fontWeight: "700", fontSize: 12 }}>{t("support.solved", "My problem is solved")}</Text>
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}
