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
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import AdminHeader from "@/components/admin/AdminHeader";

type LocationType = "bus_station" | "custom";

type Location = {
  id: number;
  name: string;
  type: LocationType;
  city: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
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
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await api.get("/admin/locations");
      setLocations(res.data);
    } catch {
      setLocations([]);
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  }

  function openEdit(loc: Location) {
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

    if (form.latitude.trim() && isNaN(lat!)) {
      Alert.alert("Invalid", "Latitude must be a number.");
      return;
    }
    if (form.longitude.trim() && isNaN(lng!)) {
      Alert.alert("Invalid", "Longitude must be a number.");
      return;
    }

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
      load(true);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.message ?? "Could not save location.");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(loc: Location) {
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
              load(true);
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />
        }
      >
        {loading && (
          <ActivityIndicator color={C.teal} style={{ marginTop: 32 }} />
        )}

        {!loading && locations.length === 0 && (
          <View style={{ alignItems: "center", marginTop: 60 }}>
            <Ionicons name="location-outline" size={48} color={C.border} />
            <Text style={{ color: C.muted, marginTop: 12, fontSize: 14 }}>
              No locations yet. Tap + to add one.
            </Text>
          </View>
        )}

        {!loading &&
          locations.map((loc) => (
            <View
              key={loc.id}
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
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              {/* Icon */}
              <View
                style={{
                  backgroundColor: TYPE_BG[loc.type],
                  borderRadius: 12,
                  width: 44,
                  height: 44,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name={loc.type === "bus_station" ? "bus-outline" : "location-outline"}
                  size={20}
                  color={TYPE_COLOR[loc.type]}
                />
              </View>

              {/* Info */}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <Text style={{ color: C.dark, fontWeight: "800", fontSize: 14 }}>
                    {loc.name}
                  </Text>
                  <View
                    style={{
                      backgroundColor: TYPE_BG[loc.type],
                      borderRadius: 5,
                      paddingHorizontal: 5,
                      paddingVertical: 1,
                    }}
                  >
                    <Text style={{ color: TYPE_COLOR[loc.type], fontSize: 9, fontWeight: "700" }}>
                      {TYPE_LABEL[loc.type]}
                    </Text>
                  </View>
                </View>
                <Text style={{ color: C.mid, fontSize: 12, fontWeight: "600" }}>
                  {loc.city}
                  {loc.address ? ` · ${loc.address}` : ""}
                </Text>
                {loc.latitude != null && loc.longitude != null && (
                  <Text style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
                    {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                  </Text>
                )}
              </View>

              {/* Actions */}
              <View style={{ flexDirection: "row", gap: 6 }}>
                <TouchableOpacity
                  onPress={() => openEdit(loc)}
                  style={{
                    backgroundColor: C.tealLt,
                    borderRadius: 10,
                    padding: 9,
                  }}
                >
                  <Ionicons name="pencil-outline" size={16} color={C.teal} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => confirmDelete(loc)}
                  style={{
                    backgroundColor: C.orangeLt,
                    borderRadius: 10,
                    padding: 9,
                  }}
                >
                  <Ionicons name="trash-outline" size={16} color={C.orange} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        onPress={openCreate}
        style={{
          position: "absolute",
          bottom: 28,
          right: 24,
          backgroundColor: C.teal,
          borderRadius: 22,
          width: 56,
          height: 56,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: C.teal,
          shadowOpacity: 0.4,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        }}
      >
        <Ionicons name="add" size={28} color={C.white} />
      </TouchableOpacity>

      {/* Create / Edit Modal */}
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
          {/* Modal header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: 20,
              paddingHorizontal: 20,
              paddingBottom: 16,
              backgroundColor: C.white,
              borderBottomWidth: 1,
              borderBottomColor: C.border,
            }}
          >
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
            {/* Type toggle */}
            <View>
              <Text style={labelStyle}>Type</Text>
              <View
                style={{
                  flexDirection: "row",
                  backgroundColor: C.white,
                  borderRadius: 14,
                  padding: 4,
                  borderWidth: 1,
                  borderColor: C.border,
                }}
              >
                {(["bus_station", "custom"] as LocationType[]).map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setForm((f) => ({ ...f, type: t }))}
                    style={{
                      flex: 1,
                      borderRadius: 10,
                      paddingVertical: 10,
                      alignItems: "center",
                      backgroundColor: form.type === t ? C.teal : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        fontWeight: "700",
                        fontSize: 13,
                        color: form.type === t ? C.white : C.mid,
                      }}
                    >
                      {TYPE_LABEL[t]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Name */}
            <Field
              label="Name *"
              placeholder="e.g. Nyabugogo Bus Terminal"
              value={form.name}
              onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
            />

            {/* City */}
            <Field
              label="City *"
              placeholder="e.g. Kigali"
              value={form.city}
              onChangeText={(v) => setForm((f) => ({ ...f, city: v }))}
            />

            {/* Address */}
            <Field
              label="Address"
              placeholder="e.g. KN 5 Rd, Nyarugenge"
              value={form.address}
              onChangeText={(v) => setForm((f) => ({ ...f, address: v }))}
            />

            {/* Coordinates */}
            <View>
              <Text style={labelStyle}>Coordinates (optional)</Text>
              <Text style={{ color: C.muted, fontSize: 11, marginBottom: 8 }}>
                Decimal degrees · e.g. latitude -1.944648, longitude 30.061088
              </Text>
              <TouchableOpacity
                onPress={pickCurrentLocation}
                disabled={locating}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  alignSelf: "flex-start",
                  backgroundColor: C.card,
                  borderWidth: 1,
                  borderColor: C.primary,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  marginBottom: 10,
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
                  <Text style={{ color: C.mid, fontSize: 12, fontWeight: "600", marginBottom: 4 }}>
                    Latitude
                  </Text>
                  <TextInput
                    value={form.latitude}
                    onChangeText={(v) => setForm((f) => ({ ...f, latitude: v }))}
                    placeholder="-1.944648"
                    keyboardType="decimal-pad"
                    style={inputStyle}
                    placeholderTextColor={C.muted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.mid, fontSize: 12, fontWeight: "600", marginBottom: 4 }}>
                    Longitude
                  </Text>
                  <TextInput
                    value={form.longitude}
                    onChangeText={(v) => setForm((f) => ({ ...f, longitude: v }))}
                    placeholder="30.061088"
                    keyboardType="decimal-pad"
                    style={inputStyle}
                    placeholderTextColor={C.muted}
                  />
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChangeText,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
}) {
  return (
    <View>
      <Text style={labelStyle}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        style={inputStyle}
      />
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
