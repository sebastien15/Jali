import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Linking, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { helpLocale, SUPPORT_WHATSAPP, type HelpTopic } from "../support";

/** Help centre: search and browse topics in the app language (S16.2) */
export default function HelpCentreScreen() {
  const { t } = useTranslation();
  const locale = helpLocale();
  const [q, setQ] = useState("");
  const search = q.trim().length >= 2 ? q.trim() : undefined;
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.help.topics(locale, undefined, undefined, search),
    queryFn: () => api.get<{ data: HelpTopic[] }>("/help/topics", { params: { locale, ...(search ? { q: search } : {}) } }).then(r => r.data.data),
    staleTime: 60 * 60_000,
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />
      <View style={{ backgroundColor: C.white, padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)" as any))} accessibilityLabel="Back" hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={C.dark} />
          </TouchableOpacity>
          <Text style={{ fontWeight: "900", fontSize: 18, color: C.dark }}>{t("help.title", "Help centre")}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 12 }}>
          <Ionicons name="search" size={18} color={C.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder={t("help.search", "Search help")} placeholderTextColor={C.muted}
            accessibilityLabel={t("help.search", "Search help")} style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, color: C.dark }} />
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        {isLoading ? <ActivityIndicator color={C.teal} /> : (data ?? []).length === 0 ? (
          <Text style={{ color: C.mid, textAlign: "center", marginTop: 20 }}>{t("help.noResults", "No topic matches. Contact us below.")}</Text>
        ) : (data ?? []).map(topic => (
          <TouchableOpacity key={topic.slug} accessibilityLabel={topic.title}
            onPress={() => router.push({ pathname: "/help/[slug]", params: { slug: topic.slug } } as any)}
            style={{ backgroundColor: C.white, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Ionicons name="help-circle-outline" size={22} color={C.teal} />
            <Text style={{ flex: 1, fontWeight: "700", color: C.dark }}>{topic.title}</Text>
            <Ionicons name="chevron-forward" size={16} color={C.muted} />
          </TouchableOpacity>
        ))}
        <ContactCard />
      </ScrollView>
    </SafeAreaView>
  );
}

export function ContactCard() {
  const { t } = useTranslation();
  return (
    <View style={{ backgroundColor: C.tealLt, borderRadius: 14, padding: 14, gap: 8, marginTop: 6 }}>
      <Text style={{ fontWeight: "800", color: C.dark }}>{t("help.stillNeedHelp", "Still need help?")}</Text>
      <TouchableOpacity onPress={() => Linking.openURL(SUPPORT_WHATSAPP)} accessibilityLabel={t("help.whatsapp", "Chat with Jali on WhatsApp")}
        style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name="logo-whatsapp" size={18} color={C.teal} />
        <Text style={{ color: C.teal, fontWeight: "700" }}>{t("help.whatsapp", "Chat with Jali on WhatsApp")}</Text>
      </TouchableOpacity>
    </View>
  );
}
