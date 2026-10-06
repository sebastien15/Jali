import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { helpLocale, type HelpTopic } from "../support";
import { ContactCard } from "./HelpCentreScreen";

/** One help topic (S16.2) */
export default function HelpTopicScreen() {
  const { t } = useTranslation();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const locale = helpLocale();
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.help.topic(String(slug), locale),
    queryFn: () => api.get<HelpTopic>(`/help/topics/${slug}`, { params: { locale } }).then(r => r.data),
    staleTime: 60 * 60_000,
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />
      <View style={{ backgroundColor: C.white, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace("/help" as any))} accessibilityLabel="Back" hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={C.dark} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontWeight: "900", fontSize: 17, color: C.dark }} numberOfLines={2}>{data?.title ?? t("help.title", "Help centre")}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        {isLoading ? <ActivityIndicator color={C.teal} /> : isError || !data ? (
          <Text style={{ color: C.mid }}>{t("help.missing", "This help topic is not available.")}</Text>
        ) : data.body.split(/\n\s*\n/).map((p, i) => (
          <Text key={i} style={{ color: C.dark, fontSize: 15, lineHeight: 22 }}>{p.trim()}</Text>
        ))}
        <ContactCard />
      </ScrollView>
    </SafeAreaView>
  );
}
