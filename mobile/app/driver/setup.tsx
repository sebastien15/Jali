import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StatusBar, Alert, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import { useDriverMode } from "@/core/session/DriverModeContext";
import { CAR_AMENITIES, CarAmenity } from "@/constants/data";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { components } from "@/lib/apiSchema";

const ZONES = ["Kigali CBD", "Nyabugogo", "Remera", "Kimironko", "Gikondo", "Kicukiro", "Kanombe"];
const CAR_TYPES = ["Sedan", "SUV", "Minivan", "Pickup"] as const;
type CarType = typeof CAR_TYPES[number];
const CAR_TYPE_KEYS: Record<CarType, string> = {
  Sedan: "driverSetup.carTypeSedan",
  SUV: "driverSetup.carTypeSuv",
  Minivan: "driverSetup.carTypeMinivan",
  Pickup: "driverSetup.carTypePickup",
};

/** GET/PATCH /driver/profile response (DriverController@profile). */
type DriverProfile = components["schemas"]["DriverProfileResponse"];

function apiErrorMessage(e: any): string | undefined {
  const errors = e?.response?.data?.errors;
  if (errors && typeof errors === "object") {
    const first = Object.values(errors)[0];
    if (Array.isArray(first) && first.length) return String(first[0]);
  }
  return e?.response?.data?.message;
}

export default function DriverSetupScreen() {
  const { t } = useTranslation();
  const { driverType } = useDriverMode();
  const isRental = driverType === "rental";
  const queryClient = useQueryClient();

  const [saving, setSaving]         = useState(false);
  const [name, setName]             = useState("");
  const [phone, setPhone]           = useState("");
  const [carModel, setCarModel]     = useState("");
  const [plate, setPlate]           = useState("");
  const [seats, setSeats]           = useState("4");
  const [carType, setCarType]       = useState<CarType>("Sedan");
  const [priceDay, setPriceDay]     = useState("");
  const [caution, setCaution]       = useState("");
  const [insExpiry, setInsExpiry]   = useState("");
  const [zones, setZones]           = useState<string[]>([ZONES[0]]);
  const [docsUrl, setDocsUrl]       = useState("");
  const [amenities, setAmenities]   = useState<CarAmenity[]>([]);

  // Prefill from what the backend actually stored
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.driver.profile(),
    queryFn: () => api.get("/driver/profile").then(r => r.data as DriverProfile),
    staleTime: 5 * 60_000,
  });

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (!data || hydrated) return;
    setHydrated(true);
    setName(data.user.name ?? "");
    setPhone(data.user.phone ?? "");
    if (data.profile) {
      if (Array.isArray(data.profile.allowed_zones)) setZones(data.profile.allowed_zones);
      setDocsUrl(data.profile.docs_url ?? "");
    }
    const v = data.vehicle;
    if (v) {
      setCarModel(v.model ?? "");
      setPlate(v.plate ?? "");
      if (v.seats) setSeats(String(v.seats));
      if (v.body_type && (CAR_TYPES as readonly string[]).includes(v.body_type)) setCarType(v.body_type as CarType);
      setPriceDay(v.rental_price_day != null ? String(v.rental_price_day) : "");
      setCaution(v.rental_caution != null ? String(v.rental_caution) : "");
      setInsExpiry(v.insurance_expiry ?? "");
      if (Array.isArray(v.amenities)) {
        setAmenities(v.amenities.filter((a): a is CarAmenity => (CAR_AMENITIES as readonly string[]).includes(a)));
      }
    }
  }, [data, hydrated]);

  function toggleZone(z: string) {
    setZones(prev => prev.includes(z) ? prev.filter(x => x !== z) : [...prev, z]);
  }

  function toggleAmenity(a: CarAmenity) {
    setAmenities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  }

  async function handleSave() {
    if (!carModel.trim() || !plate.trim()) {
      Alert.alert(t("driverSetup.required"), t("driverSetup.fillCarDetails"));
      return;
    }
    const url = docsUrl.trim();
    if (url && !/^https?:\/\/\S+$/i.test(url)) {
      Alert.alert(t("driverSetup.required"), t("driverSetup.invalidDocsUrl"));
      return;
    }
    setSaving(true);
    try {
      const res = await api.patch("/driver/profile", {
        ...(name.trim() ? { name: name.trim() } : {}),
        car_model: carModel.trim(),
        plate: plate.trim(),
        seats: parseInt(seats, 10),
        car_type: carType,
        price_day: priceDay ? parseInt(priceDay, 10) : null,
        caution: caution ? parseInt(caution, 10) : null,
        insurance_expiry: insExpiry.trim() || null,
        allowed_zones: zones,
        docs_url: url || null,
        amenities,
      });
      if (res.data) queryClient.setQueryData(queryKeys.driver.profile(), res.data);
      queryClient.invalidateQueries({ queryKey: queryKeys.me() });
      Alert.alert(`${t("driverSetup.saved")} ✓`, t("driverSetup.profileUpdated"), [
        { text: t("common.ok"), onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert(t("driverSetup.error"), apiErrorMessage(e) ?? t("driverSetup.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />

      {/* Header */}
      <View style={{
        backgroundColor: C.teal, paddingHorizontal: 20,
        paddingTop: 16, paddingBottom: 20,
        flexDirection: "row", alignItems: "center", gap: 14,
      }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={C.white} />
        </TouchableOpacity>
        <View>
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600" }}>
            {isRental ? t("driverSetup.fleetOwner") : t("driverSetup.privateDriver")}
          </Text>
          <Text style={{ color: C.white, fontWeight: "900", fontSize: 20 }}>{t("driverSetup.mySetup")}</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={C.teal} />
        </View>
      ) : (
      <ScrollView contentContainerStyle={{ padding: 16 }}>

        {/* Section: Profile */}
        <SectionHeader label={t("driverSetup.myProfile")} icon="person-outline" />

        <Field label={t("driverSetup.displayName")}>
          <TextInput
            value={name} onChangeText={setName}
            placeholder={t("driverSetup.yourName")}
            style={styles.input}
          />
        </Field>

        <Field label={t("driverSetup.phoneNumber")}>
          <TextInput
            value={phone} editable={false}
            placeholder="+250 7XX XXX XXX"
            style={[styles.input, { color: C.muted }]}
          />
        </Field>

        {/* Section: Vehicle */}
        <SectionHeader label={t("driverSetup.myVehicle")} icon="car-outline" />

        <Field label={t("driverSetup.carModel")}>
          <TextInput
            value={carModel} onChangeText={setCarModel}
            placeholder="Toyota Hiace"
            style={styles.input}
          />
        </Field>

        <Field label={t("driverSetup.plateNumber")}>
          <TextInput
            value={plate} onChangeText={setPlate}
            placeholder="RAB 123A"
            autoCapitalize="characters"
            style={styles.input}
          />
        </Field>

        <Field label={t("driverSetup.carType")}>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {CAR_TYPES.map(ct => (
              <TouchableOpacity
                key={ct} onPress={() => setCarType(ct)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
                  backgroundColor: carType === ct ? C.teal : C.bg,
                  borderWidth: carType === ct ? 0 : 2, borderColor: C.border,
                }}
              >
                <Text style={{ color: carType === ct ? C.white : C.mid, fontWeight: "700", fontSize: 13 }}>
                  {t(CAR_TYPE_KEYS[ct])}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        <Field label={t("driverSetup.numberOfSeats")}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <TouchableOpacity
              onPress={() => setSeats(s => String(Math.max(1, parseInt(s, 10) - 1)))}
              style={styles.stepper}
            >
              <Text style={{ color: C.white, fontWeight: "900", fontSize: 18 }}>−</Text>
            </TouchableOpacity>
            <Text style={{ fontWeight: "900", fontSize: 18, color: C.dark, minWidth: 32, textAlign: "center" }}>
              {seats}
            </Text>
            <TouchableOpacity
              onPress={() => setSeats(s => String(Math.min(14, parseInt(s, 10) + 1)))}
              style={styles.stepper}
            >
              <Text style={{ color: C.white, fontWeight: "900", fontSize: 18 }}>+</Text>
            </TouchableOpacity>
          </View>
        </Field>

        {/* Rental-only fields */}
        {isRental && (
          <>
            <Field label={t("driverSetup.pricePerDay")}>
              <TextInput
                value={priceDay} onChangeText={setPriceDay}
                placeholder="65000"
                keyboardType="number-pad"
                style={styles.input}
              />
            </Field>

            <Field label={t("driverSetup.cautionDeposit")}>
              <TextInput
                value={caution} onChangeText={setCaution}
                placeholder="50000"
                keyboardType="number-pad"
                style={styles.input}
              />
            </Field>
          </>
        )}

        {/* Section: Car Amenities */}
        <SectionHeader label={t("driverSetup.whatsInYourCar")} icon="sparkles-outline" />
        <Text style={{ color: C.muted, fontSize: 12, marginBottom: 10 }}>
          {t("driverSetup.amenitiesHint")}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
          {CAR_AMENITIES.map(a => {
            const on = amenities.includes(a);
            return (
              <TouchableOpacity
                key={a} onPress={() => toggleAmenity(a)}
                style={{
                  paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
                  backgroundColor: on ? C.teal : C.bg,
                  borderWidth: on ? 0 : 2, borderColor: C.border,
                }}
              >
                <Text style={{ color: on ? C.white : C.mid, fontWeight: "700", fontSize: 12 }}>
                  {on ? "✓ " : ""}{a}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Car photos are not offered until the backend has an upload endpoint:
            picked local file:// URIs were never persisted. */}

        {/* Section: Operations */}
        <SectionHeader label={t("driverSetup.operations")} icon="map-outline" />

        <Field label={t("driverSetup.allowedZones")}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {ZONES.map(z => {
              const active = zones.includes(z);
              return (
                <TouchableOpacity
                  key={z} onPress={() => toggleZone(z)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
                    backgroundColor: active ? C.teal : C.bg,
                    borderWidth: active ? 0 : 2, borderColor: C.border,
                  }}
                >
                  <Text style={{ color: active ? C.white : C.mid, fontWeight: "700", fontSize: 12 }}>
                    {active ? "✓ " : ""}{z}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Field>

        <Field label={t("driverSetup.insuranceExpiry")}>
          <TextInput
            value={insExpiry} onChangeText={setInsExpiry}
            placeholder="2026-12"
            style={styles.input}
          />
        </Field>

        <Field label={t("driverSetup.docsUrl")}>
          <TextInput
            value={docsUrl} onChangeText={setDocsUrl}
            placeholder="https://"
            autoCapitalize="none"
            keyboardType="url"
            style={styles.input}
          />
          <Text style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>
            {t("driverSetup.docsUrlHint")}
          </Text>
        </Field>

        {/* Save */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={{
            backgroundColor: C.teal, borderRadius: 16,
            paddingVertical: 18, alignItems: "center", marginTop: 8, marginBottom: 32,
          }}
        >
          {saving
            ? <ActivityIndicator color={C.white} />
            : <Text style={{ color: C.white, fontWeight: "900", fontSize: 17 }}>{t("driverSetup.saveChanges")} ✓</Text>
          }
        </TouchableOpacity>
      </ScrollView>
      )}
    </SafeAreaView>
  );
}

function SectionHeader({ label, icon }: { label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 20, marginBottom: 12 }}>
      <Ionicons name={icon} size={16} color={C.teal} />
      <Text style={{ fontWeight: "800", fontSize: 13, color: C.teal, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </Text>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontWeight: "700", fontSize: 13, color: C.mid, marginBottom: 6 }}>{label}</Text>
      {children}
    </View>
  );
}

const styles = {
  input: {
    backgroundColor: C.white, borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 13, fontSize: 15, color: C.dark,
    borderWidth: 1.5, borderColor: C.border,
  },
  stepper: {
    backgroundColor: C.teal, borderRadius: 8, width: 34, height: 34,
    alignItems: "center" as const, justifyContent: "center" as const,
  },
};
