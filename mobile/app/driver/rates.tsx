import { useEffect, useMemo, useState } from "react";
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { formatRwf, previewFare, type DriverRates, type ServiceFee } from "@/lib/fare";
import type { components } from "@/lib/apiSchema";

type RatesResponse = components["schemas"]["DriverRatesResponse"];
type Field = "base_fare" | "per_km" | "per_min" | "min_fare" | "pickup_free_km" | "pickup_per_km" | "night_multiplier";

const DEFAULTS: Record<Field, string> = {
  base_fare: "500", per_km: "", per_min: "0", min_fare: "1500",
  pickup_free_km: "2", pickup_per_km: "0", night_multiplier: "1",
};
const PREVIEW_KM = [2, 5, 10];

export default function DriverRatesScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<Field, string> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.driver.rates(),
    queryFn: () => api.get<RatesResponse>("/driver/rates").then(r => r.data),
  });

  useEffect(() => {
    if (!data || form) return;
    const r = data.rates;
    setForm(r ? {
      base_fare: String(r.base_fare), per_km: String(r.per_km), per_min: String(r.per_min ?? 0),
      min_fare: String(r.min_fare), pickup_free_km: String(r.pickup_free_km ?? 2),
      pickup_per_km: String(r.pickup_per_km ?? 0), night_multiplier: String(r.night_multiplier ?? 1),
    } : { ...DEFAULTS, per_km: String(data.guardrails.per_km_min) });
  }, [data, form]);

  const rates: DriverRates | null = useMemo(() => form && {
    base_fare: Number(form.base_fare) || 0,
    per_km: Number(form.per_km) || 0,
    per_min: Number(form.per_min) || 0,
    min_fare: Number(form.min_fare) || 0,
    pickup_free_km: Number(form.pickup_free_km) || 0,
    pickup_per_km: Number(form.pickup_per_km) || 0,
    night_multiplier: Number(form.night_multiplier) || 1,
  }, [form]);

  const save = useMutation({
    mutationFn: (body: DriverRates) => api.put<RatesResponse>("/driver/rates", body).then(r => r.data),
    onSuccess: saved => {
      setErrors({});
      queryClient.setQueryData(queryKeys.driver.rates(), saved);
      Alert.alert(t("ride.rates.saved"));
    },
    onError: (err: any) => {
      const fieldErrors = err?.response?.status === 422 ? err.response.data?.errors : null;
      if (fieldErrors) {
        const first: Record<string, string> = {};
        for (const [k, v] of Object.entries(fieldErrors)) first[k] = Array.isArray(v) ? String(v[0]) : String(v);
        setErrors(first);
        Alert.alert(Object.values(first)[0]);
      } else {
        Alert.alert(t("ride.rates.error"));
      }
    },
  });

  const header = (
    <View style={{ backgroundColor: C.teal, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, flexDirection: "row", alignItems: "center", gap: 14 }}>
      <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Back">
        <Ionicons name="arrow-back" size={24} color={C.white} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.white, fontWeight: "900", fontSize: 20 }}>{t("ride.rates.title")}</Text>
        <Text style={{ color: C.tealLt, fontSize: 12, marginTop: 2 }}>{t("ride.rates.subtitle")}</Text>
      </View>
    </View>
  );

  if (isLoading || !data || !form || !rates) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <StatusBar barStyle="light-content" backgroundColor={C.teal} />
        {header}
        <View style={{ padding: 16, gap: 12 }}>
          {[0, 1, 2].map(i => (
            <View key={i} style={{ height: 64, borderRadius: 14, backgroundColor: C.border, opacity: 0.5 }} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  if (!data.vehicle) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <StatusBar barStyle="light-content" backgroundColor={C.teal} />
        {header}
        <View style={{ padding: 24, alignItems: "center", gap: 14 }}>
          <Ionicons name="car-outline" size={40} color={C.muted} />
          <Text style={{ color: C.mid, fontSize: 15, textAlign: "center" }}>{t("ride.rates.noVehicle")}</Text>
          <TouchableOpacity onPress={() => router.push("/driver/setup")} accessibilityLabel={t("ride.rates.openSetup")}
            style={{ backgroundColor: C.teal, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12 }}>
            <Text style={{ color: C.white, fontWeight: "800" }}>{t("ride.rates.openSetup")}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const g = data.guardrails;
  const fee = data.service_fee as ServiceFee;
  const set = (key: Field) => (v: string) => setForm(f => f && ({ ...f, [key]: v.replace(",", ".") }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />
      {header}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {data.out_of_band ? (
          <View style={{ backgroundColor: C.orangeLt, borderRadius: 12, padding: 12, marginBottom: 12, flexDirection: "row", gap: 8 }}>
            <Ionicons name="alert-circle-outline" size={18} color={C.orange} />
            <Text style={{ color: C.orange, flex: 1, fontWeight: "600" }}>{t("ride.rates.outOfBand")}</Text>
          </View>
        ) : null}

        <Text style={{ color: C.mid, fontSize: 12, marginBottom: 12 }}>
          {data.vehicle.model} · {data.vehicle.plate} · {t("ride.rates.allowed", { min: g.per_km_min, max: g.per_km_max, minFareMax: g.min_fare_max })}
        </Text>

        <View style={{ backgroundColor: C.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.border }}>
          <Row>
            <NumberInput label={t("ride.rates.perKm")} value={form.per_km} onChange={set("per_km")} error={errors.per_km} big />
          </Row>
          <Row>
            <NumberInput label={t("ride.rates.baseFare")} value={form.base_fare} onChange={set("base_fare")} error={errors.base_fare} />
            <NumberInput label={t("ride.rates.minFare")} value={form.min_fare} onChange={set("min_fare")} error={errors.min_fare} />
          </Row>
          <Row>
            <NumberInput label={t("ride.rates.pickupFreeKm")} value={form.pickup_free_km} onChange={set("pickup_free_km")} error={errors.pickup_free_km} />
            <NumberInput label={t("ride.rates.pickupPerKm")} value={form.pickup_per_km} onChange={set("pickup_per_km")} error={errors.pickup_per_km} />
          </Row>
          <Row>
            <NumberInput label={t("ride.rates.perMin")} value={form.per_min} onChange={set("per_min")} error={errors.per_min} />
            <NumberInput label={t("ride.rates.nightMultiplier")} value={form.night_multiplier} onChange={set("night_multiplier")} error={errors.night_multiplier} />
          </Row>
        </View>

        <Text style={{ fontWeight: "800", fontSize: 13, color: C.teal, textTransform: "uppercase", marginTop: 20, marginBottom: 10 }}>
          {t("ride.rates.preview")}
        </Text>
        {PREVIEW_KM.map(km => {
          const p = previewFare(rates, km, fee);
          const earn = p.driverFare * (1 - Number(data.commission_pct) / 100);
          return (
            <View key={km} style={{ backgroundColor: C.white, borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: C.border }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.dark, fontWeight: "700" }}>{t("ride.rates.previewTrip", { km })}</Text>
                <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
                  {t("ride.rates.youEarn", { amount: formatRwf(earn), pct: data.commission_pct })}
                </Text>
              </View>
              <Text style={{ color: C.dark, fontWeight: "900", fontSize: 17 }}>{formatRwf(p.total)}</Text>
            </View>
          );
        })}

        <TouchableOpacity
          onPress={() => save.mutate(rates)}
          disabled={save.isPending}
          accessibilityLabel={t("ride.rates.save")}
          style={{ backgroundColor: C.teal, borderRadius: 16, paddingVertical: 17, alignItems: "center", marginTop: 16 }}>
          {save.isPending
            ? <ActivityIndicator color={C.white} />
            : <Text style={{ color: C.white, fontWeight: "900", fontSize: 16 }}>{t("ride.rates.save")}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>{children}</View>;
}

function NumberInput({ label, value, onChange, error, big }: {
  label: string; value: string; onChange: (v: string) => void; error?: string; big?: boolean;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: C.mid, fontSize: 12, fontWeight: "700", marginBottom: 4 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        accessibilityLabel={label}
        style={{
          backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: big ? 14 : 10,
          fontSize: big ? 22 : 15, fontWeight: big ? "900" : "500", color: C.dark,
          borderWidth: 1.5, borderColor: error ? C.orange : C.border,
        }}
      />
      {error ? <Text style={{ color: C.orange, fontSize: 11, marginTop: 3 }}>{error}</Text> : null}
    </View>
  );
}
