import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import AdminHeader from "@/components/admin/AdminHeader";
import { queryKeys } from "@/lib/queryKeys";

const ACTION_LABELS: Record<string, string> = {
  booking_claimed: "Claimed booking",
  ticket_uploaded: "Uploaded ticket",
  booking_delivered: "Delivered booking",
  booking_confirmed: "Confirmed booking",
  profile_updated: "Updated profile",
  profile_image_uploaded: "Uploaded profile image",
  contract_uploaded: "Uploaded contract",
  location_change_approved: "Approved location change",
  location_change_rejected: "Rejected location change",
  agency_created: "Created agency",
  agency_updated: "Updated agency",
  agency_deleted: "Deleted agency",
  agency_route_added: "Added route to agency",
  agency_route_removed: "Removed route from agency",
  trip_created: "Created trip",
  trip_updated: "Updated trip",
  trip_deleted: "Deleted trip",
};

export default function AdminLogsScreen() {
  const [filterModal, setFilterModal] = useState(false);
  const [pendingFilter, setPendingFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const {
    data,
    isLoading,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: queryKeys.admin.logs(actionFilter || undefined),
    queryFn: ({ pageParam = 1 }) =>
      api.get("/admin/logs", {
        params: {
          page: pageParam,
          per_page: 30,
          ...(actionFilter ? { action: actionFilter } : {}),
        },
      }).then(r => r.data),
    getNextPageParam: (lastPage: any) =>
      lastPage.next_page_url ? (lastPage.current_page + 1) : undefined,
    initialPageParam: 1,
    staleTime: 30_000,
  });

  const logs = data?.pages.flatMap((p: any) => p.data ?? []) ?? [];

  function formatTime(iso: string) {
    const d = new Date(iso);
    return (
      d.toLocaleDateString() +
      " " +
      d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />

      <AdminHeader
        title="Logs"
        right={
          <TouchableOpacity
            onPress={() => { setPendingFilter(actionFilter); setFilterModal(true); }}
            style={{
              backgroundColor: "rgba(255,255,255,0.2)",
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <Text style={{ color: C.white, fontWeight: "700", fontSize: 13 }}>
              Filter
            </Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        {isLoading && logs.length === 0 && (
          <ActivityIndicator color={C.teal} style={{ marginTop: 32 }} />
        )}

        {logs.length === 0 && !isLoading && (
          <Text style={{ color: C.muted, textAlign: "center", marginTop: 40 }}>
            No activity logs yet.
          </Text>
        )}

        {logs.map((log: any) => (
          <View
            key={log.id}
            style={{
              backgroundColor: C.white,
              borderRadius: 16,
              padding: 14,
              marginBottom: 10,
              flexDirection: "row",
              gap: 12,
              alignItems: "flex-start",
              shadowColor: "#000",
              shadowOpacity: 0.05,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 1 },
              elevation: 1,
            }}
          >
            <View
              style={{
                backgroundColor: C.tealLt,
                borderRadius: 10,
                width: 36,
                height: 36,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="receipt-outline" size={18} color={C.teal} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.dark, fontWeight: "700", fontSize: 14 }}>
                {ACTION_LABELS[log.action] ?? log.action}
              </Text>
              <Text style={{ color: C.mid, fontSize: 12, marginTop: 2 }}>
                by {log.admin?.name ?? "Admin"}
                {log.details?.title ? ` — "${log.details.title}"` : ""}
              </Text>
              <Text style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>
                {formatTime(log.created_at)}
              </Text>
            </View>
          </View>
        ))}

        {hasNextPage && !isFetchingNextPage && (
          <TouchableOpacity
            onPress={() => fetchNextPage()}
            style={{ paddingVertical: 14, alignItems: "center" }}
          >
            <Text style={{ color: C.teal, fontWeight: "700", fontSize: 14 }}>
              Load more…
            </Text>
          </TouchableOpacity>
        )}
        {isFetchingNextPage && (
          <ActivityIndicator color={C.teal} style={{ marginTop: 16 }} />
        )}
      </ScrollView>

      {/* Filter Modal */}
      <Modal visible={filterModal} animationType="slide" transparent>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: C.white,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              paddingBottom: 40,
            }}
          >
            <View
              style={{
                width: 40,
                height: 4,
                backgroundColor: C.border,
                borderRadius: 2,
                alignSelf: "center",
                marginBottom: 20,
              }}
            />
            <Text
              style={{
                fontWeight: "900",
                fontSize: 18,
                color: C.dark,
                marginBottom: 16,
              }}
            >
              Filter Logs
            </Text>
            <TextInput
              value={pendingFilter}
              onChangeText={setPendingFilter}
              placeholder="Filter by action (e.g. booking_claimed)"
              placeholderTextColor={C.muted}
              style={inputStyle}
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => setFilterModal(false)}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: C.bg,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: C.mid, fontWeight: "700" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setActionFilter(pendingFilter); setFilterModal(false); }}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: C.teal,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: C.white, fontWeight: "800" }}>Apply</Text>
              </TouchableOpacity>
              {pendingFilter ? (
                <TouchableOpacity
                  onPress={() => { setPendingFilter(""); setActionFilter(""); setFilterModal(false); }}
                  style={{ paddingVertical: 14, paddingHorizontal: 16 }}
                >
                  <Text style={{ color: "#DC2626", fontWeight: "700" }}>Clear</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const inputStyle = {
  backgroundColor: C.bg,
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 13,
  fontSize: 14,
  color: C.dark,
  borderWidth: 1.5,
  borderColor: C.border,
};
