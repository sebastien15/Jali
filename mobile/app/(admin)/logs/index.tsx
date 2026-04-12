import { useState, useEffect, useCallback } from "react";
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
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { useTranslation } from "react-i18next";
import AdminHeader from "@/components/admin/AdminHeader";

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
  const { t } = useTranslation();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [filterModal, setFilterModal] = useState(false);
  const [actionFilter, setActionFilter] = useState("");

  const load = useCallback(
    async (reset = false) => {
      if (reset) {
        setPage(1);
        setLogs([]);
      }
      if (reset) setRefreshing(true);
      setLoading(true);
      try {
        const res = await api.get("/admin/logs", {
          params: {
            page: reset ? 1 : page,
            per_page: 30,
            ...(actionFilter ? { action: actionFilter } : {}),
          },
        });
        const data = res.data.data ?? [];
        setLogs((prev) => (reset ? data : [...prev, ...data]));
        setHasMore(!!res.data.next_page_url);
      } catch {
        setLogs([]);
      } finally {
        setLoading(false);
        if (reset) setRefreshing(false);
      }
    },
    [page, actionFilter],
  );

  useEffect(() => {
    load(true);
  }, []);

  function handleFilter() {
    setFilterModal(false);
    load(true);
  }

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
            onPress={() => setFilterModal(true)}
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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
          />
        }
      >
        {loading && logs.length === 0 && (
          <ActivityIndicator color={C.teal} style={{ marginTop: 32 }} />
        )}

        {logs.length === 0 && !loading && (
          <Text style={{ color: C.muted, textAlign: "center", marginTop: 40 }}>
            No activity logs yet.
          </Text>
        )}

        {logs.map((log) => (
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

        {hasMore && !loading && (
          <TouchableOpacity
            onPress={() => {
              setPage((p) => p + 1);
              load();
            }}
            style={{ paddingVertical: 14, alignItems: "center" }}
          >
            <Text style={{ color: C.teal, fontWeight: "700", fontSize: 14 }}>
              Load more…
            </Text>
          </TouchableOpacity>
        )}
        {loading && logs.length > 0 && (
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
              value={actionFilter}
              onChangeText={setActionFilter}
              placeholder="Filter by action (e.g. booking_claimed)"
              placeholderTextColor={C.muted}
              style={inputStyle}
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => {
                  setFilterModal(false);
                }}
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
                onPress={handleFilter}
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
              {actionFilter && (
                <TouchableOpacity
                  onPress={() => {
                    setActionFilter("");
                    setFilterModal(false);
                    load(true);
                  }}
                  style={{ paddingVertical: 14, paddingHorizontal: 16 }}
                >
                  <Text style={{ color: "#DC2626", fontWeight: "700" }}>
                    Clear
                  </Text>
                </TouchableOpacity>
              )}
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
