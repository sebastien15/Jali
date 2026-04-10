import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { C } from "@/constants/theme";
import api from "@/lib/api";

type BookingStatus = "pending" | "taken" | "ticket_ready" | "delivered";

const STATUS_META: Record<
  BookingStatus,
  { label: string; color: string; bg: string; icon: string }
> = {
  pending: { label: "Pending", color: C.orange, bg: C.orangeLt, icon: "⏳" },
  taken: { label: "Taken", color: C.blue, bg: C.blueLt, icon: "📋" },
  ticket_ready: {
    label: "Ticket Ready",
    color: C.green,
    bg: C.greenLt,
    icon: "🎫",
  },
  delivered: { label: "Delivered", color: C.teal, bg: C.tealLt, icon: "✅" },
};

const TABS: { key: "all" | BookingStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "taken", label: "Taken" },
  { key: "ticket_ready", label: "Ready" },
  { key: "delivered", label: "Delivered" },
];

export default function AdminBookingsScreen() {
  const [filter, setFilter] = useState<"all" | BookingStatus>("all");
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [ticketModal, setTicketModal] = useState<any>(null);
  const [ticketUrl, setTicketUrl] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await api.get("/admin/bookings");
      setBookings(res.data);
    } catch {
      setBookings([]);
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const list =
    filter === "all" ? bookings : bookings.filter((b) => b.status === filter);

  async function handleClaim(id: number) {
    Alert.alert("Claim Booking", "Take ownership of this booking?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Claim",
        onPress: async () => {
          setActionLoading(id);
          try {
            await api.post(`/bookings/${id}/claim`);
            load();
          } catch (e: any) {
            Alert.alert("Error", e?.response?.data?.error ?? "Failed");
          } finally {
            setActionLoading(null);
          }
        },
      },
    ]);
  }

  async function handleUploadTicket(id: number) {
    setTicketModal({ id });
    setTicketUrl("");
  }

  async function confirmUploadTicket() {
    if (!ticketModal || !ticketUrl.trim()) return;
    setActionLoading(ticketModal.id);
    try {
      await api.patch(`/bookings/${ticketModal.id}/ticket`, {
        ticket_photo_url: ticketUrl.trim(),
      });
      setTicketModal(null);
      setTicketUrl("");
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.error ?? "Failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeliver(id: number) {
    Alert.alert(
      "Mark Delivered",
      "Confirm ticket has been handed to passenger?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Deliver",
          onPress: async () => {
            setActionLoading(id);
            try {
              await api.post(`/bookings/${id}/deliver`);
              load();
            } catch (e: any) {
              Alert.alert("Error", e?.response?.data?.error ?? "Failed");
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    );
  }

  function renderActions(b: any) {
    if (b.status === "pending") {
      return (
        <ActionBtn
          label="Claim"
          color={C.blue}
          onPress={() => handleClaim(b.id)}
          loading={actionLoading === b.id}
        />
      );
    }
    if (b.status === "taken") {
      return (
        <ActionBtn
          label="Upload Ticket"
          color={C.green}
          onPress={() => handleUploadTicket(b.id)}
          loading={actionLoading === b.id}
        />
      );
    }
    if (b.status === "ticket_ready") {
      return (
        <ActionBtn
          label="Delivered ✓"
          color={C.teal}
          onPress={() => handleDeliver(b.id)}
          loading={actionLoading === b.id}
        />
      );
    }
    return null;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />

      <View
        style={{
          backgroundColor: C.teal,
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 0,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={C.white} />
          </TouchableOpacity>
          <Text style={{ color: C.white, fontWeight: "900", fontSize: 22 }}>
            Bookings
          </Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 8, paddingBottom: 16 }}>
            {TABS.map((t) => (
              <TouchableOpacity
                key={t.key}
                onPress={() => setFilter(t.key)}
                style={{
                  backgroundColor:
                    filter === t.key ? C.white : "rgba(255,255,255,0.2)",
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                }}
              >
                <Text
                  style={{
                    color: filter === t.key ? C.teal : C.white,
                    fontWeight: "800",
                    fontSize: 13,
                  }}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
          />
        }
      >
        {loading && (
          <ActivityIndicator color={C.teal} style={{ marginTop: 32 }} />
        )}

        {!loading && list.length === 0 && (
          <Text style={{ color: C.muted, textAlign: "center", marginTop: 40 }}>
            No bookings found.
          </Text>
        )}

        {!loading &&
          list.map((b) => {
            const meta =
              STATUS_META[b.status as BookingStatus] ?? STATUS_META.pending;
            return (
              <View
                key={b.id}
                style={{
                  backgroundColor: C.white,
                  borderRadius: 20,
                  padding: 16,
                  marginBottom: 12,
                  shadowColor: "#000",
                  shadowOpacity: 0.07,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 3,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ color: C.dark, fontWeight: "800", fontSize: 14 }}
                    >
                      {b.title}
                    </Text>
                    <Text style={{ color: C.mid, fontSize: 12, marginTop: 2 }}>
                      {b.sub}
                    </Text>
                    <Text
                      style={{ color: C.muted, fontSize: 12, marginTop: 4 }}
                    >
                      {b.user_name} · {b.user_email}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    <Text
                      style={{ color: C.dark, fontWeight: "800", fontSize: 13 }}
                    >
                      {(b.price + (b.service_fee ?? 0)).toLocaleString()} RWF
                    </Text>
                    <View
                      style={{
                        backgroundColor: meta.bg,
                        borderRadius: 8,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                      }}
                    >
                      <Text
                        style={{
                          color: meta.color,
                          fontSize: 11,
                          fontWeight: "700",
                        }}
                      >
                        {meta.icon} {meta.label}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={{ marginTop: 12 }}>{renderActions(b)}</View>
              </View>
            );
          })}
      </ScrollView>

      {/* Upload ticket modal */}
      <Modal visible={!!ticketModal} animationType="slide" transparent>
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
              Upload Ticket Photo
            </Text>
            <TextInput
              value={ticketUrl}
              onChangeText={setTicketUrl}
              placeholder="Paste ticket photo URL from Firebase Storage"
              placeholderTextColor={C.muted}
              style={{
                backgroundColor: C.bg,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 13,
                fontSize: 14,
                color: C.dark,
                borderWidth: 1.5,
                borderColor: C.border,
                marginBottom: 16,
              }}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => {
                  setTicketModal(null);
                  setTicketUrl("");
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
                onPress={confirmUploadTicket}
                disabled={!ticketUrl.trim()}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: ticketUrl.trim() ? C.green : C.border,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: C.white, fontWeight: "800" }}>
                  Upload
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ActionBtn({
  label,
  color,
  onPress,
  loading,
}: {
  label: string;
  color: string;
  onPress: () => void;
  loading: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      style={{
        backgroundColor: color,
        borderRadius: 12,
        paddingVertical: 10,
        alignItems: "center",
      }}
    >
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Text style={{ color: C.white, fontWeight: "800", fontSize: 13 }}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}
