import { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StatusBar, Alert, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { C } from "@/constants/theme";
import { useDriverMode, DriverType } from "@/lib/DriverModeContext";
import { useMocks } from "@/lib/env";
import { auth } from "@/lib/firebase";
import api from "@/lib/api";

const ZONES = ["Kigali CBD", "Nyabugogo", "Remera", "Kimironko", "Gikondo", "Kicukiro", "Kanombe"];
const CAR_TYPES = ["Sedan", "SUV", "Minivan", "Pickup"] as const;

export default function DriverSetupScreen() {
  const { driverType } = useDriverMode();
  const isRental = driverType === "rental";

  const [saving, setSaving]         = useState(false);
  const [name, setName]             = useState(auth.currentUser?.displayName ?? "");
  const [phone, setPhone]           = useState(auth.currentUser?.phoneNumber ?? "");
  const [carModel, setCarModel]     = useState("");
  const [plate, setPlate]           = useState("");
  const [seats, setSeats]           = useState("4");
  const [carType, setCarType]       = useState<typeof CAR_TYPES[number]>("Sedan");
  const [priceDay, setPriceDay]     = useState("");
  const [caution, setCaution]       = useState("");
  const [insExpiry, setInsExpiry]   = useState("");
  const [zones, setZones]           = useState<number[]>([0]);
  const [docsUrl, setDocsUrl]       = useState("");

  function toggleZone(i: number) {
    setZones(z => z.includes(i) ? z.filter(x => x !== i) : [...z, i]);
  }

  async function handleSave() {
    if (!carModel.trim() || !plate.trim()) {
      Alert.alert("Required", "Please fill in car model and plate number.");
      return;
    }
    setSaving(true);
    try {
      if (!useMocks) {
        await api.patch("/driver/profile", {
          name,
          car_model: carModel,
          plate,
          seats: parseInt(seats),
          car_type: carType,
          price_day: priceDay ? parseInt(priceDay) : undefined,
          caution: caution ? parseInt(caution) : undefined,
          insurance_expiry: insExpiry,
          allowed_zones: zones.map(i => ZONES[i]),
          docs_url: docsUrl,
        });
      } else {
        await new Promise(r => setTimeout(r, 600));
      }
      Alert.alert("Saved ✓", "Your profile has been updated.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Error", "Could not save. Please try again.");
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
            {isRental ? "Fleet Owner" : "Private Driver"}
          </Text>
          <Text style={{ color: C.white, fontWeight: "900", fontSize: 20 }}>My Setup</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>

        {/* Section: Profile */}
        <SectionHeader label="My Profile" icon="person-outline" />

        <Field label="Display Name">
          <TextInput
            value={name} onChangeText={setName}
            placeholder="Your name"
            style={styles.input}
          />
        </Field>

        <Field label="Phone Number">
          <TextInput
            value={phone} editable={false}
            placeholder="+250 7XX XXX XXX"
            style={[styles.input, { color: C.muted }]}
          />
        </Field>

        {/* Section: Vehicle */}
        <SectionHeader label="My Vehicle" icon="car-outline" />

        <Field label="Car Model">
          <TextInput
            value={carModel} onChangeText={setCarModel}
            placeholder="e.g. Toyota Hiace"
            style={styles.input}
          />
        </Field>

        <Field label="Plate Number">
          <TextInput
            value={plate} onChangeText={setPlate}
            placeholder="e.g. RAB 123A"
            autoCapitalize="characters"
            style={styles.input}
          />
        </Field>

        <Field label="Car Type">
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {CAR_TYPES.map(t => (
              <TouchableOpacity
                key={t} onPress={() => setCarType(t)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
                  backgroundColor: carType === t ? C.teal : C.bg,
                  borderWidth: carType === t ? 0 : 2, borderColor: C.border,
                }}
              >
                <Text style={{ color: carType === t ? C.white : C.mid, fontWeight: "700", fontSize: 13 }}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        <Field label="Number of Seats">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <TouchableOpacity
              onPress={() => setSeats(s => String(Math.max(1, parseInt(s) - 1)))}
              style={styles.stepper}
            >
              <Text style={{ color: C.white, fontWeight: "900", fontSize: 18 }}>−</Text>
            </TouchableOpacity>
            <Text style={{ fontWeight: "900", fontSize: 18, color: C.dark, minWidth: 32, textAlign: "center" }}>
              {seats}
            </Text>
            <TouchableOpacity
              onPress={() => setSeats(s => String(Math.min(14, parseInt(s) + 1)))}
              style={styles.stepper}
            >
              <Text style={{ color: C.white, fontWeight: "900", fontSize: 18 }}>+</Text>
            </TouchableOpacity>
          </View>
        </Field>

        {/* Rental-only fields */}
        {isRental && (
          <>
            <Field label="Price per Day (RWF)">
              <TextInput
                value={priceDay} onChangeText={setPriceDay}
                placeholder="e.g. 65000"
                keyboardType="number-pad"
                style={styles.input}
              />
            </Field>

            <Field label="Caution / Deposit (RWF)">
              <TextInput
                value={caution} onChangeText={setCaution}
                placeholder="e.g. 50000"
                keyboardType="number-pad"
                style={styles.input}
              />
            </Field>
          </>
        )}

        {/* Section: Operations */}
        <SectionHeader label="Operations" icon="map-outline" />

        <Field label="Allowed Zones">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {ZONES.map((z, i) => {
              const active = zones.includes(i);
              return (
                <TouchableOpacity
                  key={i} onPress={() => toggleZone(i)}
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

        <Field label="Insurance Expiry">
          <TextInput
            value={insExpiry} onChangeText={setInsExpiry}
            placeholder="e.g. Dec 2025"
            style={styles.input}
          />
        </Field>

        <Field label="T&Cs / Insurance Doc URL">
          <TextInput
            value={docsUrl} onChangeText={setDocsUrl}
            placeholder="Paste Firebase Storage link"
            autoCapitalize="none"
            style={styles.input}
          />
          <Text style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>
            Upload the doc to Firebase Storage and paste the URL here
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
            : <Text style={{ color: C.white, fontWeight: "900", fontSize: 17 }}>Save Changes ✓</Text>
          }
        </TouchableOpacity>
      </ScrollView>
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
