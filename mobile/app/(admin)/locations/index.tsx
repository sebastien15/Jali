import { useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import AdminHeader from "@/components/admin/AdminHeader";
import { queryKeys } from "@/lib/queryKeys";
import { useTranslation } from "react-i18next";

type LocationType = "bus_station" | "custom";

type Corridor = {
  code: string;
  name: string;
  description: string;
  stop_order: number;
  agencies: string[];
};

type LocationItem = {
  id: number;
  name: string;
  type: LocationType;
  city: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  province: string | null;
  corridors: Corridor[];
};

const TYPE_LABEL: Record<LocationType, string> = {
  bus_station: "Bus Station",
  custom: "Custom Stop",
};
const TYPE_COLOR: Record<LocationType, string> = {
  bus_station: C.teal,
  custom: C.blue,
};
const TYPE_BG: Record<LocationType, string> = {
  bus_station: C.tealLt,
  custom: C.blueLt,
};

const EMPTY_FORM = {
  name: "",
  type: "bus_station" as LocationType,
  city: "",
  address: "",
  latitude: "",
  longitude: "",
};

export default function LocationsScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [editing, setEditing] = useState<LocationItem | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const { data: locations = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: queryKeys.admin.locations(),
    queryFn: () => api.get("/admin/locations").then(r => r.data ?? []),
    staleTime: 5 * 60_000,
  });

  function toggleExpand(id: number) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  }

  function openEdit(loc: LocationItem) {
    setEditing(loc);
    setForm({
      name: loc.name,
      type: loc.type,
      city: loc.city,
      address: loc.address ?? "",
      latitude: loc.latitude != null ? String(loc.latitude) : "",
      longitude: loc.longitude != null ? String(loc.longitude) : "",
    });
    setModalVisible(true);
  }

  function closeModal() {
    setModalVisible(false);
    setEditing(null);
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
    if (!form.name.trim() || !form.city.trim()) {
      Alert.alert("Required", "Name and city are required.");
      return;
    }

    const lat = form.latitude.trim() ? parseFloat(form.latitude) : null;
    const lng = form.longitude.trim() ? parseFloat(form.longitude) : null;

    if (form.latitude.trim() && isNaN(lat!)) { Alert.alert("Invalid", "Latitude must be a number."); return; }
    if (form.longitude.trim() && isNaN(lng!)) { Alert.alert("Invalid", "Longitude must be a number."); return; }

    const payload = {
      name: form.name.trim(),
      type: form.type,
      city: form.city.trim(),
      address: form.address.trim() || null,
      latitude: lat,
      longitude: lng,
    };

    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/admin/locations/${editing.id}`, payload);
      } else {
        await api.post("/admin/locations", payload);
      }
      closeModal();
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.locations() });
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.message ?? "Could not save location.");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(loc: LocationItem) {
    Alert.alert(
      "Delete location",
      `Delete "${loc.name}" (${loc.city})? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/admin/locations/${loc.id}`);
              queryClient.invalidateQueries({ queryKey: queryKeys.admin.locations() });
            } catch (e: any) {
              Alert.alert("Cannot delete", e?.response?.data?.error ?? "This location is in use.");
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />
      <AdminHeader title="Bus Stop Locations" />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {isLoading && <ActivityIndicator color={C.teal} style={{ marginTop: 32 }} />}

        {!isLoading && (locations as LocationItem[]).length === 0 && (
          <View style={{ alignItems: "center", marginTop: 60 }}>
            <Ionicons name="location-outline" size={48} color={C.border} />
            <Text style={{ color: C.muted, marginTop: 12, fontSize: 14 }}>
              No locations yet. Tap + to add one.
            </Text>
          </View>
        )}

        {!isLoading && (locations as LocationItem[]).map((loc) => {
          const isExpanded = !!expanded[loc.id];
          const hasCorridor = loc.corridors && loc.corridors.length > 0;

          return (
            <View
              key={loc.id}
              style={{
                backgroundColor: C.white,
                borderRadius: 20,
                marginBottom: 12,
                shadowColor: "#000",
                shadowOpacity: 0.07,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 2 },
                elevation: 3,
                overflow: "hidden",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", padding: 16, gap: 12 }}>
                <View style={{
                  backgroundColor: TYPE_BG[loc.type], borderRadius: 12,
                  width: 44, height: 44, alignItems: "center", justifyContent: "center", marginTop: 2,
                }}>
                  <Ionicons
                    name={loc.type === "bus_station" ? "bus-outline" : "location-outline"}
                    size={20} color={TYPE_COLOR[loc.type]}
                  />
                </View>

                <View style={{ flex: 1, gap: 3 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Text style={{ color: C.dark, fontWeight: "800", fontSize: 14 }}>{loc.name}</Text>
                    <View style={{ backgroundColor: TYPE_BG[loc.type], borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 }}>
                      <Text style={{ color: TYPE_COLOR[loc.type], fontSize: 9, fontWeight: "700" }}>{TYPE_LABEL[loc.type]}</Text>
                    </View>
                  </View>
                  <Text style={{ color: C.mid, fontSize: 12, fontWeight: "600" }}>
                    {[loc.province, loc.city].filter(Boolean).join(" · ")}
                    {loc.address ? ` · ${loc.address}` : ""}
                  </Text>
                  {loc.latitude != null && loc.longitude != null && (
                    <Text style={{ color: C.muted, fontSize: 11 }}>
                      {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                    </Text>
                  )}
                  {hasCorridor && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
                      {loc.corridors.map((c) => (
                        <View key={c.code} style={{ backgroundColor: "#EEF6FF", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: "#BFDBFE" }}>
                          <Text style={{ color: "#1D4ED8", fontSize: 10, fontWeight: "800" }}>{c.code}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                <View style={{ flexDirection: "column", gap: 6, alignItems: "center" }}>
                  <TouchableOpacity onPress={() => openEdit(loc)} style={{ backgroundColor: C.tealLt, borderRadius: 10, padding: 9 }}>
                    <Ionicons name="pencil-outline" size={16} color={C.teal} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmDelete(loc)} style={{ backgroundColor: C.orangeLt, borderRadius: 10, padding: 9 }}>
                    <Ionicons name="trash-outline" size={16} color={C.orange} />
                  </TouchableOpacity>
                </View>
              </View>

              {hasCorridor && (
                <TouchableOpacity
                  onPress={() => toggleExpand(loc.id)}
                  style={{
                    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
                    paddingVertical: 9, borderTopWidth: 1, borderTopColor: C.border,
                    backgroundColor: isExpanded ? "#F0FDFA" : C.bg,
                  }}
                >
                  <Text style={{ color: C.teal, fontSize: 12, fontWeight: "700" }}>
                    {isExpanded ? "Hide corridors & agencies" : `${loc.corridors.length} corridor${loc.corridors.length > 1 ? "s" : ""} · tap to expand`}
                  </Text>
                  <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={14} color={C.teal} />
                </TouchableOpacity>
              )}

              {hasCorridor && isExpanded && (
                <View style={{ borderTopWidth: 1, borderTopColor: C.border }}>
                  {loc.corridors.map((corridor, idx) => (
                    <View key={corridor.code} style={{ padding: 14, borderBottomWidth: idx < loc.corridors.length - 1 ? 1 : 0, borderBottomColor: C.border }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <View style={{ backgroundColor: "#EEF6FF", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: "#BFDBFE" }}>
                          <Text style={{ color: "#1D4ED8", fontSize: 11, fontWeight: "900" }}>{corridor.code}</Text>
                        </View>
                        <Text style={{ color: C.dark, fontSize: 13, fontWeight: "700", flex: 1 }}>{corridor.name}</Text>
                        <Text style={{ color: C.muted, fontSize: 10, fontWeight: "600" }}>Stop #{corridor.stop_order}</Text>
                      </View>
                      <Text style={{ color: C.mid, fontSize: 11, marginBottom: 8 }}>{corridor.description}</Text>
                      {corridor.agencies.length > 0 ? (
                        <View>
                          <Text style={{ color: C.muted, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 5 }}>
                            Agencies on this corridor
                          </Text>
                          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
                            {corridor.agencies.map((agency) => (
                              <View key={agency} style={{ backgroundColor: "#F0FDF4", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "#BBF7D0" }}>
                                <Text style={{ color: "#15803D", fontSize: 11, fontWeight: "600" }}>{agency}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      ) : (
                        <Text style={{ color: C.muted, fontSize: 11, fontStyle: "italic" }}>No agencies assigned</Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* FAB */}
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

      {/* Create / Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={{
            flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            paddingTop: 20, paddingHorizontal: 20, paddingBottom: 16,
            backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border,
          }}>
            <TouchableOpacity onPress={closeModal}>
              <Text style={{ color: C.muted, fontWeight: "700", fontSize: 15 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ color: C.dark, fontWeight: "900", fontSize: 16 }}>
              {editing ? "Edit Location" : "New Location"}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={C.teal} size="small" />
              ) : (
                <Text style={{ color: C.teal, fontWeight: "800", fontSize: 15 }}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            <View>
              <Text style={labelStyle}>Type</Text>
              <View style={{ flexDirection: "row", backgroundColor: C.white, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: C.border }}>
                {(["bus_station", "custom"] as LocationType[]).map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setForm((f) => ({ ...f, type: t }))}
                    style={{ flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center", backgroundColor: form.type === t ? C.teal : "transparent" }}
                  >
                    <Text style={{ fontWeight: "700", fontSize: 13, color: form.type === t ? C.white : C.mid }}>{TYPE_LABEL[t]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Field label="Name *" placeholder="e.g. Nyabugogo Bus Terminal" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} />
            <Field label="City *" placeholder="e.g. Kigali" value={form.city} onChangeText={(v) => setForm((f) => ({ ...f, city: v }))} />
            <Field label="Address" placeholder="e.g. KN 5 Rd, Nyarugenge" value={form.address} onChangeText={(v) => setForm((f) => ({ ...f, address: v }))} />

            <View>
              <Text style={labelStyle}>Coordinates (optional)</Text>
              <Text style={{ color: C.muted, fontSize: 11, marginBottom: 8 }}>Decimal degrees · e.g. latitude -1.944648, longitude 30.061088</Text>
              <TouchableOpacity
                onPress={pickCurrentLocation} disabled={locating}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: C.white, borderWidth: 1, borderColor: C.teal, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 10, opacity: locating ? 0.6 : 1 }}
              >
                {locating ? <ActivityIndicator size="small" color={C.teal} /> : <Ionicons name="navigate" size={14} color={C.teal} />}
                <Text style={{ color: C.teal, fontSize: 13, fontWeight: "600" }}>{locating ? t("admin.gettingLocation") : t("admin.useCurrentLocation")}</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.mid, fontSize: 12, fontWeight: "600", marginBottom: 4 }}>Latitude</Text>
                  <TextInput value={form.latitude} onChangeText={(v) => setForm((f) => ({ ...f, latitude: v }))}
                    placeholder="-1.944648" keyboardType="decimal-pad" style={inputStyle} placeholderTextColor={C.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.mid, fontSize: 12, fontWeight: "600", marginBottom: 4 }}>Longitude</Text>
                  <TextInput value={form.longitude} onChangeText={(v) => setForm((f) => ({ ...f, longitude: v }))}
                    placeholder="30.061088" keyboardType="decimal-pad" style={inputStyle} placeholderTextColor={C.muted} />
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function Field({ label, placeholder, value, onChangeText }: { label: string; placeholder: string; value: string; onChangeText: (v: string) => void }) {
  return (
    <View>
      <Text style={labelStyle}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={C.muted} style={inputStyle} />
    </View>
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
