import { View, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { helpLocale, type HelpTopic, type ServiceKey } from "../support";

/**
 * "Need help with this trip?" — the help topics for a service, shown on a
 * trip/hire/rental detail (S16.2). Tapping opens the topic.
 */
export function HelpTopicsCard({ service, limit = 4 }: { service: ServiceKey; limit?: number }) {
  const { t } = useTranslation();
  const locale = helpLocale();
  const { data } = useQuery({
    queryKey: queryKeys.help.topics(locale, service),
    queryFn: () => api.get<{ data: HelpTopic[] }>("/help/topics", { params: { service, locale } }).then(r => r.data.data),
    staleTime: 60 * 60_000,
  });
  const topics = (data ?? []).slice(0, limit);
  if (!topics.length) return null;

  return (
    <View style={{ backgroundColor: C.white, borderRadius: 16, padding: 14, gap: 4 }}>
      <Text style={{ fontWeight: "800", color: C.dark, marginBottom: 4 }}>{t("help.forThisTrip", "Need help with this trip?")}</Text>
      {topics.map(topic => (
        <TouchableOpacity key={topic.slug} accessibilityLabel={topic.title}
          onPress={() => router.push({ pathname: "/help/[slug]", params: { slug: topic.slug } } as any)}
          style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border }}>
          <Text style={{ flex: 1, color: C.dark }}>{topic.title}</Text>
          <Ionicons name="chevron-forward" size={16} color={C.muted} />
        </TouchableOpacity>
      ))}
      <TouchableOpacity onPress={() => router.push("/help" as any)} accessibilityLabel={t("help.allTopics", "All help topics")}
        style={{ paddingTop: 8 }}>
        <Text style={{ color: C.teal, fontWeight: "700" }}>{t("help.allTopics", "All help topics")}</Text>
      </TouchableOpacity>
    </View>
  );
}
