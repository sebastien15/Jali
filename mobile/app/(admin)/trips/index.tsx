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
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { useTranslation } from "react-i18next";
import AdminHeader from "@/components/admin/AdminHeader";
import { queryKeys } from "@/lib/queryKeys";

type Station = { id: number; city: string; district: string | null };
type Agency = { id: number; name: string };

type TripData = {
  id: number;
  agency_id: number;
  agency_name: string;
  from: { id: number; city: string; district: string | null };
  to: { id: number; city: string; district: string | null };
  departure_time: string;
  estimated_arrival_time: string;
  price: number;
  total_seats: number;
  active: boolean;
};

export default function TripsScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [filterAgency, setFilterAgency] = useState<number | null>(null);
  const [filterActive, setFilterActive] = useState<boolean | null>(null);
  const [agencyDropdownOpen, setAgencyDropdownOpen] = useState(false);
  const [agencySearch, setAgencySearch] = useState("");
  const [modal, setModal] = useState<{
    mode: "create" | "edit";
    trip?: TripData;
  } | null>(null);
  const [form, setForm] = useState({
    agency_id: "",
    from_station_id: "",
    to_station_id: "",
    departure_time: "",
    estimated_arrival_time: "",
    price: "",
    total_seats: "30",
    active: true,
  });
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const tripFilters = { agency_id: filterAgency, active: filterActive };

  const tripsQuery = useQuery({
    queryKey: queryKeys.admin.trips(tripFilters),
    queryFn: () => {
      const params: any = {};
      if (filterAgency) params.agency_id = filterAgency;
      if (filterActive !== null) params.active = filterActive ? "1" : "0";
      return api.get("/admin/trips", { params }).then(r => r.data ?? []);
    },
    staleTime: 60_000,
  });

  const agenciesQuery = useQuery({
    queryKey: queryKeys.admin.agencies(),
    queryFn: () => api.get("/admin/agencies").then(r => r.data ?? []),
    staleTime: 5 * 60_000,
  });

  const stationsQuery = useQuery({
    queryKey: queryKeys.stations.public(),
    queryFn: () => api.get("/stations").then(r => r.data ?? []),
    staleTime: 10 * 60_000,
  });

  const trips    = tripsQuery.data as TripData[] ?? [];
  const agencies = agenciesQuery.data as Agency[] ?? [];
  const stations = stationsQuery.data as Station[] ?? [];

  const isLoading    = tripsQuery.isLoading;
  const isRefetching = tripsQuery.isRefetching;

  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(""), 2000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  function openCreate() {
    setModal({ mode: "create" });
    setForm({
      agency_id: "",
      from_station_id: "",
      to_station_id: "",
      departure_time: "",
      estimated_arrival_time: "",
      price: "",
      total_seats: "30",
      active: true,
    });
  }

  function openEdit(trip: TripData) {
    setModal({ mode: "edit", trip });
    setForm({
      agency_id: String(trip.agency_id),
      from_station_id: String(trip.from.id),
      to_station_id: String(trip.to.id),
      departure_time: trip.departure_time,
      estimated_arrival_time: trip.estimated_arrival_time,
      price: String(trip.price),
      total_seats: String(trip.total_seats),
      active: trip.active,
    });
  }

  async function handleSave() {
    if (
      !form.agency_id || !form.from_station_id || !form.to_station_id ||
      !form.departure_time || !form.estimated_arrival_time || !form.price || !form.total_seats
    ) {
      Alert.alert(t("common.close"), "Please fill in all fields");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        agency_id: Number(form.agency_id),
        from_station_id: Number(form.from_station_id),
        to_station_id: Number(form.to_station_id),
        departure_time: form.departure_time,
        estimated_arrival_time: form.estimated_arrival_time,
        price: Number(form.price),
        total_seats: Number(form.total_seats),
        active: form.active,
      };

      if (modal?.mode === "create") {
        await api.post("/admin/trips", payload);
        setSuccessMsg(t("adminTrips.created"));
      } else if (modal?.trip) {
        await api.patch(`/admin/trips/${modal.trip.id}`, payload);
        setSuccessMsg(t("adminTrips.updated"));
      }

      setModal(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.trips() });
    } catch (e: any) {
      Alert.alert(t("common.close"), e?.response?.data?.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(trip: TripData) {
    Alert.alert(t("adminTrips.title"), t("adminTrips.deleteConfirm"), [
      { text: t("common.cancel") ?? "Cancel", style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/admin/trips/${trip.id}`);
            setSuccessMsg(t("adminTrips.deleted"));
            queryClient.invalidateQueries({ queryKey: queryKeys.admin.trips() });
          } catch (e: any) {
            Alert.alert(t("common.close"), e?.response?.data?.message ?? "Failed");
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />
      <AdminHeader
        title={t("adminTrips.title")}
        right={
          <TouchableOpacity
            onPress={openCreate}
            style={{
              backgroundColor: "rgba(255,255,255,0.2)",
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <Text style={{ color: C.white, fontWeight: "800", fontSize: 18 }}>+</Text>
          </TouchableOpacity>
        }
      />

      {/* Success banner */}
      {successMsg ? (
        <View style={{ backgroundColor: C.greenLt, padding: 12, marginHorizontal: 16, borderRadius: 10 }}>
          <Text style={{ color: C.green, fontWeight: "700", fontSize: 13 }}>{successMsg}</Text>
        </View>
      ) : null}

      {/* Filters */}
      <View style={{ backgroundColor: C.white, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <TouchableOpacity
          onPress={() => { setAgencyDropdownOpen(true); setAgencySearch(""); }}
          style={{
            flex: 1, flexDirection: "row", alignItems: "center", gap: 6,
            backgroundColor: C.bg, borderRadius: 10,
            paddingHorizontal: 12, paddingVertical: 8,
            borderWidth: 1.5, borderColor: C.border,
          }}
        >
          <Ionicons name="search-outline" size={14} color={C.muted} />
          <Text numberOfLines={1} style={{ color: filterAgency ? C.dark : C.muted, fontWeight: "700", fontSize: 12, flex: 1 }}>
            {filterAgency ? agencies.find(a => a.id === filterAgency)?.name ?? "Agency" : "Filter by agency…"}
          </Text>
          {filterAgency && (
            <TouchableOpacity onPress={(e) => { e.stopPropagation(); setFilterAgency(null); }} style={{ padding: 2 }}>
              <Ionicons name="close-circle" size={14} color={C.muted} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setFilterActive(filterActive === null ? true : filterActive === true ? false : null)}
          style={{
            paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
            backgroundColor: filterActive === null ? C.bg : filterActive ? C.greenLt : C.muted + "33",
          }}
        >
          <Text style={{ color: filterActive === null ? C.muted : filterActive ? C.green : C.muted, fontWeight: "700", fontSize: 11 }}>
            {filterActive === null ? "All" : filterActive ? "Active" : "Inactive"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={tripsQuery.refetch} />}
      >
        {isLoading && <ActivityIndicator color={C.teal} style={{ marginTop: 32 }} />}

        {!isLoading && trips.length === 0 && (
          <Text style={{ color: C.muted, textAlign: "center", marginTop: 40 }}>{t("adminTrips.noTrips")}</Text>
        )}

        {!isLoading && trips.map((trip) => (
          <TripCard key={trip.id} trip={trip} onEdit={() => openEdit(trip)} onDelete={() => handleDelete(trip)} />
        ))}
      </ScrollView>

      {/* Create/Edit Modal */}
      <Modal visible={!!modal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: "90%" }}>
            <View style={{ width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 }} />
            <Text style={{ fontWeight: "900", fontSize: 18, color: C.dark, marginBottom: 16 }}>
              {modal?.mode === "create" ? t("adminTrips.addNew") : t("adminTrips.editTrip")}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <FieldLabel>{t("adminTrips.agency")}</FieldLabel>
              <PickerRow
                options={agencies.map((a) => ({ label: a.name, value: String(a.id) }))}
                value={form.agency_id}
                onChange={(v) => setForm((f) => ({ ...f, agency_id: v }))}
              />

              <FieldLabel>{t("adminTrips.from")}</FieldLabel>
              <PickerRow
                options={stations.filter((s) => s.id !== Number(form.to_station_id)).map((s) => ({ label: s.city, value: String(s.id) }))}
                value={form.from_station_id}
                onChange={(v) => setForm((f) => ({ ...f, from_station_id: v }))}
              />

              <FieldLabel>{t("adminTrips.to")}</FieldLabel>
              <PickerRow
                options={stations.filter((s) => s.id !== Number(form.from_station_id)).map((s) => ({ label: s.city, value: String(s.id) }))}
                value={form.to_station_id}
                onChange={(v) => setForm((f) => ({ ...f, to_station_id: v }))}
              />

              <FieldLabel>{t("adminTrips.departure")}</FieldLabel>
              <TextInput value={form.departure_time} onChangeText={(v) => setForm((f) => ({ ...f, departure_time: v }))}
                placeholder="08:00" placeholderTextColor={C.muted} keyboardType="numeric" style={inputStyle} />

              <FieldLabel>{t("adminTrips.estimatedArrival")}</FieldLabel>
              <TextInput value={form.estimated_arrival_time} onChangeText={(v) => setForm((f) => ({ ...f, estimated_arrival_time: v }))}
                placeholder="11:30" placeholderTextColor={C.muted} keyboardType="numeric" style={inputStyle} />

              <FieldLabel>{t("adminTrips.price")}</FieldLabel>
              <TextInput value={form.price} onChangeText={(v) => setForm((f) => ({ ...f, price: v }))}
                placeholder="5000" placeholderTextColor={C.muted} keyboardType="number-pad" style={inputStyle} />

              <FieldLabel>{t("adminTrips.totalSeats")}</FieldLabel>
              <TextInput value={form.total_seats} onChangeText={(v) => setForm((f) => ({ ...f, total_seats: v }))}
                placeholder="30" placeholderTextColor={C.muted} keyboardType="number-pad" style={inputStyle} />

              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, marginBottom: 16 }}>
                <Text style={{ color: C.dark, fontWeight: "700", fontSize: 14 }}>{t("adminTrips.active")}</Text>
                <Switch value={form.active} onValueChange={(v) => setForm((f) => ({ ...f, active: v }))}
                  trackColor={{ false: C.border, true: C.teal }} thumbColor={C.white} />
              </View>
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <TouchableOpacity onPress={() => setModal(null)}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: C.bg, alignItems: "center" }}>
                <Text style={{ color: C.mid, fontWeight: "700" }}>{t("common.cancel") ?? "Cancel"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} disabled={saving}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: saving ? C.border : C.teal, alignItems: "center" }}>
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: C.white, fontWeight: "800" }}>
                    {modal?.mode === "create" ? "Add Trip" : "Update Trip"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Agency search dropdown modal */}
      <Modal visible={agencyDropdownOpen} animationType="fade" transparent>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)" }}
          activeOpacity={1}
          onPress={() => setAgencyDropdownOpen(false)}
        >
          <View style={{
            backgroundColor: C.white, borderRadius: 16,
            marginHorizontal: 24, marginTop: 60, maxHeight: 300,
            shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 }, elevation: 8,
          }}>
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 8,
              paddingHorizontal: 14, paddingVertical: 12,
              borderBottomWidth: 1, borderBottomColor: C.border,
            }}>
              <Ionicons name="search-outline" size={16} color={C.muted} />
              <TextInput value={agencySearch} onChangeText={setAgencySearch}
                placeholder="Search agencies…" placeholderTextColor={C.muted}
                autoFocus style={{ flex: 1, fontSize: 14, color: C.dark }}
                clearButtonMode="while-editing" />
            </View>

            <TouchableOpacity
              onPress={() => { setFilterAgency(null); setAgencyDropdownOpen(false); }}
              style={{
                paddingHorizontal: 16, paddingVertical: 12,
                flexDirection: "row", alignItems: "center", gap: 10,
                backgroundColor: filterAgency === null ? C.tealLt : C.white,
                borderBottomWidth: 1, borderBottomColor: C.border,
              }}
            >
              <Ionicons name="list-outline" size={16} color={filterAgency === null ? C.teal : C.muted} />
              <Text style={{ color: filterAgency === null ? C.teal : C.dark, fontWeight: filterAgency === null ? "800" : "600", fontSize: 14 }}>
                All Agencies
              </Text>
            </TouchableOpacity>

            <ScrollView nestedScrollEnabled>
              {agencies
                .filter(a => a.name.toLowerCase().includes(agencySearch.toLowerCase()))
                .map(a => {
                  const selected = filterAgency === a.id;
                  return (
                    <TouchableOpacity
                      key={a.id}
                      onPress={() => { setFilterAgency(a.id); setAgencyDropdownOpen(false); }}
                      style={{
                        paddingHorizontal: 16, paddingVertical: 12,
                        flexDirection: "row", alignItems: "center", gap: 10,
                        backgroundColor: selected ? C.tealLt : C.white,
                        borderBottomWidth: 1, borderBottomColor: C.border,
                      }}
                    >
                      <Ionicons name="business-outline" size={16} color={selected ? C.teal : C.muted} />
                      <Text style={{ color: selected ? C.teal : C.dark, fontWeight: selected ? "800" : "600", fontSize: 14 }}>{a.name}</Text>
                      {selected && <Ionicons name="checkmark-circle" size={16} color={C.teal} style={{ marginLeft: "auto" }} />}
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function TripCard({ trip, onEdit, onDelete }: { trip: TripData; onEdit: () => void; onDelete: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={{
      backgroundColor: C.white, borderRadius: 20, padding: 16, marginBottom: 12,
      shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 3,
    }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.dark, fontWeight: "900", fontSize: 15 }}>{trip.agency_name}</Text>
          <Text style={{ color: C.mid, fontSize: 13, marginTop: 4 }}>{trip.from.city} → {trip.to.city}</Text>
          <View style={{ flexDirection: "row", gap: 16, marginTop: 10 }}>
            <View>
              <Text style={{ color: C.dark, fontWeight: "800", fontSize: 20 }}>{trip.departure_time}</Text>
              <Text style={{ color: C.muted, fontSize: 11 }}>Est. {trip.estimated_arrival_time}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ color: C.blue, fontWeight: "900", fontSize: 16 }}>{trip.price.toLocaleString()} RWF</Text>
              <Text style={{ color: C.muted, fontSize: 11 }}>{trip.total_seats} seats</Text>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          <View style={{ backgroundColor: trip.active ? C.greenLt : C.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ color: trip.active ? C.green : C.muted, fontSize: 10, fontWeight: "700" }}>
              {trip.active ? "Active" : "Inactive"}
            </Text>
          </View>
          <TouchableOpacity onPress={onEdit} style={{ padding: 6 }}>
            <Ionicons name="pencil" size={18} color={C.blue} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={{ padding: 6 }}>
            <Ionicons name="trash" size={18} color={C.orange} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ color: C.muted, fontSize: 11, fontWeight: "700", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
      {children}
    </Text>
  );
}

function PickerRow({ options, value, onChange }: { options: { label: string; value: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {options.map((opt) => (
          <TouchableOpacity key={opt.value} onPress={() => onChange(opt.value)}
            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: value === opt.value ? C.teal : C.bg }}>
            <Text style={{ color: value === opt.value ? C.white : C.dark, fontWeight: "700", fontSize: 13 }}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
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
  marginBottom: 12,
};
