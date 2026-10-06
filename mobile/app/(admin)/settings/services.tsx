import { useEffect, useState } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminNav } from "@/components/admin/AdminNavContext";
import { queryKeys } from "@/lib/queryKeys";
import type { components } from "@/lib/apiSchema";

type Catalogue = components["schemas"]["ServiceCatalogue"];
type ServiceId = keyof Catalogue;
type Row = { discoverable: boolean; accepting_new_requests: boolean; minimum_app_version: string };

const SERVICES: { id: ServiceId; label: string; built: boolean }[] = [
  { id: "rides", label: "Rides", built: true },
  { id: "hire", label: "Hire a driver", built: true },
  { id: "rental", label: "Car rental", built: true },
  { id: "shared", label: "Shared journeys", built: true },
  { id: "bus", label: "Bus tickets", built: true },
  { id: "cargo", label: "Cargo", built: false },
];

const toRows = (c: Catalogue) => Object.fromEntries(SERVICES.map(({ id }) => [id, {
  discoverable: c[id].discoverable,
  accepting_new_requests: c[id].accepting_new_requests,
  minimum_app_version: c[id].minimum_app_version ?? "",
}])) as Record<ServiceId, Row>;

/** Superadmin: release, pause or hide each service; minimum app version (S23.1) */
export default function ServicesScreen() {
  const { isSuperAdmin } = useAdminNav();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<Record<ServiceId, Row> | null>(null);

  const { data } = useQuery({
    queryKey: queryKeys.admin.services(),
    queryFn: () => api.get<Catalogue>("/admin/services").then(r => r.data),
    enabled: isSuperAdmin,
  });
  useEffect(() => { if (data && !rows) setRows(toRows(data)); }, [data, rows]);

  const save = useMutation({
    mutationFn: (r: Record<ServiceId, Row>) => api.put<Catalogue>("/admin/services", Object.fromEntries(
      SERVICES.filter(s => s.built).map(({ id }) => [id, { ...r[id], minimum_app_version: r[id].minimum_app_version.trim() || null }]),
    )).then(res => res.data),
    onSuccess: saved => {
      queryClient.setQueryData(queryKeys.admin.services(), saved);
      setRows(toRows(saved));
      Alert.alert("Saved ✓", "Services updated. Existing bookings are not affected.");
    },
    onError: (err: any) => {
      const errors = err?.response?.data?.errors;
      Alert.alert("Check the values", errors ? String(Object.values(errors)[0]) : "Could not save.");
    },
  });

  if (!isSuperAdmin) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <AdminHeader title="Services" showBack />
        <Text style={{ color: C.mid, padding: 20 }}>Only the superadmin can release or pause services.</Text>
      </SafeAreaView>
    );
  }

  const set = (id: ServiceId, patch: Partial<Row>) => setRows(r => r && ({ ...r, [id]: { ...r[id], ...patch } }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <AdminHeader title="Services" showBack />
      {!rows ? <ActivityIndicator color={C.teal} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
          <Text style={{ color: C.mid, fontSize: 13 }}>
            Shown = visible in the app. Taking requests = new bookings allowed. Pausing never cancels existing bookings.
            Per-city switches live in Service areas.
          </Text>
          {SERVICES.map(({ id, label, built }) => (
            <View key={id} style={{ backgroundColor: C.white, borderRadius: 16, padding: 14, opacity: built ? 1 : 0.6 }}>
              <Text style={{ fontWeight: "900", color: C.dark, fontSize: 15, marginBottom: 6 }}>
                {label}{built ? "" : " · not built yet"}
              </Text>
              <Toggle label="Shown in the app" value={rows[id].discoverable} disabled={!built}
                onChange={v => set(id, { discoverable: v })} />
              <Toggle label="Taking new requests" value={rows[id].accepting_new_requests} disabled={!built}
                onChange={v => set(id, { accepting_new_requests: v })} />
              {built && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 }}>
                  <Text style={{ flex: 1, color: C.mid }}>Minimum app version</Text>
                  <TextInput value={rows[id].minimum_app_version} onChangeText={v => set(id, { minimum_app_version: v })}
                    placeholder="any" placeholderTextColor={C.muted} keyboardType="numbers-and-punctuation"
                    accessibilityLabel={`${label} minimum app version`}
                    style={{ width: 90, borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, color: C.dark }} />
                </View>
              )}
            </View>
          ))}
          <TouchableOpacity onPress={() => save.mutate(rows)} disabled={save.isPending} accessibilityLabel="Save services"
            style={{ backgroundColor: C.teal, borderRadius: 16, paddingVertical: 16, alignItems: "center" }}>
            {save.isPending ? <ActivityIndicator color={C.white} /> : <Text style={{ color: C.white, fontWeight: "900", fontSize: 16 }}>Save</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Toggle({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 }}>
      <Text style={{ color: C.dark }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} disabled={disabled} accessibilityLabel={label} />
    </View>
  );
}
