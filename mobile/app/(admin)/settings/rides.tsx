import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminNav } from "@/components/admin/AdminNavContext";
import { queryKeys } from "@/lib/queryKeys";
import type { components } from "@/lib/apiSchema";

type RideSettings = components["schemas"]["RideSettings"];
type ClassRules = { per_km_min: number; per_km_max: number; min_fare_max: number };

const CLASSES = ["moto", "car", "comfort", "van"] as const;
const CLASS_LABEL: Record<(typeof CLASSES)[number], string> = {
  moto: "Moto", car: "Car", comfort: "Comfort", van: "Van",
};

/** Form keeps every number as text so partial typing works; converted on save. */
type Form = {
  classes: Record<string, Record<keyof ClassRules, string>>;
  commission_pct: string;
  fee_type: "flat" | "percent";
  fee_amount: string;
  road_factor: string;
  nearby_radius_km: string;
  presence_ttl_sec: string;
  request_timeout_sec: string;
  hire: Record<HireKey, string>;
};

/** Hire a Driver limits and booking rules (platform_settings rides.hire) */
const HIRE_FIELDS: { key: HireKey; label: string }[] = [
  { key: "hourly_min", label: "Hourly min (RWF)" },
  { key: "hourly_max", label: "Hourly max (RWF)" },
  { key: "daily_min", label: "Daily min (RWF)" },
  { key: "daily_max", label: "Daily max (RWF)" },
  { key: "overtime_max", label: "Overtime max / h" },
  { key: "out_of_town_max", label: "Out-of-town max / day" },
  { key: "commission_pct", label: "Commission %" },
  { key: "service_fee", label: "Service fee (RWF)" },
  { key: "request_timeout_min", label: "Answer within (min)" },
  { key: "free_cancel_hours", label: "Free cancel until (h before)" },
  { key: "late_cancel_pct", label: "Late cancel fee %" },
  { key: "overtime_grace_min", label: "Overtime grace (min)" },
  { key: "max_days", label: "Max days" },
];
type HireKey = keyof components["schemas"]["HireSettingsLimits"];

function toForm(s: RideSettings): Form {
  const classes: Form["classes"] = {};
  for (const c of CLASSES) {
    const r = (s.vehicle_classes[c] ?? {}) as Partial<ClassRules>;
    classes[c] = {
      per_km_min: String(r.per_km_min ?? ""),
      per_km_max: String(r.per_km_max ?? ""),
      min_fare_max: String(r.min_fare_max ?? ""),
    };
  }
  return {
    classes,
    commission_pct: String(s.commission_pct),
    fee_type: (s.service_fee?.type ?? "flat") as Form["fee_type"],
    fee_amount: String(s.service_fee?.amount ?? 0),
    road_factor: String(s.road_factor ?? 1.3),
    nearby_radius_km: String(s.nearby_radius_km ?? 5),
    presence_ttl_sec: String(s.presence_ttl_sec ?? 60),
    request_timeout_sec: String(s.request_timeout_sec ?? 30),
    hire: Object.fromEntries(HIRE_FIELDS.map(({ key }) => [key, String(s.hire?.[key] ?? "")])) as Record<HireKey, string>,
  };
}

function toPayload(f: Form): components["schemas"]["RideSettingsUpdate"] {
  const vehicle_classes: Record<string, ClassRules> = {};
  for (const c of CLASSES) {
    vehicle_classes[c] = {
      per_km_min: Number(f.classes[c].per_km_min),
      per_km_max: Number(f.classes[c].per_km_max),
      min_fare_max: Number(f.classes[c].min_fare_max),
    };
  }
  return {
    vehicle_classes,
    commission_pct: Number(f.commission_pct),
    service_fee: { type: f.fee_type, amount: Number(f.fee_amount) },
    road_factor: Number(f.road_factor),
    nearby_radius_km: Number(f.nearby_radius_km),
    presence_ttl_sec: Number(f.presence_ttl_sec),
    request_timeout_sec: Number(f.request_timeout_sec),
    hire: Object.fromEntries(HIRE_FIELDS.filter(({ key }) => f.hire[key] !== "").map(({ key }) => [key, Number(f.hire[key])])),
  };
}

export default function RideSettingsScreen() {
  const { isSuperAdmin } = useAdminNav();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.admin.rideSettings(),
    queryFn: () => api.get<RideSettings>("/admin/settings/rides").then(r => r.data),
    enabled: isSuperAdmin,
  });

  useEffect(() => {
    if (data && !form) setForm(toForm(data));
  }, [data, form]);

  const save = useMutation({
    mutationFn: (f: Form) => api.put<RideSettings>("/admin/settings/rides", toPayload(f)).then(r => r.data),
    onSuccess: saved => {
      setErrors({});
      queryClient.setQueryData(queryKeys.admin.rideSettings(), saved);
      setForm(toForm(saved));
      Alert.alert("Saved ✓", "Ride pricing settings updated.");
    },
    onError: (err: any) => {
      const fieldErrors = err?.response?.status === 422 ? err.response.data?.errors : null;
      if (fieldErrors) {
        const first: Record<string, string> = {};
        for (const [k, v] of Object.entries(fieldErrors)) first[k] = Array.isArray(v) ? String(v[0]) : String(v);
        setErrors(first);
        Alert.alert("Check the values", Object.values(first)[0]);
      } else {
        Alert.alert("Error", "Could not save settings.");
      }
    },
  });

  if (!isSuperAdmin) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <AdminHeader title="Ride pricing" />
        <Text style={{ color: C.mid, padding: 20 }}>Only the superadmin can change ride pricing.</Text>
      </SafeAreaView>
    );
  }

  const setClass = (c: string, key: keyof ClassRules, value: string) =>
    setForm(f => f && ({ ...f, classes: { ...f.classes, [c]: { ...f.classes[c], [key]: value } } }));
  const setField = (key: Exclude<keyof Form, "classes">, value: string) =>
    setForm(f => f && ({ ...f, [key]: value }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <AdminHeader title="Ride pricing" />
      {isLoading || !form ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={C.teal} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Text style={{ color: C.mid, fontSize: 13, marginBottom: 12 }}>
            Drivers set their own prices within these limits. Check RURA rules before changing production values.
          </Text>

          <Section title="Per-km limits by vehicle class (RWF)">
            {CLASSES.map(c => (
              <View key={c} style={{ marginBottom: 14 }}>
                <Text style={{ fontWeight: "800", color: C.dark, marginBottom: 6 }}>{CLASS_LABEL[c]}</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <NumberField label="Min / km" value={form.classes[c].per_km_min}
                    onChange={v => setClass(c, "per_km_min", v)} error={errors[`vehicle_classes.${c}.per_km_min`]} />
                  <NumberField label="Max / km" value={form.classes[c].per_km_max}
                    onChange={v => setClass(c, "per_km_max", v)} error={errors[`vehicle_classes.${c}.per_km_max`]} />
                  <NumberField label="Max min-fare" value={form.classes[c].min_fare_max}
                    onChange={v => setClass(c, "min_fare_max", v)} error={errors[`vehicle_classes.${c}.min_fare_max`]} />
                </View>
              </View>
            ))}
          </Section>

          <Section title="Jali earnings">
            <View style={{ flexDirection: "row", gap: 8 }}>
              <NumberField label="Commission %" value={form.commission_pct}
                onChange={v => setField("commission_pct", v)} error={errors.commission_pct} />
              <NumberField label={form.fee_type === "flat" ? "Service fee (RWF)" : "Service fee %"}
                value={form.fee_amount} onChange={v => setField("fee_amount", v)} error={errors["service_fee.amount"]} />
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              {(["flat", "percent"] as const).map(t => (
                <TouchableOpacity key={t} onPress={() => setForm(f => f && ({ ...f, fee_type: t }))}
                  accessibilityLabel={`Service fee type ${t}`}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
                    backgroundColor: form.fee_type === t ? C.teal : C.white,
                    borderWidth: 1.5, borderColor: form.fee_type === t ? C.teal : C.border,
                  }}>
                  <Text style={{ color: form.fee_type === t ? C.white : C.mid, fontWeight: "700" }}>
                    {t === "flat" ? "Flat fee" : "Percent"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Section>

          <Section title="Dispatch">
            <View style={{ flexDirection: "row", gap: 8 }}>
              <NumberField label="Search radius km" value={form.nearby_radius_km}
                onChange={v => setField("nearby_radius_km", v)} error={errors.nearby_radius_km} />
              <NumberField label="Road factor" value={form.road_factor}
                onChange={v => setField("road_factor", v)} error={errors.road_factor} />
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <NumberField label="Driver offline after (s)" value={form.presence_ttl_sec}
                onChange={v => setField("presence_ttl_sec", v)} error={errors.presence_ttl_sec} />
              <NumberField label="Request timeout (s)" value={form.request_timeout_sec}
                onChange={v => setField("request_timeout_sec", v)} error={errors.request_timeout_sec} />
            </View>
          </Section>

          <Section title="Hire a driver">
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {HIRE_FIELDS.map(({ key, label }) => (
                <View key={key} style={{ width: "48%" }}>
                  <NumberField label={label} value={form.hire[key]}
                    onChange={v => setForm({ ...form, hire: { ...form.hire, [key]: v } })} error={errors[`hire.${key}`]} />
                </View>
              ))}
            </View>
          </Section>

          <TouchableOpacity
            onPress={() => save.mutate(form)}
            disabled={save.isPending}
            accessibilityLabel="Save ride pricing settings"
            style={{ backgroundColor: C.teal, borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 8 }}>
            {save.isPending
              ? <ActivityIndicator color={C.white} />
              : <Text style={{ color: C.white, fontWeight: "900", fontSize: 16 }}>Save settings</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: C.border }}>
      <Text style={{ fontWeight: "800", fontSize: 13, color: C.teal, textTransform: "uppercase", marginBottom: 10 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function NumberField({ label, value, onChange, error }: {
  label: string; value: string; onChange: (v: string) => void; error?: string;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: C.mid, fontSize: 11, fontWeight: "700", marginBottom: 4 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        accessibilityLabel={label}
        style={{
          backgroundColor: C.bg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9,
          fontSize: 15, color: C.dark, borderWidth: 1.5, borderColor: error ? C.orange : C.border,
        }}
      />
      {error ? <Text style={{ color: C.orange, fontSize: 11, marginTop: 2 }}>{error}</Text> : null}
    </View>
  );
}
