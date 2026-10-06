import { useState } from "react";
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Image, Modal, StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { pickPhotoForm } from "@/lib/uploadImage";
import type { components } from "@/lib/apiSchema";

type Vehicle = components["schemas"]["Vehicle"];
type VehicleInput = components["schemas"]["VehicleInput"];
type VehicleClass = components["schemas"]["VehicleClass"];
type PhotoSlot = "front" | "side" | "interior" | "luggage";

const CLASSES: VehicleClass[] = ["moto", "car", "comfort", "van"];
const SLOTS: PhotoSlot[] = ["front", "side", "interior", "luggage"];

type Form = {
  id?: number; class: VehicleClass; make: string; model: string; color: string;
  year: string; plate: string; seats: string; insurance_expiry: string;
};
const EMPTY: Form = { class: "car", make: "", model: "", color: "", year: "", plate: "", seats: "4", insurance_expiry: "" };

function photosOf(v: Vehicle): Partial<Record<PhotoSlot, string>> {
  return v.photos && !Array.isArray(v.photos) ? v.photos : {};
}

function insuranceExpired(v: Vehicle): boolean {
  return !v.insurance_expiry || new Date(`${v.insurance_expiry}T23:59:59`) < new Date();
}

export default function VehiclesScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: queryKeys.driver.vehicles(),
    queryFn: () => api.get<Vehicle[]>("/driver/vehicles").then(r => r.data),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.driver.vehicles() });
    queryClient.invalidateQueries({ queryKey: queryKeys.driver.profile() });
    queryClient.invalidateQueries({ queryKey: queryKeys.driver.rates() });
  };

  const save = useMutation({
    mutationFn: (f: Form) => {
      const body: VehicleInput = {
        class: f.class, make: f.make || null, model: f.model, color: f.color || null,
        year: f.year ? Number(f.year) : null, plate: f.plate, seats: Number(f.seats),
        insurance_expiry: f.insurance_expiry,
      };
      return f.id ? api.patch(`/driver/vehicles/${f.id}`, body) : api.post("/driver/vehicles", body);
    },
    onSuccess: () => { setForm(null); setErrors({}); refresh(); },
    onError: (err: any) => {
      const fe = err?.response?.status === 422 ? err.response.data?.errors : null;
      if (fe) {
        const first: Record<string, string> = {};
        for (const [k, v] of Object.entries(fe)) first[k] = Array.isArray(v) ? String(v[0]) : String(v);
        setErrors(first);
      } else {
        Alert.alert(t("ride.vehicles.error"));
      }
    },
  });

  async function activate(v: Vehicle) {
    await api.post(`/driver/vehicles/${v.id}/activate`).catch(() => Alert.alert(t("ride.vehicles.error")));
    refresh();
  }

  function remove(v: Vehicle) {
    Alert.alert(t("ride.vehicles.deleteConfirm"), `${v.model} · ${v.plate}`, [
      { text: t("ride.vehicles.cancel"), style: "cancel" },
      {
        text: t("ride.vehicles.delete"), style: "destructive",
        onPress: async () => {
          await api.delete(`/driver/vehicles/${v.id}`).catch(() => Alert.alert(t("ride.vehicles.error")));
          refresh();
        },
      },
    ]);
  }

  async function uploadPhoto(v: Vehicle, slot: PhotoSlot) {
    const formData = await pickPhotoForm("photo", { slot });
    if (!formData) return;
    setUploading(`${v.id}-${slot}`);
    try {
      await api.post(`/driver/vehicles/${v.id}/photos`, formData, { headers: { "Content-Type": "multipart/form-data" } });
      refresh();
    } catch {
      Alert.alert(t("ride.vehicles.error"));
    } finally {
      setUploading(null);
    }
  }

  const edit = (v: Vehicle) => setForm({
    id: v.id, class: v.class, make: v.make ?? "", model: v.model, color: v.color ?? "",
    year: v.year ? String(v.year) : "", plate: v.plate, seats: String(v.seats), insurance_expiry: v.insurance_expiry ?? "",
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />
      <View style={{ backgroundColor: C.teal, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, flexDirection: "row", alignItems: "center", gap: 14 }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={C.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.white, fontWeight: "900", fontSize: 20 }}>{t("ride.vehicles.title")}</Text>
          <Text style={{ color: C.tealLt, fontSize: 12 }}>{t("ride.vehicles.subtitle")}</Text>
        </View>
        <TouchableOpacity onPress={() => { setErrors({}); setForm({ ...EMPTY }); }} accessibilityLabel={t("ride.vehicles.add")}>
          <Ionicons name="add-circle" size={30} color={C.white} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {isLoading ? (
          [0, 1].map(i => <View key={i} style={{ height: 120, borderRadius: 16, backgroundColor: C.border, opacity: 0.5, marginBottom: 12 }} />)
        ) : vehicles.length === 0 ? (
          <View style={{ alignItems: "center", padding: 24, gap: 12 }}>
            <Ionicons name="car-sport-outline" size={42} color={C.muted} />
            <Text style={{ color: C.mid, textAlign: "center" }}>{t("ride.vehicles.empty")}</Text>
            <TouchableOpacity onPress={() => setForm({ ...EMPTY })} accessibilityLabel={t("ride.vehicles.add")}
              style={{ backgroundColor: C.teal, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12 }}>
              <Text style={{ color: C.white, fontWeight: "800" }}>{t("ride.vehicles.add")}</Text>
            </TouchableOpacity>
          </View>
        ) : vehicles.map(v => {
          const photos = photosOf(v);
          return (
            <View key={v.id} style={{ backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: v.is_active ? 2 : 1, borderColor: v.is_active ? C.teal : C.border }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "900", fontSize: 16, color: C.dark }}>{[v.make, v.model].filter(Boolean).join(" ")}</Text>
                  <Text style={{ color: C.mid, marginTop: 2 }}>
                    {t(`ride.vehicles.${v.class}`)} · {v.color ?? "—"} · {v.seats} 👤
                  </Text>
                  <Text style={{ fontWeight: "900", fontSize: 18, color: C.dark, marginTop: 4, letterSpacing: 1 }}>{v.plate}</Text>
                </View>
                {v.is_active ? (
                  <View style={{ backgroundColor: C.tealLt, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Text style={{ color: C.teal, fontWeight: "800", fontSize: 12 }}>{t("ride.vehicles.active")}</Text>
                  </View>
                ) : null}
              </View>

              {insuranceExpired(v) ? <Warning text={t("ride.vehicles.insuranceExpired")} /> : null}
              {!photos.front ? <Warning text={t("ride.vehicles.frontRequired")} /> : null}

              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                {SLOTS.map(slot => (
                  <TouchableOpacity key={slot} onPress={() => uploadPhoto(v, slot)} accessibilityLabel={t(`ride.vehicles.${slot}`)}
                    style={{ flex: 1, aspectRatio: 1, borderRadius: 10, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    {uploading === `${v.id}-${slot}` ? <ActivityIndicator color={C.teal} />
                      : photos[slot] ? <Image source={{ uri: photos[slot] }} style={{ width: "100%", height: "100%" }} />
                      : <Ionicons name="camera-outline" size={20} color={C.muted} />}
                    {!photos[slot] && uploading !== `${v.id}-${slot}` ? (
                      <Text style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{t(`ride.vehicles.${slot}`)}</Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                {!v.is_active ? (
                  <SmallButton label={t("ride.vehicles.makeActive")} onPress={() => activate(v)} primary />
                ) : null}
                <SmallButton label={t("ride.vehicles.edit")} onPress={() => edit(v)} />
                <SmallButton label={t("ride.vehicles.delete")} onPress={() => remove(v)} danger />
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={!!form} animationType="slide" transparent onRequestClose={() => setForm(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "92%" }}>
            {form ? (
              <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 36 }} keyboardShouldPersistTaps="handled">
                <Text style={{ fontWeight: "900", fontSize: 18, color: C.dark, marginBottom: 14 }}>
                  {form.id ? t("ride.vehicles.edit") : t("ride.vehicles.add")}
                </Text>
                <Text style={labelStyle}>{t("ride.vehicles.class")}</Text>
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                  {CLASSES.map(c => (
                    <TouchableOpacity key={c} onPress={() => setForm({ ...form, class: c, seats: c === "moto" ? "1" : form.seats })}
                      accessibilityLabel={t(`ride.vehicles.${c}`)}
                      style={{ flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center", backgroundColor: form.class === c ? C.teal : C.bg, borderWidth: 1.5, borderColor: form.class === c ? C.teal : C.border }}>
                      <Text style={{ color: form.class === c ? C.white : C.mid, fontWeight: "700", fontSize: 12 }}>{t(`ride.vehicles.${c}`)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {errors.class ? <ErrorText text={errors.class} /> : null}
                <Input label={t("ride.vehicles.make")} value={form.make} onChange={v => setForm({ ...form, make: v })} error={errors.make} />
                <Input label={t("ride.vehicles.model")} value={form.model} onChange={v => setForm({ ...form, model: v })} error={errors.model} />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}><Input label={t("ride.vehicles.color")} value={form.color} onChange={v => setForm({ ...form, color: v })} error={errors.color} /></View>
                  <View style={{ flex: 1 }}><Input label={t("ride.vehicles.year")} value={form.year} onChange={v => setForm({ ...form, year: v })} error={errors.year} numeric /></View>
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 2 }}><Input label={t("ride.vehicles.plate")} value={form.plate} onChange={v => setForm({ ...form, plate: v.toUpperCase() })} error={errors.plate} /></View>
                  <View style={{ flex: 1 }}><Input label={t("ride.vehicles.seats")} value={form.seats} onChange={v => setForm({ ...form, seats: v })} error={errors.seats} numeric /></View>
                </View>
                <Input label={t("ride.vehicles.insurance")} value={form.insurance_expiry} onChange={v => setForm({ ...form, insurance_expiry: v })} error={errors.insurance_expiry} placeholder="2026-12-31" />
                <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
                  <TouchableOpacity onPress={() => setForm(null)} accessibilityLabel={t("ride.vehicles.cancel")}
                    style={{ flex: 1, borderRadius: 14, paddingVertical: 15, alignItems: "center", backgroundColor: C.bg }}>
                    <Text style={{ color: C.mid, fontWeight: "800" }}>{t("ride.vehicles.cancel")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => save.mutate(form)} disabled={save.isPending} accessibilityLabel={t("ride.vehicles.save")}
                    style={{ flex: 2, borderRadius: 14, paddingVertical: 15, alignItems: "center", backgroundColor: C.teal }}>
                    {save.isPending ? <ActivityIndicator color={C.white} /> : <Text style={{ color: C.white, fontWeight: "900" }}>{t("ride.vehicles.save")}</Text>}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const labelStyle = { color: C.mid, fontSize: 12, fontWeight: "700" as const, marginBottom: 4 };

function Input({ label, value, onChange, error, numeric, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; error?: string; numeric?: boolean; placeholder?: string;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={labelStyle}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={C.muted}
        keyboardType={numeric ? "number-pad" : "default"} accessibilityLabel={label}
        style={{ backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: C.dark, borderWidth: 1.5, borderColor: error ? C.orange : C.border }} />
      {error ? <ErrorText text={error} /> : null}
    </View>
  );
}

function ErrorText({ text }: { text: string }) {
  return <Text style={{ color: C.orange, fontSize: 12, marginTop: 3 }}>{text}</Text>;
}

function Warning({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 6, alignItems: "center", backgroundColor: C.orangeLt, borderRadius: 8, padding: 8, marginTop: 8 }}>
      <Ionicons name="alert-circle-outline" size={16} color={C.orange} />
      <Text style={{ color: C.orange, fontSize: 12, flex: 1, fontWeight: "600" }}>{text}</Text>
    </View>
  );
}

function SmallButton({ label, onPress, primary, danger }: { label: string; onPress: () => void; primary?: boolean; danger?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} accessibilityLabel={label}
      style={{ flex: 1, borderRadius: 10, paddingVertical: 9, alignItems: "center", backgroundColor: primary ? C.teal : C.bg, borderWidth: 1, borderColor: primary ? C.teal : C.border }}>
      <Text style={{ color: primary ? C.white : danger ? C.orange : C.mid, fontWeight: "700", fontSize: 12 }}>{label}</Text>
    </TouchableOpacity>
  );
}
