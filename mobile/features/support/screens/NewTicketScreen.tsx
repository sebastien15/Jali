import { useState } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { BackHeader, CATEGORIES, categoryLabel, type HelpContext, type SupportTicketDetail } from "../support";

/** Open a ticket, optionally about one trip (S16.3). Safety goes to the front of the queue. */
export default function NewTicketScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ subject_type?: string; subject_id?: string; category?: string }>();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<HelpContext | null>((params.category as HelpContext) ?? null);
  const [message, setMessage] = useState("");
  const subject = params.subject_type && params.subject_id ? { subject_type: params.subject_type, subject_id: Number(params.subject_id) } : {};

  const send = useMutation({
    mutationFn: () => api.post<SupportTicketDetail>("/support/tickets", { category, message: message.trim(), ...subject }).then(r => r.data),
    onSuccess: ticket => {
      queryClient.invalidateQueries({ queryKey: queryKeys.support.tickets() });
      router.replace({ pathname: "/support/[id]", params: { id: String(ticket.id) } } as any);
    },
    onError: (err: any) => Alert.alert(t("support.error", "Could not send"),
      String(Object.values(err?.response?.data?.errors ?? {})[0] ?? err?.response?.data?.message ?? t("support.tryAgain", "Please try again."))),
  });
  const ready = !!category && message.trim().length >= 5 && !send.isPending;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <BackHeader title={t("support.new", "New ticket")} fallback="/support" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {"subject_type" in subject && (
            <Text style={{ color: C.mid }}>{t("support.aboutTrip", "About this trip")} · #{params.subject_id}</Text>
          )}
          <Text style={{ fontWeight: "800", color: C.dark }}>{t("support.whatHappened", "What is it about?")}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {CATEGORIES.map(c => (
              <TouchableOpacity key={c} onPress={() => setCategory(c)} accessibilityLabel={categoryLabel(c)} accessibilityState={{ selected: category === c }}
                style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: category === c ? (c === "safety" ? C.orange : C.teal) : C.white,
                  borderWidth: 1.5, borderColor: category === c ? "transparent" : C.border }}>
                <Text style={{ color: category === c ? C.white : C.dark, fontWeight: "700" }}>{categoryLabel(c)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {category === "safety" && (
            <Text style={{ color: C.orange, fontWeight: "700" }}>
              {t("support.safetyNote", "Safety tickets are answered first. If you are in danger now, call 112.")}
            </Text>
          )}
          <TextInput value={message} onChangeText={setMessage} multiline maxLength={2000}
            placeholder={t("support.describe", "Tell us what happened")} placeholderTextColor={C.muted}
            accessibilityLabel={t("support.describe", "Tell us what happened")}
            style={{ backgroundColor: C.white, borderRadius: 14, padding: 14, minHeight: 150, textAlignVertical: "top", color: C.dark, borderWidth: 1, borderColor: C.border }} />
          <TouchableOpacity onPress={() => send.mutate()} disabled={!ready} accessibilityLabel={t("support.send", "Send to Jali support")}
            style={{ backgroundColor: ready ? C.teal : C.border, borderRadius: 16, paddingVertical: 16, alignItems: "center" }}>
            {send.isPending ? <ActivityIndicator color={C.white} /> : <Text style={{ color: C.white, fontWeight: "900", fontSize: 16 }}>{t("support.send", "Send to Jali support")}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
