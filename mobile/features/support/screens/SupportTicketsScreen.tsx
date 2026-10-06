import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { BackHeader, StatusPill, categoryLabel, type SupportTicket } from "../support";

/** My support tickets (S16.3) */
export default function SupportTicketsScreen() {
  const { t } = useTranslation();
  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: queryKeys.support.tickets(),
    queryFn: () => api.get<{ data: SupportTicket[] }>("/support/tickets").then(r => r.data.data),
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <BackHeader title={t("support.myTickets", "My support tickets")} right={
        <TouchableOpacity onPress={() => router.push("/support/new" as any)} accessibilityLabel={t("support.new", "New ticket")} hitSlop={10}>
          <Ionicons name="add-circle-outline" size={26} color={C.teal} />
        </TouchableOpacity>
      } />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}>
        {isLoading ? <ActivityIndicator color={C.teal} /> : (data ?? []).length === 0 ? (
          <View style={{ alignItems: "center", padding: 32, gap: 8 }}>
            <Ionicons name="chatbubbles-outline" size={44} color={C.muted} />
            <Text style={{ color: C.mid, textAlign: "center" }}>{t("support.none", "No tickets yet. Open one if you need a person to help.")}</Text>
          </View>
        ) : (data ?? []).map(ticket => (
          <TouchableOpacity key={ticket.id} accessibilityLabel={`${categoryLabel(ticket.category)} ${ticket.status}`}
            onPress={() => router.push({ pathname: "/support/[id]", params: { id: String(ticket.id) } } as any)}
            style={{ backgroundColor: C.white, borderRadius: 14, padding: 14, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ flex: 1, fontWeight: "800", color: C.dark }}>{categoryLabel(ticket.category)}</Text>
              <StatusPill status={ticket.status} />
            </View>
            {ticket.subject && <Text style={{ color: C.mid, fontSize: 12 }}>{ticket.subject.label}</Text>}
            <Text style={{ color: C.mid }} numberOfLines={2}>{ticket.preview}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
