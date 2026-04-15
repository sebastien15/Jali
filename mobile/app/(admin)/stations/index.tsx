import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import AdminHeader from "@/components/admin/AdminHeader";
import { queryKeys } from "@/lib/queryKeys";

type StationType = "bus_station" | "custom";

type Station = {
  id: number;
  city: string;
  district: string | null;
  type: StationType;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  image_url: string | null;
  admin_id: number | null;
  admin_name: string | null;
  admin_email: string | null;
};

type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: string;
};

const TYPE_LABEL: Record<StationType, string> = {
  bus_station: "Bus Station",
  custom: "Custom",
};
const TYPE_COLOR: Record<StationType, string> = {
  bus_station: C.teal,
  custom: C.blue,
};
const TYPE_BG: Record<StationType, string> = {
  bus_station: C.tealLt,
  custom: C.blueLt,
};

const EMPTY_FORM = {
  city: "",
  district: "",
  type: "bus_station" as StationType,
  address: "",
  latitude: "",
  longitude: "",
  image_url: "",
  admin_id: null as number | null,
};

type FilterAssign = "all" | "assigned" | "unassigned";
type FilterType = "all" | StationType;

export default function AdminStationsScreen() {
  const queryClient = useQueryClient();

  // Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [editing, setEditing] = useState<Station | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [adminSearch, setAdminSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  // Filters
  const [citySearch, setCitySearch] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterAssign, setFilterAssign] = useState<FilterAssign>("all");

  const { data: stations = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: queryKeys.admin.stations(),
    queryFn: () => api.get("/admin/stations").then(r => r.data ?? []),
    staleTime: 2 * 60_000,
  });

  const { data: allAdmins = [] } = useQuery({
    queryKey: queryKeys.admin.users(),
    queryFn: () => api.get("/admin/users").then(r => r.data ?? []),
    staleTime: 2 * 60_000,
  });

  const admins = (allAdmins as AdminUser[]).filter(
    u => u.role === "admin" || u.role === "superadmin"
  );

  // ── Filtered list ──
  const filtered = useMemo(() => {
    return (stations as Station[]).filter((s) => {
      if (citySearch) {
        const q = citySearch.toLowerCase();
        const match =
          s.city.toLowerCase().includes(q) ||
          (s.district ?? "").toLowerCase().includes(q) ||
          (s.address ?? "").toLowerCase().includes(q);
        if (!match) return false;
      }
      if (filterType !== "all" && s.type !== filterType) return false;
      if (filterAssign === "assigned" && !s.admin_id) return false;
      if (filterAssign === "unassigned" && s.admin_id) return false;
      return true;
    });
  }, [stations, citySearch, filterType, filterAssign]);

  const filteredAdmins = useMemo(
    () =>
      admins.filter((a) =>
        a.name.toLowerCase().includes(adminSearch.toLowerCase()) ||
        a.email.toLowerCase().includes(adminSearch.toLowerCase()),
      ),
    [admins, adminSearch],
  );

  // ── Modal helpers ──
  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setAdminSearch("");
    setPickerOpen(false);
    setModalVisible(true);
  }

  function openEdit(s: Station) {
    setEditing(s);
    setForm({
      city: s.city,
      district: s.district ?? "",
      type: s.type,
      address: s.address ?? "",
      latitude: s.latitude != null ? String(s.latitude) : "",
      longitude: s.longitude != null ? String(s.longitude) : "",
      image_url: s.image_url ?? "",
      admin_id: s.admin_id,
    });
    setAdminSearch("");
    setPickerOpen(false);
    setModalVisible(true);
  }

  function closeModal() {
    setModalVisible(false);
    setEditing(null);
    setPickerOpen(false);
    setAdminSearch("");
  }

  async function pickCurrentLocation() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Location access is required to use this feature.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setForm((f) => ({
        ...f,
        latitude: loc.coords.latitude.toFixed(6),
        longitude: loc.coords.longitude.toFixed(6),
      }));
    } catch {
      Alert.alert("Error", "Could not get current location. Try again.");
    } finally {
      setLocating(false);
    }
  }

  async function handleSave() {
    if (!form.city.trim()) {
      Alert.alert("Required", "City name is required.");
      return;
    }
    const lat = form.latitude.trim() ? parseFloat(form.latitude) : null;
    const lng = form.longitude.trim() ? parseFloat(form.longitude) : null;
    if (form.latitude.trim() && isNaN(lat!)) {
      Alert.alert("Invalid", "Latitude must be a number."); return;
    }
    if (form.longitude.trim() && isNaN(lng!)) {
      Alert.alert("Invalid", "Longitude must be a number."); return;
    }

    const payload = {
      city: form.city.trim(),
      district: form.district.trim() || null,
      type: form.type,
      address: form.address.trim() || null,
      latitude: lat,
      longitude: lng,
      image_url: form.image_url.trim() || null,
      admin_id: form.admin_id,
    };

    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/admin/stations/${editing.id}`, payload);
      } else {
        await api.post("/admin/stations", payload);
      }
      closeModal();
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.stations() });
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.message ?? "Could not save station.");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(s: Station) {
    Alert.alert(
      "Remove station",
      `Remove "${s.city}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/admin/stations/${s.id}`);
              queryClient.invalidateQueries({ queryKey: queryKeys.admin.stations() });
            } catch (e: any) {
              Alert.alert("Error", e?.response?.data?.message ?? "Could not remove station.");
            }
          },
        },
      ],
    );
  }

  const selectedAdmin = admins.find((a) => a.id === form.admin_id);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />
      <AdminHeader title="Stations" />

      {/* ── Search + Filters ── */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 8 }}>
        {/* City search */}
        <View style={{
          flexDirection: "row", alignItems: "center",
          backgroundColor: C.white, borderRadius: 12,
          paddingHorizontal: 12, borderWidth: 1.5, borderColor: C.border,
        }}>
          <Ionicons name="search-outline" size={16} color={C.muted} />
          <TextInput
            value={citySearch}
            onChangeText={setCitySearch}
            placeholder="Search by city…"
            placeholderTextColor={C.muted}
            style={{ flex: 1, paddingVertical: 10, paddingLeft: 8, fontSize: 14, color: C.dark }}
          />
          {citySearch.length > 0 && (
            <TouchableOpacity onPress={() => setCitySearch("")}>
              <Ionicons name="close-circle" size={16} color={C.muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {/* Type filter */}
            {(["all", "bus_station", "custom"] as FilterType[]).map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setFilterType(t)}
                style={{
                  borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
                  backgroundColor: filterType === t ? C.teal : C.white,
                  borderWidth: 1.5, borderColor: filterType === t ? C.teal : C.border,
                }}
              >
                <Text style={{
                  fontSize: 12, fontWeight: "700",
                  color: filterType === t ? C.white : C.mid,
                }}>
                  {t === "all" ? "All Types" : t === "bus_station" ? "Bus Stations" : "Custom"}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={{ width: 1, backgroundColor: C.border, marginHorizontal: 2 }} />
            {/* Assignment filter */}
            {(["all", "assigned", "unassigned"] as FilterAssign[]).map((a) => (
              <TouchableOpacity
                key={a}
                onPress={() => setFilterAssign(a)}
                style={{
                  borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
                  backgroundColor: filterAssign === a ? C.purple : C.white,
                  borderWidth: 1.5, borderColor: filterAssign === a ? C.purple : C.border,
                }}
              >
                <Text style={{
                  fontSize: 12, fontWeight: "700",
                  color: filterAssign === a ? C.white : C.mid,
                }}>
                  {a === "all" ? "All" : a === "assigned" ? "Assigned" : "Unassigned"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {isLoading && <ActivityIndicator color={C.teal} style={{ marginTop: 32 }} />}

        {/* Empty state */}
        {!isLoading && (stations as Station[]).length === 0 && (
          <View style={{ alignItems: "center", marginTop: 60, gap: 16 }}>
            <View style={{
              backgroundColor: C.orangeLt, borderRadius: 24,
              width: 72, height: 72, alignItems: "center", justifyContent: "center",
            }}>
              <Ionicons name="location-outline" size={36} color={C.orange} />
            </View>
            <Text style={{ color: C.dark, fontWeight: "800", fontSize: 16 }}>No stations yet</Text>
            <Text style={{ color: C.muted, fontSize: 13, textAlign: "center", paddingHorizontal: 32 }}>
              Create your first station to start assigning admins to cities.
            </Text>
            <TouchableOpacity onPress={openCreate} style={{
              backgroundColor: C.teal, borderRadius: 14,
              paddingHorizontal: 24, paddingVertical: 14,
              flexDirection: "row", alignItems: "center", gap: 8,
            }}>
              <Ionicons name="add-circle-outline" size={18} color={C.white} />
              <Text style={{ color: C.white, fontWeight: "800", fontSize: 14 }}>Add Station</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* No results after filter */}
        {!isLoading && (stations as Station[]).length > 0 && filtered.length === 0 && (
          <View style={{ alignItems: "center", marginTop: 40, gap: 8 }}>
            <Ionicons name="filter-outline" size={32} color={C.border} />
            <Text style={{ color: C.muted, fontSize: 14 }}>No stations match your filters.</Text>
            <TouchableOpacity onPress={() => {
              setCitySearch(""); setFilterType("all"); setFilterAssign("all");
            }}>
              <Text style={{ color: C.teal, fontWeight: "700", fontSize: 13 }}>Clear filters</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Station cards */}
        {!isLoading && filtered.map((s) => (
          <View key={s.id} style={{
            backgroundColor: C.white, borderRadius: 20, marginBottom: 14,
            shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 10,
            shadowOffset: { width: 0, height: 2 }, elevation: 3, overflow: "hidden",
          }}>
            {s.image_url ? (
              <Image
                source={{ uri: s.image_url }}
                style={{ width: "100%", height: 120 }}
                resizeMode="cover"
              />
            ) : null}

            <View style={{ padding: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                <View style={{
                  backgroundColor: TYPE_BG[s.type],
                  borderRadius: 10, width: 36, height: 36,
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Ionicons
                    name={s.type === "bus_station" ? "bus-outline" : "location-outline"}
                    size={17} color={TYPE_COLOR[s.type]}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.dark, fontWeight: "900", fontSize: 16 }}>{s.city}</Text>
                  {s.district ? (
                    <Text style={{ color: C.mid, fontSize: 12, marginTop: 1 }}>{s.district}</Text>
                  ) : null}
                  <View style={{
                    alignSelf: "flex-start", marginTop: 3,
                    backgroundColor: TYPE_BG[s.type], borderRadius: 5,
                    paddingHorizontal: 6, paddingVertical: 1,
                  }}>
                    <Text style={{ color: TYPE_COLOR[s.type], fontSize: 10, fontWeight: "700" }}>
                      {TYPE_LABEL[s.type]}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => openEdit(s)}
                  style={{ backgroundColor: C.tealLt, borderRadius: 8, padding: 7 }}
                >
                  <Ionicons name="pencil-outline" size={14} color={C.teal} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => confirmDelete(s)}
                  style={{ backgroundColor: C.orangeLt, borderRadius: 8, padding: 7 }}
                >
                  <Ionicons name="trash-outline" size={14} color={C.orange} />
                </TouchableOpacity>
              </View>

              {s.address ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 }}>
                  <Ionicons name="map-outline" size={12} color={C.muted} />
                  <Text style={{ color: C.mid, fontSize: 12 }}>{s.address}</Text>
                </View>
              ) : null}

              {s.latitude != null && s.longitude != null ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 8 }}>
                  <Ionicons name="navigate-outline" size={12} color={C.muted} />
                  <Text style={{ color: C.muted, fontSize: 11, fontFamily: "monospace" }}>
                    {s.latitude.toFixed(6)}, {s.longitude.toFixed(6)}
                  </Text>
                </View>
              ) : (
                <View style={{ marginBottom: 8 }} />
              )}

              {s.admin_name ? (
                <TouchableOpacity
                  onPress={() => router.push(`/(admin)/users/${s.admin_id}` as any)}
                  style={{
                    backgroundColor: C.tealLt, borderRadius: 12, padding: 10,
                    flexDirection: "row", alignItems: "center", gap: 8,
                  }}
                >
                  <View style={{
                    backgroundColor: C.teal, borderRadius: 13,
                    width: 26, height: 26, alignItems: "center", justifyContent: "center",
                  }}>
                    <Text style={{ color: C.white, fontWeight: "900", fontSize: 10 }}>
                      {s.admin_name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.teal, fontWeight: "700", fontSize: 13 }}>{s.admin_name}</Text>
                    {s.admin_email && (
                      <Text style={{ color: C.muted, fontSize: 11 }}>{s.admin_email}</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={13} color={C.teal} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => openEdit(s)}
                  style={{
                    backgroundColor: C.bg, borderRadius: 12, padding: 10,
                    flexDirection: "row", alignItems: "center", gap: 8,
                    borderWidth: 1.5, borderColor: C.border,
                  }}
                >
                  <Ionicons name="person-add-outline" size={15} color={C.muted} />
                  <Text style={{ color: C.muted, fontWeight: "600", fontSize: 12 }}>
                    No admin assigned — tap to assign
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* FAB */}
      {!isLoading && (stations as Station[]).length > 0 && (
        <TouchableOpacity
          onPress={openCreate}
          style={{
            position: "absolute", bottom: 28, right: 24,
            backgroundColor: C.teal, borderRadius: 22, width: 56, height: 56,
            alignItems: "center", justifyContent: "center",
            shadowColor: C.teal, shadowOpacity: 0.4, shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 }, elevation: 8,
          }}
        >
          <Ionicons name="add" size={28} color={C.white} />
        </TouchableOpacity>
      )}

      {/* ── Add / Edit Modal ── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: C.bg }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Header */}
          <View style={{
            flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            paddingTop: 20, paddingHorizontal: 20, paddingBottom: 16,
            backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border,
          }}>
            <TouchableOpacity onPress={closeModal}>
              <Text style={{ color: C.muted, fontWeight: "700", fontSize: 15 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ color: C.dark, fontWeight: "900", fontSize: 16 }}>
              {editing ? "Edit Station" : "New Station"}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={C.teal} size="small" />
              ) : (
                <Text style={{ color: C.teal, fontWeight: "800", fontSize: 15 }}>
                  {editing ? "Update" : "Add"}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            {/* Type toggle */}
            <View>
              <Text style={labelStyle}>Type</Text>
              <View style={{
                flexDirection: "row", backgroundColor: C.white,
                borderRadius: 14, padding: 4,
                borderWidth: 1.5, borderColor: C.border,
              }}>
                {(["bus_station", "custom"] as StationType[]).map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setForm((f) => ({ ...f, type: t }))}
                    style={{
                      flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center",
                      backgroundColor: form.type === t ? C.teal : "transparent",
                    }}
                  >
                    <Text style={{
                      fontWeight: "700", fontSize: 13,
                      color: form.type === t ? C.white : C.mid,
                    }}>
                      {TYPE_LABEL[t]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View>
              <Text style={labelStyle}>Station Name *</Text>
              <TextInput value={form.city} onChangeText={(v) => setForm((f) => ({ ...f, city: v }))}
                placeholder="e.g. Nyabugogo Terminal" placeholderTextColor={C.muted} style={inputStyle} />
            </View>

            <View>
              <Text style={labelStyle}>District</Text>
              <TextInput value={form.district} onChangeText={(v) => setForm((f) => ({ ...f, district: v }))}
                placeholder="e.g. Nyarugenge, Gasabo" placeholderTextColor={C.muted} style={inputStyle} />
            </View>

            <View>
              <Text style={labelStyle}>Address</Text>
              <TextInput value={form.address} onChangeText={(v) => setForm((f) => ({ ...f, address: v }))}
                placeholder="e.g. KN 5 Rd, Nyarugenge" placeholderTextColor={C.muted} style={inputStyle} />
            </View>

            <View>
              <Text style={labelStyle}>Coordinates</Text>
              <Text style={{ color: C.muted, fontSize: 11, marginBottom: 8 }}>
                Decimal degrees · Rwanda: lat ≈ −2.0 to −1.0, lng ≈ 29.5 to 30.9
              </Text>
              <TouchableOpacity
                onPress={pickCurrentLocation}
                disabled={locating}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
                  backgroundColor: C.card, borderWidth: 1, borderColor: C.primary,
                  borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 10,
                  opacity: locating ? 0.6 : 1,
                }}
              >
                {locating ? (
                  <ActivityIndicator size="small" color={C.primary} />
                ) : (
                  <Ionicons name="navigate" size={14} color={C.primary} />
                )}
                <Text style={{ color: C.primary, fontSize: 13, fontWeight: "600" }}>
                  {locating ? "Getting location…" : "Use current location"}
                </Text>
              </TouchableOpacity>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.mid, fontSize: 12, fontWeight: "600", marginBottom: 4 }}>Latitude</Text>
                  <TextInput value={form.latitude} onChangeText={(v) => setForm((f) => ({ ...f, latitude: v }))}
                    placeholder="-1.944648" keyboardType="decimal-pad" placeholderTextColor={C.muted} style={inputStyle} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.mid, fontSize: 12, fontWeight: "600", marginBottom: 4 }}>Longitude</Text>
                  <TextInput value={form.longitude} onChangeText={(v) => setForm((f) => ({ ...f, longitude: v }))}
                    placeholder="30.061088" keyboardType="decimal-pad" placeholderTextColor={C.muted} style={inputStyle} />
                </View>
              </View>
            </View>

            <View>
              <Text style={labelStyle}>Image URL (optional)</Text>
              <TextInput value={form.image_url} onChangeText={(v) => setForm((f) => ({ ...f, image_url: v }))}
                placeholder="https://…" placeholderTextColor={C.muted}
                autoCapitalize="none" keyboardType="url" style={inputStyle} />
            </View>

            {/* Admin picker */}
            <View>
              <Text style={labelStyle}>Assigned Admin</Text>
              <TouchableOpacity
                onPress={() => setPickerOpen((o) => !o)}
                style={{ ...inputStyle, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
              >
                <Text style={{ fontSize: 15, fontWeight: "600", color: selectedAdmin ? C.dark : C.muted }}>
                  {selectedAdmin ? selectedAdmin.name : "None (unassigned)"}
                </Text>
                <Ionicons name={pickerOpen ? "chevron-up" : "chevron-down"} size={16} color={C.muted} />
              </TouchableOpacity>

              {pickerOpen && (
                <View style={{
                  backgroundColor: C.white, borderRadius: 14,
                  borderWidth: 1.5, borderColor: C.border, marginTop: 4,
                }}>
                  <View style={{
                    flexDirection: "row", alignItems: "center",
                    paddingHorizontal: 12, paddingVertical: 8,
                    borderBottomWidth: 1, borderBottomColor: C.border,
                  }}>
                    <Ionicons name="search-outline" size={14} color={C.muted} />
                    <TextInput
                      value={adminSearch} onChangeText={setAdminSearch}
                      placeholder="Search admin by name or email…" placeholderTextColor={C.muted}
                      style={{ flex: 1, paddingLeft: 8, fontSize: 13, color: C.dark, paddingVertical: 2 }}
                      autoCapitalize="none"
                    />
                  </View>

                  <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled>
                    <TouchableOpacity
                      onPress={() => { setForm((f) => ({ ...f, admin_id: null })); setPickerOpen(false); setAdminSearch(""); }}
                      style={{
                        padding: 14, borderBottomWidth: 1, borderBottomColor: C.border,
                        backgroundColor: form.admin_id === null ? C.tealLt : C.white,
                      }}
                    >
                      <Text style={{
                        color: form.admin_id === null ? C.teal : C.muted,
                        fontWeight: form.admin_id === null ? "700" : "500", fontSize: 14,
                      }}>
                        None (unassigned)
                      </Text>
                    </TouchableOpacity>

                    {filteredAdmins.length === 0 && adminSearch.length > 0 && (
                      <View style={{ padding: 16, alignItems: "center" }}>
                        <Text style={{ color: C.muted, fontSize: 13 }}>No admins match "{adminSearch}"</Text>
                      </View>
                    )}

                    {filteredAdmins.map((a) => (
                      <TouchableOpacity
                        key={a.id}
                        onPress={() => { setForm((f) => ({ ...f, admin_id: a.id })); setPickerOpen(false); setAdminSearch(""); }}
                        style={{
                          padding: 12, borderBottomWidth: 1, borderBottomColor: C.border,
                          backgroundColor: form.admin_id === a.id ? C.tealLt : C.white,
                          flexDirection: "row", alignItems: "center", gap: 10,
                        }}
                      >
                        <View style={{
                          backgroundColor: form.admin_id === a.id ? C.teal : C.border,
                          borderRadius: 13, width: 26, height: 26,
                          alignItems: "center", justifyContent: "center",
                        }}>
                          <Text style={{
                            color: form.admin_id === a.id ? C.white : C.mid,
                            fontWeight: "800", fontSize: 11,
                          }}>
                            {a.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: form.admin_id === a.id ? C.teal : C.dark, fontWeight: "700", fontSize: 14 }}>
                            {a.name}
                          </Text>
                          <Text style={{ color: C.muted, fontSize: 11 }}>{a.email}</Text>
                        </View>
                        {form.admin_id === a.id && <Ionicons name="checkmark" size={16} color={C.teal} />}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const labelStyle = {
  color: C.mid,
  fontWeight: "700" as const,
  fontSize: 12,
  marginBottom: 6,
  textTransform: "uppercase" as const,
  letterSpacing: 0.4,
};

const inputStyle = {
  backgroundColor: C.white,
  borderRadius: 14,
  paddingHorizontal: 14,
  paddingVertical: 14,
  fontSize: 15,
  color: C.dark,
  fontWeight: "600" as const,
  borderWidth: 1.5,
  borderColor: C.border,
};
