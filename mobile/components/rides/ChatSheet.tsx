import { useEffect, useRef, useState } from "react";
import { Modal, View, Text, TouchableOpacity, TextInput, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import type { components } from "@/lib/apiSchema";

type Message = components["schemas"]["RideMessage"];
type Phrase = components["schemas"]["ChatPhrase"];
type Thread = { open: boolean; phrases: Phrase[]; messages: Message[] };

/**
 * Rider ↔ driver chat (story S9.5). Quick phrases are stored as keys and shown
 * in each person's own app language; free text is delivered as written.
 */
export function ChatButton({ rideId }: { rideId: number }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity onPress={() => setOpen(true)} accessibilityLabel={t("chat.open")}
        style={{ flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: C.white, borderRadius: 14, paddingVertical: 12, marginTop: 12, borderWidth: 1, borderColor: C.border }}>
        <Ionicons name="chatbubbles-outline" size={18} color={C.dark} />
        <Text style={{ fontWeight: "800", color: C.dark }}>{t("chat.open")}</Text>
      </TouchableOpacity>
      {open ? <ChatSheet rideId={rideId} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ChatSheet({ rideId, onClose }: { rideId: number; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const list = useRef<FlatList<Message>>(null);
  const key = ["rides", rideId, "messages"];

  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => api.get<Thread>(`/rides/${rideId}/messages`).then(r => r.data),
    refetchInterval: 4_000,
  });
  useEffect(() => { setTimeout(() => list.current?.scrollToEnd({ animated: true }), 50); }, [data?.messages.length]);

  async function send(payload: { phrase?: Phrase; body?: string }) {
    setSending(true);
    try {
      await api.post(`/rides/${rideId}/messages`, payload);
      setText("");
      queryClient.invalidateQueries({ queryKey: key });
    } catch (err: any) {
      const errors = err?.response?.data?.errors;
      Alert.alert(errors ? (Object.values(errors)[0] as string[])[0] : err?.response?.data?.message ?? "Error");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ backgroundColor: C.white, paddingTop: 48, paddingBottom: 12, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <TouchableOpacity onPress={onClose} accessibilityLabel={t("common.close")}>
            <Ionicons name="close" size={26} color={C.dark} />
          </TouchableOpacity>
          <Text style={{ fontWeight: "900", fontSize: 18, color: C.dark }}>{t("chat.title")}</Text>
        </View>

        {isLoading ? <ActivityIndicator color={C.teal} style={{ marginTop: 24 }} /> : (
          <FlatList
            ref={list}
            data={data?.messages ?? []}
            keyExtractor={m => String(m.id)}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            ListEmptyComponent={<Text style={{ color: C.muted, textAlign: "center", marginTop: 24 }}>{t("chat.empty")}</Text>}
            renderItem={({ item }) => (
              <View style={{ alignSelf: item.mine ? "flex-end" : "flex-start", maxWidth: "80%", backgroundColor: item.mine ? C.teal : C.white,
                borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, borderWidth: item.mine ? 0 : 1, borderColor: C.border }}>
                <Text style={{ color: item.mine ? C.white : C.dark }}>{item.phrase ? t(`chat.phrase_${item.phrase}`) : item.body}</Text>
              </View>
            )}
          />
        )}

        {data?.open === false ? (
          <Text style={{ color: C.mid, textAlign: "center", padding: 16 }}>{t("chat.closed")}</Text>
        ) : (
          <View style={{ backgroundColor: C.white, padding: 12, borderTopWidth: 1, borderTopColor: C.border, gap: 10 }}>
            <FlatList horizontal data={data?.phrases ?? []} keyExtractor={p => p} showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => send({ phrase: item })} disabled={sending} accessibilityLabel={t(`chat.phrase_${item}`)}
                  style={{ backgroundColor: C.bg, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 }}>
                  <Text style={{ color: C.dark, fontWeight: "700", fontSize: 13 }}>{t(`chat.phrase_${item}`)}</Text>
                </TouchableOpacity>
              )} />
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <TextInput value={text} onChangeText={setText} placeholder={t("chat.placeholder")} placeholderTextColor={C.muted} maxLength={300}
                accessibilityLabel={t("chat.placeholder")}
                style={{ flex: 1, backgroundColor: C.bg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, color: C.dark }} />
              <TouchableOpacity onPress={() => text.trim() && send({ body: text.trim() })} disabled={sending || !text.trim()} accessibilityLabel={t("chat.send")}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: text.trim() ? C.teal : C.muted, alignItems: "center", justifyContent: "center" }}>
                {sending ? <ActivityIndicator color={C.white} /> : <Ionicons name="send" size={18} color={C.white} />}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}
