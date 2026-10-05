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
type Departure = { id: number; departure_time: string; active: boolean };

type RouteData = {
  id: number;
  agency_id: number;
  agency_name: string;
  from: { id: number; city: string; district: string | null };
  to: { id: number; city: string; district: string | null };
  price: number;
  total_seats: number;
  duration_mins: number;
  active: boolean;
  departures: Departure[];
};

export default function TripsScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [filterAgency, setFilterAgency] = useState<number | null>(null);
  const [filterActive, setFilterActive] = useState<boolean | null>(null);
  const [agencyDropdownOpen, setAgencyDropdownOpen] = useState(false);
  const [agencySearch, setAgencySearch] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Route create/edit modal
  const [routeModal, setRouteModal] = useState<{ mode: "create" | "edit"; route?: RouteData } | null>(null);
  const [routeForm, setRouteForm] = useState({
    agency_id: "",
    from_station_id: "",
    to_station_id: "",
    price: "",
    total_seats: "30",
    duration_mins: "",
    active: true,
    first_departure: "",
  });
  const [savingRoute, setSavingRoute] = useState(false);

  // Departure management modal
  const [depsModal, setDepsModal] = useState<RouteData | null>(null);
  const [newDepTime, setNewDepTime] = useState("");
  const [savingDep, setSavingDep] = useState(false);

  const tripFilters = { agency_id: filterAgency, active: filterActive };

  const routesQuery = useQuery({
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

  const routes   = routesQuery.data as RouteData[] ?? [];
  const agencies = agenciesQuery.data as Agency[] ?? [];
  const stations = stationsQuery.data as Station[] ?? [];

  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(""), 2000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  function openCreateRoute() {
    setRouteModal({ mode: "create" });
    setRouteForm({ agency_id: "", from_station_id: "", to_station_id: "", price: "", total_seats: "30", duration_mins: "", active: true, first_departure: "" });
  }

  function openEditRoute(route: RouteData) {
    setRouteModal({ mode: "edit", route });
    setRouteForm({
      agency_id: String(route.agency_id),
      from_station_id: String(route.from.id),
      to_station_id: String(route.to.id),
      price: String(route.price),
      total_seats: String(route.total_seats),
      duration_mins: String(route.duration_mins),
      active: route.active,
      first_departure: "",
    });
  }

  async function handleSaveRoute() {
    if (routeModal?.mode === "create") {
      if (!routeForm.agency_id || !routeForm.from_station_id || !routeForm.to_station_id ||
        !routeForm.price || !routeForm.total_seats || !routeForm.duration_mins) {
        Alert.alert("Error", "Please fill in all required fields");
        return;
      }
    }

    setSavingRoute(true);
    try {
      if (routeModal?.mode === "create") {
        const payload: any = {
          agency_id: Number(routeForm.agency_id),
          from_station_id: Number(routeForm.from_station_id),
          to_station_id: Number(routeForm.to_station_id),
          price: Number(routeForm.price),
          total_seats: Number(routeForm.total_seats),
          duration_mins: Number(routeForm.duration_mins),
          active: routeForm.active,
        };
        if (routeForm.first_departure) payload.departure_time = routeForm.first_departure;
        await api.post("/admin/trips", payload);
        setSuccessMsg(t("adminTrips.created"));
      } else if (routeModal?.route) {
        await api.patch(`/admin/trips/${routeModal.route.id}`, {
          price: Number(routeForm.price),
          total_seats: Number(routeForm.total_seats),
          duration_mins: Number(routeForm.duration_mins),
          active: routeForm.active,
        });
        setSuccessMsg(t("adminTrips.updated"));
      }
      setRouteModal(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.allTrips() });
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.error ?? e?.response?.data?.message ?? "Failed");
    } finally {
      setSavingRoute(false);
    }
  }

  async function handleDeleteRoute(route: RouteData) {
    Alert.alert(t("adminTrips.title"), t("adminTrips.deleteConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/admin/trips/${route.id}`);
            setSuccessMsg(t("adminTrips.deleted"));
            queryClient.invalidateQueries({ queryKey: queryKeys.admin.allTrips() });
          } catch (e: any) {
            Alert.alert("Error", e?.response?.data?.error ?? "Failed");
          }
        },
      },
    ]);
  }

  async function handleAddDeparture() {
    if (!newDepTime || !depsModal) return;
    setSavingDep(true);
    try {
      await api.post(`/admin/trips/${depsModal.id}/departures`, { departure_time: newDepTime });
      setNewDepTime("");
      setSuccessMsg("Departure added");
      // Refresh the route list and update the local depsModal
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.allTrips() });
      const fresh = await api.get("/admin/trips", { params: { agency_id: depsModal.agency_id } }).then(r => r.data ?? []);
      const updated = fresh.find((r: RouteData) => r.id === depsModal.id);
      if (updated) setDepsModal(updated);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.error ?? "Failed");
    } finally {
      setSavingDep(false);
    }
  }

  async function handleRemoveDeparture(dep: Departure) {
    if (!depsModal) return;
    Alert.alert("Remove Departure", `Remove ${dep.departure_time}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/admin/trips/${depsModal.id}/departures/${dep.id}`);
            setSuccessMsg("Departure removed");
            await queryClient.invalidateQueries({ queryKey: queryKeys.admin.allTrips() });
            const fresh = await api.get("/admin/trips", { params: { agency_id: depsModal.agency_id } }).then(r => r.data ?? []);
            const updated = fresh.find((r: RouteData) => r.id === depsModal.id);
            if (updated) setDepsModal(updated);
          } catch (e: any) {
            Alert.alert("Error", e?.response?.data?.error ?? "Failed");
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
            onPress={openCreateRoute}
            style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}
          >
            <Text style={{ color: C.white, fontWeight: "800", fontSize: 18 }}>+</Text>
          </TouchableOpacity>
        }
      />

      {successMsg ? (
        <View style={{ backgroundColor: C.greenLt, padding: 12, marginHorizontal: 16, borderRadius: 10 }}>
          <Text style={{ color: C.green, fontWeight: "700", fontSize: 13 }}>{successMsg}</Text>
        </View>
      ) : null}

      {/* Filters */}
      <View style={{ backgroundColor: C.white, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <TouchableOpacity
          onPress={() => { setAgencyDropdownOpen(true); setAgencySearch(""); }}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1.5, borderColor: C.border }}
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
          style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: filterActive === null ? C.bg : filterActive ? C.greenLt : C.muted + "33" }}
        >
          <Text style={{ color: filterActive === null ? C.muted : filterActive ? C.green : C.muted, fontWeight: "700", fontSize: 11 }}>
            {filterActive === null ? "All" : filterActive ? "Active" : "Inactive"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={routesQuery.isRefetching} onRefresh={routesQuery.refetch} />}
      >
        {routesQuery.isLoading && <ActivityIndicator color={C.teal} style={{ marginTop: 32 }} />}
        {!routesQuery.isLoading && routes.length === 0 && (
          <Text style={{ color: C.muted, textAlign: "center", marginTop: 40 }}>{t("adminTrips.noTrips")}</Text>
        )}
        {!routesQuery.isLoading && routes.map(route => (
          <RouteCard
            key={route.id}
            route={route}
            onEdit={() => openEditRoute(route)}
            onDelete={() => handleDeleteRoute(route)}
            onManageDepartures={() => { setDepsModal(route); setNewDepTime(""); }}
          />
        ))}
      </ScrollView>

      {/* Route create/edit modal */}
      <Modal visible={!!routeModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: "92%" }}>
            <View style={{ width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 }} />
            <Text style={{ fontWeight: "900", fontSize: 18, color: C.dark, marginBottom: 16 }}>
              {routeModal?.mode === "create" ? "New Route" : "Edit Route"}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {routeModal?.mode === "create" && (
                <>
                  <FieldLabel>{t("adminTrips.agency")}</FieldLabel>
                  <PickerRow
                    options={agencies.map(a => ({ label: a.name, value: String(a.id) }))}
                    value={routeForm.agency_id}
                    onChange={v => setRouteForm(f => ({ ...f, agency_id: v }))}
                  />
                  <FieldLabel>{t("adminTrips.from")}</FieldLabel>
                  <PickerRow
                    options={stations.filter(s => s.id !== Number(routeForm.to_station_id)).map(s => ({ label: s.city, value: String(s.id) }))}
                    value={routeForm.from_station_id}
                    onChange={v => setRouteForm(f => ({ ...f, from_station_id: v }))}
                  />
                  <FieldLabel>{t("adminTrips.to")}</FieldLabel>
                  <PickerRow
                    options={stations.filter(s => s.id !== Number(routeForm.from_station_id)).map(s => ({ label: s.city, value: String(s.id) }))}
                    value={routeForm.to_station_id}
                    onChange={v => setRouteForm(f => ({ ...f, to_station_id: v }))}
                  />
                </>
              )}

              <FieldLabel>{t("adminTrips.price")}</FieldLabel>
              <TextInput value={routeForm.price} onChangeText={v => setRouteForm(f => ({ ...f, price: v }))}
                placeholder="5000" placeholderTextColor={C.muted} keyboardType="number-pad" style={inputStyle} />

              <FieldLabel>{t("adminTrips.totalSeats")}</FieldLabel>
              <TextInput value={routeForm.total_seats} onChangeText={v => setRouteForm(f => ({ ...f, total_seats: v }))}
                placeholder="30" placeholderTextColor={C.muted} keyboardType="number-pad" style={inputStyle} />

              <FieldLabel>Duration (minutes)</FieldLabel>
              <TextInput value={routeForm.duration_mins} onChangeText={v => setRouteForm(f => ({ ...f, duration_mins: v }))}
                placeholder="210" placeholderTextColor={C.muted} keyboardType="number-pad" style={inputStyle} />

              {routeModal?.mode === "create" && (
                <>
                  <FieldLabel>First Departure Time (optional)</FieldLabel>
                  <TextInput value={routeForm.first_departure} onChangeText={v => setRouteForm(f => ({ ...f, first_departure: v }))}
                    placeholder="08:00" placeholderTextColor={C.muted} keyboardType="numeric" style={inputStyle} />
                </>
              )}

              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4, marginBottom: 16 }}>
                <Text style={{ color: C.dark, fontWeight: "700", fontSize: 14 }}>{t("adminTrips.active")}</Text>
                <Switch value={routeForm.active} onValueChange={v => setRouteForm(f => ({ ...f, active: v }))}
                  trackColor={{ false: C.border, true: C.teal }} thumbColor={C.white} />
              </View>
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <TouchableOpacity onPress={() => setRouteModal(null)}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: C.bg, alignItems: "center" }}>
                <Text style={{ color: C.mid, fontWeight: "700" }}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveRoute} disabled={savingRoute}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: savingRoute ? C.border : C.teal, alignItems: "center" }}>
                {savingRoute ? <ActivityIndicator color="#fff" size="small" /> : (
                  <Text style={{ color: C.white, fontWeight: "800" }}>
                    {routeModal?.mode === "create" ? "Create Route" : "Save Changes"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Departures management modal */}
      <Modal visible={!!depsModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: "85%" }}>
            <View style={{ width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 }} />
            <Text style={{ fontWeight: "900", fontSize: 17, color: C.dark }}>Departure Times</Text>
            {depsModal && (
              <Text style={{ color: C.muted, fontSize: 13, marginTop: 2, marginBottom: 16 }}>
                {depsModal.agency_name} · {depsModal.from.city} → {depsModal.to.city}
              </Text>
            )}

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 280 }}>
              {depsModal?.departures.length === 0 && (
                <Text style={{ color: C.muted, textAlign: "center", paddingVertical: 20 }}>No departure times yet</Text>
              )}
              {depsModal?.departures.map(dep => (
                <View key={dep.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border }}>
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ backgroundColor: C.blueLt, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
                      <Text style={{ color: C.blue, fontWeight: "900", fontSize: 15 }}>{dep.departure_time}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => handleRemoveDeparture(dep)} style={{ padding: 8 }}>
                    <Ionicons name="trash-outline" size={18} color={C.orange} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <View style={{ marginTop: 16 }}>
              <FieldLabel>Add Departure Time</FieldLabel>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TextInput
                  value={newDepTime}
                  onChangeText={setNewDepTime}
                  placeholder="08:00"
                  placeholderTextColor={C.muted}
                  keyboardType="numeric"
                  style={[inputStyle, { flex: 1, marginBottom: 0 }]}
                />
                <TouchableOpacity
                  onPress={handleAddDeparture}
                  disabled={savingDep || !newDepTime}
                  style={{ paddingHorizontal: 20, paddingVertical: 13, borderRadius: 12, backgroundColor: savingDep || !newDepTime ? C.border : C.teal, justifyContent: "center" }}
                >
                  {savingDep ? <ActivityIndicator color="#fff" size="small" /> : (
                    <Text style={{ color: C.white, fontWeight: "800", fontSize: 14 }}>Add</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity onPress={() => setDepsModal(null)} style={{ marginTop: 16, paddingVertical: 14, borderRadius: 12, backgroundColor: C.bg, alignItems: "center" }}>
              <Text style={{ color: C.mid, fontWeight: "700" }}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Agency search dropdown */}
      <Modal visible={agencyDropdownOpen} animationType="fade" transparent>
        <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)" }} activeOpacity={1} onPress={() => setAgencyDropdownOpen(false)}>
          <View style={{ backgroundColor: C.white, borderRadius: 16, marginHorizontal: 24, marginTop: 60, maxHeight: 300, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
              <Ionicons name="search-outline" size={16} color={C.muted} />
              <TextInput value={agencySearch} onChangeText={setAgencySearch} placeholder="Search agencies…" placeholderTextColor={C.muted}
                autoFocus style={{ flex: 1, fontSize: 14, color: C.dark }} clearButtonMode="while-editing" />
            </View>
            <TouchableOpacity onPress={() => { setFilterAgency(null); setAgencyDropdownOpen(false); }}
              style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: filterAgency === null ? C.tealLt : C.white, borderBottomWidth: 1, borderBottomColor: C.border }}>
              <Ionicons name="list-outline" size={16} color={filterAgency === null ? C.teal : C.muted} />
              <Text style={{ color: filterAgency === null ? C.teal : C.dark, fontWeight: filterAgency === null ? "800" : "600", fontSize: 14 }}>All Agencies</Text>
            </TouchableOpacity>
            <ScrollView nestedScrollEnabled>
              {agencies.filter(a => a.name.toLowerCase().includes(agencySearch.toLowerCase())).map(a => {
                const selected = filterAgency === a.id;
                return (
                  <TouchableOpacity key={a.id} onPress={() => { setFilterAgency(a.id); setAgencyDropdownOpen(false); }}
                    style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: selected ? C.tealLt : C.white, borderBottomWidth: 1, borderBottomColor: C.border }}>
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

function RouteCard({ route, onEdit, onDelete, onManageDepartures }: {
  route: RouteData;
  onEdit: () => void;
  onDelete: () => void;
  onManageDepartures: () => void;
}) {
  const hrs = Math.floor(route.duration_mins / 60);
  const mins = route.duration_mins % 60;
  const durationLabel = hrs > 0 ? `${hrs}h${mins > 0 ? ` ${mins}m` : ""}` : `${mins}m`;

  return (
    <View style={{ backgroundColor: C.white, borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 3 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.dark, fontWeight: "900", fontSize: 15 }}>{route.agency_name}</Text>
          <Text style={{ color: C.mid, fontSize: 13, marginTop: 2 }}>{route.from.city} → {route.to.city}</Text>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 8, alignItems: "center" }}>
            <Text style={{ color: C.blue, fontWeight: "900", fontSize: 15 }}>{route.price.toLocaleString()} RWF</Text>
            <Text style={{ color: C.muted, fontSize: 12 }}>{route.total_seats} seats</Text>
            <Text style={{ color: C.muted, fontSize: 12 }}>{durationLabel}</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
          <View style={{ backgroundColor: route.active ? C.greenLt : C.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ color: route.active ? C.green : C.muted, fontSize: 10, fontWeight: "700" }}>
              {route.active ? "Active" : "Inactive"}
            </Text>
          </View>
          <TouchableOpacity onPress={onEdit} style={{ padding: 6 }}>
            <Ionicons name="pencil" size={17} color={C.blue} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={{ padding: 6 }}>
            <Ionicons name="trash" size={17} color={C.orange} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Departure chips */}
      <TouchableOpacity onPress={onManageDepartures} style={{ marginTop: 12 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          {route.departures.slice(0, 6).map(d => (
            <View key={d.id} style={{ backgroundColor: C.tealLt, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
              <Text style={{ color: C.teal, fontWeight: "700", fontSize: 12 }}>{d.departure_time}</Text>
            </View>
          ))}
          {route.departures.length > 6 && (
            <Text style={{ color: C.muted, fontSize: 12 }}>+{route.departures.length - 6} more</Text>
          )}
          {route.departures.length === 0 && (
            <Text style={{ color: C.muted, fontSize: 12, fontStyle: "italic" }}>No departures — tap to add</Text>
          )}
          <View style={{ marginLeft: "auto" }}>
            <Ionicons name="time-outline" size={16} color={C.teal} />
          </View>
        </View>
      </TouchableOpacity>
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
        {options.map(opt => (
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
