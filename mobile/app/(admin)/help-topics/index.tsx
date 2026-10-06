import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import AdminHeader from "@/components/admin/AdminHeader";
import { queryKeys } from "@/lib/queryKeys";
import type { components } from "@/lib/apiSchema";

type AdminHelpTopic = components["schemas"]["AdminHelpTopic"];

/** Admin: help centre topics (S16.2) */
export default function AdminHelpTopicsScreen() {
  const list = useQuery({
    queryKey: queryKeys.admin.helpTopics(),
    queryFn: () => api.get<{ data: AdminHelpTopic[] }>("/admin/help-topics").then(r => r.data.data),
  });
  const open = (id: number | "new") => router.push({ pathname: "/(admin)/help-topics/[id]", params: { id: String(id) } } as any);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <AdminHeader title="Help topics" showBack right={
        <TouchableOpacity onPress={() => open("new")} accessibilityLabel="Add a help topic" style={{ padding: 4 }}>
          <Ionicons name="add-circle-outline" size={26} color={C.white} />
        </TouchableOpacity>
      } />
      {list.isLoading ? <ActivityIndicator color={C.teal} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => list.refetch()} />}>
          <Text style={{ color: C.mid, fontSize: 13 }}>Customers see these in their language, and the ones for a service on each trip.</Text>
          {(list.data ?? []).map(topic => (
            <TouchableOpacity key={topic.id} onPress={() => open(topic.id)} accessibilityLabel={`Edit ${topic.title.en}`}
              style={{ backgroundColor: C.white, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "800", color: C.dark }}>{topic.title.en}</Text>
                <Text style={{ color: C.mid, fontSize: 12 }}>
                  {topic.services.length ? topic.services.join(", ") : "all services"}{topic.contexts.length ? ` · ${topic.contexts.join(", ")}` : ""}
                </Text>
              </View>
              {!topic.published && (
                <View style={{ backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: C.muted, fontWeight: "800", fontSize: 11 }}>Draft</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={18} color={C.muted} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
