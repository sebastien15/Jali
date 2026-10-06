import { useEffect, useState } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as Location from "expo-location";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminNav } from "@/components/admin/AdminNavContext";
import { queryKeys } from "@/lib/queryKeys";
import type { components } from "@/lib/apiSchema";

type ServiceArea = components["schemas"]["ServiceArea"];
type ServiceAreaInput = components["schemas"]["ServiceAreaInput"];
type Kind = "city" | "zone";
type ShapeMode = "keep" | "circle" | "points" | "geojson";

const ZONE_TYPES = ["airport", "stadium", "station", "pickup", "other"] as const;
const SERVICES = [
  { key: "rides", label: "Rides" }, { key: "hire", label: "Hire a driver" }, { key: "rental", label: "Car rental" },
  { key: "shared", label: "Shared journeys" }, { key: "bus", label: "Bus tickets" }, { key: "cargo", label: "Cargo" },
] as const;
const NUMBER_OVERRIDES = [
  { key: "commission_pct", label: "Commission %" },
  { key: "cancel_fee", label: "Late-cancel fee (RWF)" },
  { key: "free_wait_min", label: "Free wait (min)" },
  { key: "nearby_radius_km", label: "Search radius (km)" },
  { key: "broadcast_max_drivers", label: "Drivers per broadcast" },
] as const;
const CLASSES = ["moto", "car", "comfort", "van"] as const;
type ClassBand = { per_km_min: string; per_km_max: string; min_fare_max: string };

type Form = {
  name: string;
  kind: Kind;
  zone_type: string | null;
  parent_id: number | null;
  active: boolean;
  mode: ShapeMode;
  circle: { lat: string; lng: string; radius_km: string };
  points: string;
  geojson: string;
  numbers: Record<string, string>;
  classes: Record<string, ClassBand>;
  services: Record<string, boolean>;
};

const emptyBand = (): ClassBand => ({ per_km_min: "", per_km_max: "", min_fare_max: "" });

function toForm(a?: ServiceArea): Form {
  const o = (a?.overrides ?? {}) as Record<string, any>;
  return {
    name: a?.name ?? "",
    kind: (a?.kind as Kind) ?? "city",
    zone_type: a?.zone_type ?? null,
    parent_id: a?.parent_id ?? null,
    active: a?.active ?? false,
    mode: a ? "keep" : "circle",
    circle: { lat: a ? String(a.center.lat) : "", lng: a ? String(a.center.lng) : "", radius_km: "5" },
    points: (a?.polygon ?? []).map(p => `${p[0]}, ${p[1]}`).join("\n"),
    geojson: "",
    numbers: Object.fromEntries(NUMBER_OVERRIDES.map(({ key }) => [key, o[key] != null ? String(o[key]) : ""])),
    classes: Object.fromEntries(CLASSES.map(c => {
      const b = o.vehicle_classes?.[c];
      return [c, b ? { per_km_min: String(b.per_km_min), per_km_max: String(b.per_km_max), min_fare_max: String(b.min_fare_max) } : emptyBand()];
    })),
    services: Object.fromEntries(SERVICES.map(({ key }) => [key, o.services?.[key] !== false])),
  };
}

/** "lat, lng" per line → [[lat, lng], …]; null when a line can't be read */
function parsePoints(text: string): number[][] | null {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const points = lines.map(l => l.split(/[,\s]+/).filter(Boolean).map(Number));
  return points.every(p => p.length === 2 && p.every(n => Number.isFinite(n))) ? points : null;
}

function toPayload(f: Form): ServiceAreaInput | string {
  const payload: ServiceAreaInput = {
    name: f.name.trim(), kind: f.kind, active: f.active,
    zone_type: f.kind === "zone" ? (f.zone_type as ServiceAreaInput["zone_type"]) : null,
    parent_id: f.kind === "zone" ? f.parent_id : null,
  };
  if (f.mode === "circle") {
    payload.circle = { lat: Number(f.circle.lat), lng: Number(f.circle.lng), radius_km: Number(f.circle.radius_km) };
  } else if (f.mode === "points") {
    const points = parsePoints(f.points);
    if (!points || points.length < 3) return "Enter at least 3 points, one \"lat, lng\" per line.";
    payload.polygon = points;
  } else if (f.mode === "geojson") {
    if (!f.geojson.trim()) return "Paste or upload a GeoJSON polygon.";
    payload.geojson = f.geojson;
  }
  if (f.kind === "city") {
    const overrides: Record<string, any> = {};
    for (const { key } of NUMBER_OVERRIDES) if (f.numbers[key].trim() !== "") overrides[key] = Number(f.numbers[key]);
    const classes: Record<string, object> = {};
    for (const c of CLASSES) {
      const b = f.classes[c];
      if (b.per_km_min || b.per_km_max || b.min_fare_max) {
        classes[c] = { per_km_min: Number(b.per_km_min), per_km_max: Number(b.per_km_max), min_fare_max: Number(b.min_fare_max) };
      }
    }
    if (Object.keys(classes).length) overrides.vehicle_classes = classes;
    overrides.services = f.services;
    payload.overrides = overrides;
  }
  return payload;
}

/** Superadmin: add or edit a city / zone, its shape, on/off and per-city overrides (S10.4) */
export default function ServiceAreaEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const areaId = Number(id);
  const { isSuperAdmin } = useAdminNav();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form | null>(isNew ? toForm() : null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const area = useQuery({
    queryKey: queryKeys.admin.serviceArea(areaId),
    queryFn: () => api.get<ServiceArea>(`/admin/service-areas/${areaId}`).then(r => r.data),
    enabled: isSuperAdmin && !isNew,
  });
  const cities = useQuery({
    queryKey: queryKeys.admin.serviceAreas(),
    queryFn: () => api.get<{ data: ServiceArea[] }>("/admin/service-areas").then(r => r.data.data),
    enabled: isSuperAdmin,
    select: list => list.filter(a => a.kind === "city"),
  });

  useEffect(() => {
    if (area.data && !form) setForm(toForm(area.data));
  }, [area.data, form]);

  const done = (message: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.serviceAreas() });
    Alert.alert("Saved ✓", message);
    router.back();
  };
  const showErrors = (err: any) => {
    const fieldErrors = err?.response?.data?.errors;
    if (fieldErrors) {
      const first: Record<string, string> = {};
      for (const [k, v] of Object.entries(fieldErrors)) first[k] = Array.isArray(v) ? String(v[0]) : String(v);
      setErrors(first);
      Alert.alert("Check the values", Object.values(first)[0]);
    } else {
      Alert.alert("Error", err?.response?.data?.message ?? "Could not save.");
    }
  };

  const save = useMutation({
    mutationFn: (payload: ServiceAreaInput) => isNew
      ? api.post<ServiceArea>("/admin/service-areas", payload).then(r => r.data)
      : api.put<ServiceArea>(`/admin/service-areas/${areaId}`, payload).then(r => r.data),
    onSuccess: saved => done(`${saved.name} is ${saved.active ? "live" : "switched off"}.`),
    onError: showErrors,
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/admin/service-areas/${areaId}`),
    onSuccess: () => done("Deleted."),
    onError: showErrors,
  });

  if (!isSuperAdmin) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <AdminHeader title="Service area" showBack />
        <Text style={{ color: C.mid, padding: 20 }}>Only the superadmin can change service areas.</Text>
      </SafeAreaView>
    );
  }
  if (!form) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <AdminHeader title="Service area" showBack />
        <ActivityIndicator color={C.teal} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  const set = (patch: Partial<Form>) => setForm(f => f && ({ ...f, ...patch }));
  const submit = () => {
    const payload = toPayload(form);
    if (typeof payload === "string") return Alert.alert("Shape", payload);
    save.mutate(payload);
  };
  const useMyLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return Alert.alert("Location", "Allow location to use where you are as the centre.");
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    set({ circle: { ...form.circle, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) } });
  };
  const uploadGeoJson = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ["application/json", "application/geo+json", "*/*"], copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    try {
      const text = await (await fetch(result.assets[0].uri)).text();
      set({ geojson: text, mode: "geojson" });
    } catch {
      Alert.alert("Upload", "Could not read that file.");
    }
  };
  const confirmDelete = () => Alert.alert("Delete", `Delete ${form.name}?`, [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: () => remove.mutate() },
  ]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <AdminHeader title={isNew ? "New service area" : form.name || "Service area"} showBack />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Section title="Area">
          <Field label="Name" value={form.name} onChange={v => set({ name: v })} error={errors.name} placeholder="e.g. Musanze" />
          <Chips options={[{ id: "city", label: "City" }, { id: "zone", label: "Zone" }]} value={form.kind}
            onPick={v => set({ kind: v as Kind })} />
          {form.kind === "zone" && (
            <>
              <Label text="Zone type" error={errors.zone_type} />
              <Chips options={ZONE_TYPES.map(z => ({ id: z, label: z }))} value={form.zone_type} onPick={v => set({ zone_type: v })} />
              <Label text="In city" error={errors.parent_id} />
              <Chips options={(cities.data ?? []).map(c => ({ id: String(c.id), label: c.name }))}
                value={form.parent_id != null ? String(form.parent_id) : null} onPick={v => set({ parent_id: Number(v) })} />
            </>
          )}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "800", color: C.dark }}>Live</Text>
              <Text style={{ color: C.mid, fontSize: 12 }}>
                {form.kind === "city" ? "Customers here can use Jali services." : "Used by airport queues, pickup points and heatmaps."}
              </Text>
            </View>
            <Switch value={form.active} onValueChange={v => set({ active: v })} accessibilityLabel="Live" />
          </View>
        </Section>

        <Section title="Shape">
          <Chips value={form.mode} onPick={v => set({ mode: v as ShapeMode })} options={[
            ...(isNew ? [] : [{ id: "keep", label: `Keep (${area.data?.polygon.length ?? 0} points)` }]),
            { id: "circle", label: "Circle" }, { id: "points", label: "Points" }, { id: "geojson", label: "GeoJSON" },
          ]} />
          {form.mode === "circle" && (
            <>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Field label="Centre lat" value={form.circle.lat} onChange={v => set({ circle: { ...form.circle, lat: v } })} numeric error={errors["circle.lat"]} />
                <Field label="Centre lng" value={form.circle.lng} onChange={v => set({ circle: { ...form.circle, lng: v } })} numeric error={errors["circle.lng"]} />
                <Field label="Radius km" value={form.circle.radius_km} onChange={v => set({ circle: { ...form.circle, radius_km: v } })} numeric error={errors["circle.radius_km"]} />
              </View>
              <SmallButton icon="📍" label="Use my location as centre" onPress={useMyLocation} />
            </>
          )}
          {form.mode === "points" && (
            <Field label='One "lat, lng" per line (at least 3, in order around the area)' value={form.points}
              onChange={v => set({ points: v })} multiline error={errors.polygon} placeholder={"-1.94, 30.05\n-1.94, 30.10\n-1.98, 30.10"} />
          )}
          {form.mode === "geojson" && (
            <>
              <SmallButton icon="⬆️" label="Upload a .geojson file" onPress={uploadGeoJson} />
              <Field label="…or paste a GeoJSON Polygon / Feature" value={form.geojson} onChange={v => set({ geojson: v })}
                multiline error={errors.geojson} />
            </>
          )}
        </Section>

        {form.kind === "city" && (
          <>
            <Section title="Services in this city">
              {SERVICES.map(({ key, label }) => (
                <View key={key} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 }}>
                  <Text style={{ color: C.dark, fontWeight: "600" }}>{label}</Text>
                  <Switch value={form.services[key]} accessibilityLabel={label}
                    onValueChange={v => set({ services: { ...form.services, [key]: v } })} />
                </View>
              ))}
            </Section>
            <Section title="City settings (empty = global value)">
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {NUMBER_OVERRIDES.map(({ key, label }) => (
                  <View key={key} style={{ width: "48%" }}>
                    <Field label={label} value={form.numbers[key]} numeric error={errors[`overrides.${key}`]}
                      onChange={v => set({ numbers: { ...form.numbers, [key]: v } })} />
                  </View>
                ))}
              </View>
              <Label text="Per-km limits by vehicle class (RWF)" />
              {CLASSES.map(c => (
                <View key={c} style={{ marginBottom: 6 }}>
                  <Text style={{ color: C.dark, fontWeight: "700", textTransform: "capitalize" }}>{c}</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {(["per_km_min", "per_km_max", "min_fare_max"] as const).map(k => (
                      <Field key={k} label={k === "per_km_min" ? "Min / km" : k === "per_km_max" ? "Max / km" : "Max min-fare"}
                        value={form.classes[c][k]} numeric error={errors[`overrides.vehicle_classes.${c}.${k}`]}
                        onChange={v => set({ classes: { ...form.classes, [c]: { ...form.classes[c], [k]: v } } })} />
                    ))}
                  </View>
                </View>
              ))}
            </Section>
          </>
        )}

        <TouchableOpacity onPress={submit} disabled={save.isPending} accessibilityLabel="Save service area"
          style={{ backgroundColor: C.teal, borderRadius: 16, paddingVertical: 16, alignItems: "center" }}>
          {save.isPending ? <ActivityIndicator color={C.white} /> : <Text style={{ color: C.white, fontWeight: "900", fontSize: 16 }}>Save</Text>}
        </TouchableOpacity>
        {!isNew && (
          <TouchableOpacity onPress={confirmDelete} disabled={remove.isPending} accessibilityLabel="Delete service area"
            style={{ borderRadius: 16, paddingVertical: 14, alignItems: "center", marginTop: 10 }}>
            <Text style={{ color: C.orange, fontWeight: "800" }}>Delete</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: C.border }}>
      <Text style={{ fontWeight: "800", fontSize: 13, color: C.teal, textTransform: "uppercase", marginBottom: 10 }}>{title}</Text>
      {children}
    </View>
  );
}

function Label({ text, error }: { text: string; error?: string }) {
  return (
    <Text style={{ color: error ? C.orange : C.mid, fontSize: 11, fontWeight: "700", marginTop: 10, marginBottom: 6 }}>
      {error ?? text}
    </Text>
  );
}

function Field({ label, value, onChange, error, numeric, multiline, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; error?: string; numeric?: boolean; multiline?: boolean; placeholder?: string;
}) {
  return (
    <View style={{ flex: 1, marginBottom: 8 }}>
      <Text style={{ color: C.mid, fontSize: 11, fontWeight: "700", marginBottom: 4 }}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={C.muted}
        keyboardType={numeric ? "numbers-and-punctuation" : "default"} multiline={multiline} accessibilityLabel={label}
        style={{
          borderWidth: 1.5, borderColor: error ? C.orange : C.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
          color: C.dark, backgroundColor: C.bg, minHeight: multiline ? 110 : undefined, textAlignVertical: multiline ? "top" : "center",
        }} />
      {!!error && <Text style={{ color: C.orange, fontSize: 11, marginTop: 2 }}>{error}</Text>}
    </View>
  );
}

function Chips({ options, value, onPick }: { options: { id: string; label: string }[]; value: string | null; onPick: (id: string) => void }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
      {options.map(o => {
        const on = o.id === value;
        return (
          <TouchableOpacity key={o.id} onPress={() => onPick(o.id)} accessibilityLabel={o.label}
            style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: on ? C.teal : C.white, borderWidth: 1.5, borderColor: on ? C.teal : C.border }}>
            <Text style={{ color: on ? C.white : C.mid, fontWeight: "700", textTransform: "capitalize" }}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function SmallButton({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} accessibilityLabel={label}
      style={{ alignSelf: "flex-start", backgroundColor: C.tealLt, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 }}>
      <Text style={{ color: C.teal, fontWeight: "700" }}>{icon} {label}</Text>
    </TouchableOpacity>
  );
}
