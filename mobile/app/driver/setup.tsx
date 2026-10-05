import { useEffect, useRef, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StatusBar, Alert, ActivityIndicator, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { C } from "@/constants/theme";
import { useDriverMode, DriverType } from "@/lib/DriverModeContext";
import { auth } from "@/lib/firebase";
import { CAR_AMENITIES, CarAmenity } from "@/constants/data";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

const ZONES = ["Kigali CBD", "Nyabugogo", "Remera", "Kimironko", "Gikondo", "Kicukiro", "Kanombe"];
const CAR_TYPES = ["Sedan", "SUV", "Minivan", "Pickup"] as const;

type PhotoSlot = "front" | "side" | "interior" | "luggage";
const PHOTO_SLOTS: { key: PhotoSlot; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[] = [
  { key: "front",    label: "Front View",     icon: "car-outline" },
  { key: "side",     label: "Side View",      icon: "car-sport-outline" },
  { key: "interior", label: "Interior",       icon: "grid-outline" },
  { key: "luggage",  label: "Luggage Space",  icon: "briefcase-outline" },
];

type DriverProfileResponse = {
  user: { name: string | null; phone: string | null };
  profile: { allowed_zones: string[]; docs_url: string | null } | null;
  vehicle: {
    model: string; plate: string; seats: number; body_type: string | null;
    amenities: string[] | null; insurance_expiry: string | null;
    rental_price_day: number | null; rental_caution: number | null;
  } | null;
};

type FieldErrors = Partial<Record<string, string>>;

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
  const [amenities, setAmenities]   = useState<CarAmenity[]>([]);
  const [photos, setPhotos]         = useState<Record<PhotoSlot, string | null>>({
    front: null, side: null, interior: null, luggage: null,
  });
  const [errors, setErrors]         = useState<FieldErrors>({});

  const queryClient = useQueryClient();
  const { data: saved, isLoading } = useQuery({
    queryKey: queryKeys.driver.profile(),
    queryFn: () => api.get<DriverProfileResponse>("/driver/profile").then(r => r.data),
    staleTime: 5 * 60_000,
  });

  // Pre-fill the form once with what the server already has
  const prefilled = useRef(false);
  useEffect(() => {
    if (!saved || prefilled.current) return;
    prefilled.current = true;
    if (saved.user.name) setName(saved.user.name);
    if (saved.user.phone) setPhone(saved.user.phone);
    if (saved.profile) {
      const idx = saved.profile.allowed_zones
        .map(z => ZONES.indexOf(z))
        .filter(i => i >= 0);
      if (idx.length) setZones(idx);
      setDocsUrl(saved.profile.docs_url ?? "");
    }
    const v = saved.vehicle;
    if (v) {
      setCarModel(v.model);
      setPlate(v.plate);
      setSeats(String(v.seats));
      if (v.body_type && (CAR_TYPES as readonly string[]).includes(v.body_type)) {
        setCarType(v.body_type as typeof CAR_TYPES[number]);
      }
      setAmenities((v.amenities ?? []) as CarAmenity[]);
      setInsExpiry(v.insurance_expiry ?? "");
      setPriceDay(v.rental_price_day != null ? String(v.rental_price_day) : "");
      setCaution(v.rental_caution != null ? String(v.rental_caution) : "");
    }
  }, [saved]);

  function toggleZone(i: number) {
    setZones(z => z.includes(i) ? z.filter(x => x !== i) : [...z, i]);
  }

  function toggleAmenity(a: CarAmenity) {
    setAmenities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  }

  async function pickPhoto(slot: PhotoSlot) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow access to your photo library.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled) {
      setPhotos(p => ({ ...p, [slot]: result.assets[0].uri }));
    }
  }

  async function handleSave() {
    if (!carModel.trim() || !plate.trim()) {
      Alert.alert("Required", "Please fill in car model and plate number.");
      return;
    }
    setSaving(true);
    setErrors({});
    try {
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
        amenities,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.driver.profile() });
      Alert.alert("Saved ✓", "Your profile has been updated.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      const fieldErrors = err?.response?.status === 422 ? err.response.data?.errors : null;
      if (fieldErrors) {
        const first: FieldErrors = {};
        for (const [key, messages] of Object.entries(fieldErrors)) {
          first[key] = Array.isArray(messages) ? String(messages[0]) : String(messages);
        }
        setErrors(first);
        Alert.alert("Check your details", Object.values(first)[0] ?? "Some fields are invalid.");
      } else {
        Alert.alert("Error", "Could not save. Please try again.");
      }
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
        {isLoading ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <ActivityIndicator size="small" color={C.teal} />
            <Text style={{ color: C.muted, fontSize: 12 }}>Loading your saved details…</Text>
          </View>
        ) : null}

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

        <Field label="Car Model" error={errors.car_model}>
          <TextInput
            value={carModel} onChangeText={setCarModel}
            placeholder="e.g. Toyota Hiace"
            style={styles.input}
          />
        </Field>

        <Field label="Plate Number" error={errors.plate}>
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

        <Field label="Number of Seats" error={errors.seats}>
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

        {/* Section: Car Amenities */}
        <SectionHeader label="What's in Your Car" icon="sparkles-outline" />
        <Text style={{ color: C.muted, fontSize: 12, marginBottom: 10 }}>
          Passengers will see these when browsing your listing
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

        {/* Section: Car Photos */}
        <SectionHeader label="Car Photos" icon="camera-outline" />
        <Text style={{ color: C.muted, fontSize: 12, marginBottom: 12 }}>
          Add up to 4 photos so passengers know what to expect
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 4 }}>
          {PHOTO_SLOTS.map(slot => {
            const uri = photos[slot.key];
            return (
              <TouchableOpacity
                key={slot.key}
                onPress={() => pickPhoto(slot.key)}
                style={{
                  width: "47%", aspectRatio: 4 / 3, borderRadius: 14,
                  backgroundColor: uri ? "transparent" : C.white,
                  borderWidth: uri ? 0 : 2, borderColor: C.border,
                  borderStyle: uri ? undefined : "dashed",
                  overflow: "hidden",
                  alignItems: "center", justifyContent: "center",
                }}
              >
                {uri ? (
                  <>
                    <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                    <View style={{
                      position: "absolute", bottom: 0, left: 0, right: 0,
                      backgroundColor: "rgba(0,0,0,0.45)", paddingVertical: 5, alignItems: "center",
                      flexDirection: "row", justifyContent: "center", gap: 4,
                    }}>
                      <Ionicons name="pencil" size={11} color={C.white} />
                      <Text style={{ color: C.white, fontSize: 11, fontWeight: "700" }}>{slot.label}</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <Ionicons name={slot.icon} size={26} color={C.border} />
                    <Text style={{ color: C.muted, fontSize: 11, fontWeight: "700", marginTop: 6 }}>
                      {slot.label}
                    </Text>
                    <Text style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>Tap to add</Text>
                  </>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

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

        <Field label="Insurance Expiry" error={errors.insurance_expiry}>
          <TextInput
            value={insExpiry} onChangeText={setInsExpiry}
            placeholder="YYYY-MM-DD, e.g. 2026-12-31"
            keyboardType="numbers-and-punctuation"
            style={styles.input}
          />
        </Field>

        <Field label="T&Cs / Insurance Doc URL" error={errors.docs_url}>
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

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontWeight: "700", fontSize: 13, color: C.mid, marginBottom: 6 }}>{label}</Text>
      {children}
      {error ? (
        <Text style={{ color: C.orange, fontSize: 12, fontWeight: "600", marginTop: 4 }}>{error}</Text>
      ) : null}
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
