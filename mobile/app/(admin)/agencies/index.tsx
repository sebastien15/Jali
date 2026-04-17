import { useState, useEffect } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { useTranslation } from "react-i18next";
import AdminHeader from "@/components/admin/AdminHeader";
import { queryKeys } from "@/lib/queryKeys";
import { useAdminNav } from "@/components/admin/AdminNavContext";

type Station = { id: number; city: string; district: string | null };

type AgencyRoute = {
  id: number;
  from: { id: number; city: string; district: string | null };
  to: { id: number; city: string; district: string | null };
};

type Agency = {
  id: number;
  name: string;
  operating_hours: string | null;
  average_rating: number;
  ratings_count: number;
  routes: AgencyRoute[];
};

export default function AgenciesScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { isSuperAdmin } = useAdminNav();
  const [modal, setModal] = useState<{ mode: "create" | "edit"; agency?: Agency } | null>(null);
  const [name, setName] = useState("");
  const [hours, setHours] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const { data: agencies = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: queryKeys.admin.agencies(),
    queryFn: () => api.get("/admin/agencies").then(r => r.data ?? []),
    staleTime: 5 * 60_000,
  });

  const { data: stations = [] } = useQuery({
    queryKey: queryKeys.stations.public(),
    queryFn: () => api.get("/stations").then(r => r.data ?? []),
    staleTime: 10 * 60_000,
  });

  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(""), 2000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  async function handleCreate() {
    setSaving(true);
    try {
      if (modal?.mode === "create") {
        if (!name.trim()) return;
        await api.post("/admin/agencies", { name: name.trim() });
        setSuccessMsg(t("agencies.created"));
      } else if (modal?.agency) {
        const payload: any = {};
        if (isSuperAdmin && name.trim()) payload.name = name.trim();
        if (hours.trim()) payload.operating_hours = hours.trim();
        await api.patch(`/admin/agencies/${modal.agency.id}`, payload);
        setSuccessMsg(t("agencies.updated") ?? "Agency updated.");
      }
      setModal(null);
      setName("");
      setHours("");
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.agencies() });
    } catch (e: any) {
      Alert.alert(t("common.close"), e?.response?.data?.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(agency: Agency) {
    Alert.alert(t("agencies.title"), t("agencies.deleteConfirm"), [
      { text: t("common.cancel") ?? "Cancel", style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/admin/agencies/${agency.id}`);
            setSuccessMsg(t("agencies.deleted"));
            queryClient.invalidateQueries({ queryKey: queryKeys.admin.agencies() });
          } catch (e: any) {
            Alert.alert(t("common.close"), e?.response?.data?.message ?? "Failed");
          }
        },
      },
    ]);
  }

  async function handleAddRoute(agencyId: number, fromId: number, toId: number) {
    try {
      await api.post(`/admin/agencies/${agencyId}/routes`, {
        from_station_id: fromId,
        to_station_id: toId,
      });
      setSuccessMsg(t("agencies.routeAdded"));
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.agencies() });
    } catch (e: any) {
      Alert.alert(t("common.close"), e?.response?.data?.message ?? "Failed");
    }
  }

  async function handleRemoveRoute(agencyId: number, routeId: number) {
    try {
      await api.delete(`/admin/agencies/${agencyId}/routes/${routeId}`);
      setSuccessMsg(t("agencies.routeRemoved"));
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.agencies() });
    } catch (e: any) {
      Alert.alert(t("common.close"), e?.response?.data?.message ?? "Failed");
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />
      <AdminHeader
        title={t("agencies.title")}
        right={isSuperAdmin ? (
          <TouchableOpacity
            onPress={() => { setModal({ mode: "create" }); setName(""); setHours(""); }}
            style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}
          >
            <Text style={{ color: C.white, fontWeight: "800", fontSize: 18 }}>+</Text>
          </TouchableOpacity>
        ) : undefined}
      />

      {/* Success banner */}
      {successMsg ? (
        <View style={{ backgroundColor: C.greenLt, padding: 12, marginHorizontal: 16, borderRadius: 10 }}>
          <Text style={{ color: C.green, fontWeight: "700", fontSize: 13 }}>{successMsg}</Text>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {isLoading && <ActivityIndicator color={C.teal} style={{ marginTop: 32 }} />}

        {!isLoading && (agencies as Agency[]).length === 0 && (
          <Text style={{ color: C.muted, textAlign: "center", marginTop: 40 }}>
            {t("agencies.noAgencies")}
          </Text>
        )}

        {!isLoading && (agencies as Agency[]).map((a) => (
          <AgencyCard
            key={a.id}
            agency={a}
            stations={stations as Station[]}
            isSuperAdmin={isSuperAdmin}
            onEdit={() => { setModal({ mode: "edit", agency: a }); setName(a.name); setHours(a.operating_hours ?? ""); }}
            onDelete={() => handleDelete(a)}
            onAddRoute={(fromId, toId) => handleAddRoute(a.id, fromId, toId)}
            onRemoveRoute={(routeId) => handleRemoveRoute(a.id, routeId)}
          />
        ))}
      </ScrollView>

      {/* Create/Edit modal */}
      <Modal visible={!!modal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: "90%" }}>
            <View style={{ width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginBottom: 20 }} />
            <Text style={{ fontWeight: "900", fontSize: 18, color: C.dark, marginBottom: 16 }}>
              {modal?.mode === "create" ? t("agencies.addNew") : t("agencies.editAgency")}
            </Text>

            {/* Name — superadmin only */}
            {(isSuperAdmin || modal?.mode === "create") && (
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t("agencies.namePlaceholder")}
                placeholderTextColor={C.muted}
                style={{
                  backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 14,
                  paddingVertical: 13, fontSize: 14, color: C.dark,
                  borderWidth: 1.5, borderColor: C.border, marginBottom: 12,
                }}
              />
            )}

            {/* Operating hours — all admins in edit mode */}
            {modal?.mode === "edit" && (
              <>
                <Text style={{ color: C.muted, fontSize: 12, fontWeight: "700", marginBottom: 6 }}>
                  OPERATING HOURS
                </Text>
                <TextInput
                  value={hours}
                  onChangeText={setHours}
                  placeholder="e.g. Mon–Fri 6am–8pm, Sat 7am–6pm"
                  placeholderTextColor={C.muted}
                  style={{
                    backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 14,
                    paddingVertical: 13, fontSize: 14, color: C.dark,
                    borderWidth: 1.5, borderColor: C.border, marginBottom: 16,
                  }}
                />
              </>
            )}

            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => { setModal(null); setName(""); }}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: C.bg, alignItems: "center" }}
              >
                <Text style={{ color: C.mid, fontWeight: "700" }}>{t("common.cancel") ?? "Cancel"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreate}
                disabled={saving || !name.trim()}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: saving || !name.trim() ? C.border : C.teal, alignItems: "center" }}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: C.white, fontWeight: "800" }}>
                    {modal?.mode === "create" ? "Create" : "Update"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function AgencyCard({
  agency, stations, isSuperAdmin, onEdit, onDelete, onAddRoute, onRemoveRoute,
}: {
  agency: Agency;
  stations: Station[];
  isSuperAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAddRoute: (fromId: number, toId: number) => void;
  onRemoveRoute: (routeId: number) => void;
}) {
  const { t } = useTranslation();
  const [routeModal, setRouteModal] = useState(false);
  const [fromId, setFromId] = useState<number | null>(null);
  const [toId, setToId] = useState<number | null>(null);

  return (
    <View style={{
      backgroundColor: C.white, borderRadius: 20, padding: 16, marginBottom: 12,
      shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 3,
    }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.dark, fontWeight: "900", fontSize: 15 }}>{agency.name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
            <Ionicons name="star" size={14} color={C.yellow} />
            <Text style={{ color: C.mid, fontSize: 12 }}>
              {agency.average_rating > 0 ? agency.average_rating.toFixed(1) : "New"}{" "}({agency.ratings_count})
            </Text>
            <View style={{ backgroundColor: C.tealLt, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ color: C.teal, fontSize: 11, fontWeight: "700" }}>
                {agency.routes.length} {t("agencies.routes")}
              </Text>
            </View>
          </View>
          {agency.operating_hours ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
              <Ionicons name="time-outline" size={12} color={C.muted} />
              <Text style={{ color: C.muted, fontSize: 12 }}>{agency.operating_hours}</Text>
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity onPress={onEdit} style={{ padding: 6 }}>
            <Ionicons name="pencil" size={18} color={C.blue} />
          </TouchableOpacity>
          {isSuperAdmin && (
            <TouchableOpacity onPress={onDelete} style={{ padding: 6 }}>
              <Ionicons name="trash" size={18} color={C.orange} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isSuperAdmin && agency.routes.length > 0 && (
        <View style={{ marginTop: 12 }}>
          <Text style={{ color: C.muted, fontSize: 11, fontWeight: "700", marginBottom: 6, textTransform: "uppercase" }}>
            {t("agencies.routes")}
          </Text>
          {agency.routes.map((r) => (
            <View key={r.id} style={{
              flexDirection: "row", justifyContent: "space-between", alignItems: "center",
              backgroundColor: C.bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 4,
            }}>
              <Text style={{ color: C.dark, fontSize: 13, fontWeight: "600" }}>{r.from.city} → {r.to.city}</Text>
              <TouchableOpacity onPress={() => onRemoveRoute(r.id)} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={16} color={C.muted} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {!isSuperAdmin && agency.routes.length > 0 && (
        <View style={{ marginTop: 10 }}>
          <Text style={{ color: C.muted, fontSize: 11, fontWeight: "700", marginBottom: 6, textTransform: "uppercase" }}>
            Routes
          </Text>
          {agency.routes.map((r) => (
            <View key={r.id} style={{
              backgroundColor: C.bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 4,
            }}>
              <Text style={{ color: C.dark, fontSize: 13, fontWeight: "600" }}>{r.from.city} → {r.to.city}</Text>
            </View>
          ))}
        </View>
      )}

      {isSuperAdmin && (
        <TouchableOpacity
          onPress={() => { setRouteModal(true); setFromId(null); setToId(null); }}
          style={{ marginTop: 10, paddingVertical: 10, borderRadius: 10, backgroundColor: C.tealLt, alignItems: "center" }}
        >
          <Text style={{ color: C.teal, fontWeight: "700", fontSize: 13 }}>+ {t("agencies.addRoute")}</Text>
        </TouchableOpacity>
      )}

      {/* Route picker modal */}
      <Modal visible={routeModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
            <View style={{ width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginBottom: 20 }} />
            <Text style={{ fontWeight: "900", fontSize: 18, color: C.dark, marginBottom: 16 }}>{t("agencies.addRoute")}</Text>

            <Text style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>{t("trips.from")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {stations.filter((s) => s.id !== toId).map((s) => (
                  <TouchableOpacity key={s.id} onPress={() => setFromId(s.id)}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: fromId === s.id ? C.teal : C.bg }}>
                    <Text style={{ color: fromId === s.id ? C.white : C.dark, fontWeight: "700", fontSize: 13 }}>{s.city}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>{t("trips.to")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {stations.filter((s) => s.id !== fromId).map((s) => (
                  <TouchableOpacity key={s.id} onPress={() => setToId(s.id)}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: toId === s.id ? C.teal : C.bg }}>
                    <Text style={{ color: toId === s.id ? C.white : C.dark, fontWeight: "700", fontSize: 13 }}>{s.city}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity onPress={() => setRouteModal(false)}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: C.bg, alignItems: "center" }}>
                <Text style={{ color: C.mid, fontWeight: "700" }}>{t("common.cancel") ?? "Cancel"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { if (fromId && toId) { onAddRoute(fromId, toId); setRouteModal(false); } }}
                disabled={!fromId || !toId}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: fromId && toId ? C.teal : C.border, alignItems: "center" }}
              >
                <Text style={{ color: C.white, fontWeight: "800" }}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
