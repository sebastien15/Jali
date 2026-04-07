import { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StatusBar, Alert, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { C } from "@/constants/theme";
import { useMocks } from "@/lib/env";
import { CITIES, MOCK_DRIVER_LISTINGS, DriverListing } from "@/constants/data";
import api from "@/lib/api";

export default function ListingScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id ? parseInt(params.id) : null;
  const existing = editId ? MOCK_DRIVER_LISTINGS.find(l => l.id === editId) : null;

  const [from, setFrom]     = useState(existing?.from ?? "Kigali");
  const [to, setTo]         = useState(existing?.to ?? "");
  const [date, setDate]     = useState(existing?.date ?? "");
  const [dep, setDep]       = useState(existing?.dep ?? "");
  const [seats, setSeats]   = useState(String(existing?.seats ?? 3));
  const [price, setPrice]   = useState(String(existing?.price ?? ""));
  const [notes, setNotes]   = useState(existing?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const [cityPicker, setCityPicker] = useState<"from" | "to" | null>(null);

  async function handleSave() {
    if (!to || !date.trim() || !dep.trim() || !price) {
      Alert.alert("Required", "Please fill in all required fields.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        from, to, date: date.trim(), dep: dep.trim(),
        seats: parseInt(seats), price: parseInt(price), notes,
      };
      if (!useMocks) {
        if (editId) {
          await api.patch(`/driver/listings/${editId}`, payload);
        } else {
          await api.post("/driver/listings", payload);
        }
      } else {
        await new Promise(r => setTimeout(r, 500));
      }
      Alert.alert(
        editId ? "Updated ✓" : "Listed ✓",
        editId ? "Your listing has been updated." : "Your trip is now listed for passengers to book.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch {
      Alert.alert("Error", "Could not save listing.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    Alert.alert("Delete Listing", "Remove this trip listing?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            if (!useMocks) await api.delete(`/driver/listings/${editId}`);
            else await new Promise(r => setTimeout(r, 400));
            router.back();
          } catch {
            Alert.alert("Error", "Could not delete listing.");
          }
        },
      },
    ]);
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
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600" }}>Private Driver</Text>
          <Text style={{ color: C.white, fontWeight: "900", fontSize: 20 }}>
            {editId ? "Edit Listing" : "New Trip Listing"}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>

        {/* Route */}
        <SectionHeader label="Route" icon="map-outline" />

        <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
          <View style={{ flex: 1 }}>
            <Text style={labelStyle}>From</Text>
            <TouchableOpacity
              onPress={() => setCityPicker("from")}
              style={[inputStyle, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}
            >
              <Text style={{ color: C.dark, fontSize: 14, fontWeight: "700" }}>{from}</Text>
              <Ionicons name="chevron-down" size={16} color={C.mid} />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={labelStyle}>To</Text>
            <TouchableOpacity
              onPress={() => setCityPicker("to")}
              style={[inputStyle, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}
            >
              <Text style={{ color: to ? C.dark : C.muted, fontSize: 14, fontWeight: to ? "700" : "400" }}>
                {to || "Pick city"}
              </Text>
              <Ionicons name="chevron-down" size={16} color={C.mid} />
            </TouchableOpacity>
          </View>
        </View>

        {/* City picker inline */}
        {cityPicker && (
          <View style={{
            backgroundColor: C.white, borderRadius: 14, padding: 8, marginBottom: 14,
            borderWidth: 2, borderColor: C.teal,
          }}>
            <Text style={{ fontWeight: "800", fontSize: 12, color: C.teal, paddingHorizontal: 8, paddingTop: 4, paddingBottom: 6 }}>
              Select {cityPicker === "from" ? "departure" : "destination"} city
            </Text>
            {CITIES.map(city => (
              <TouchableOpacity
                key={city}
                onPress={() => {
                  if (cityPicker === "from") setFrom(city);
                  else setTo(city);
                  setCityPicker(null);
                }}
                style={{
                  paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
                  backgroundColor: (cityPicker === "from" ? from : to) === city ? C.tealLt : "transparent",
                }}
              >
                <Text style={{
                  color: (cityPicker === "from" ? from : to) === city ? C.teal : C.dark,
                  fontWeight: "700", fontSize: 14,
                }}>
                  {city}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Schedule */}
        <SectionHeader label="Schedule" icon="time-outline" />

        <View style={{ flexDirection: "row", gap: 10, marginBottom: 4 }}>
          <View style={{ flex: 1 }}>
            <Text style={labelStyle}>Date</Text>
            <TextInput
              value={date} onChangeText={setDate}
              placeholder="e.g. Apr 10"
              style={inputStyle}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={labelStyle}>Departure Time</Text>
            <TextInput
              value={dep} onChangeText={setDep}
              placeholder="e.g. 07:00"
              style={inputStyle}
            />
          </View>
        </View>

        {/* Capacity & Pricing */}
        <SectionHeader label="Capacity & Pricing" icon="cash-outline" />

        <Text style={labelStyle}>Available Seats</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <TouchableOpacity
            onPress={() => setSeats(s => String(Math.max(1, parseInt(s) - 1)))}
            style={stepperStyle}
          >
            <Text style={{ color: C.white, fontWeight: "900", fontSize: 18 }}>−</Text>
          </TouchableOpacity>
          <Text style={{ fontWeight: "900", fontSize: 20, color: C.dark, minWidth: 32, textAlign: "center" }}>{seats}</Text>
          <TouchableOpacity
            onPress={() => setSeats(s => String(Math.min(6, parseInt(s) + 1)))}
            style={stepperStyle}
          >
            <Text style={{ color: C.white, fontWeight: "900", fontSize: 18 }}>+</Text>
          </TouchableOpacity>
        </View>

        <Text style={labelStyle}>Price per Seat (RWF)</Text>
        <TextInput
          value={price} onChangeText={setPrice}
          placeholder="e.g. 8000"
          keyboardType="number-pad"
          style={inputStyle}
        />

        {/* Notes */}
        <SectionHeader label="Notes" icon="chatbubble-outline" />

        <Text style={labelStyle}>Notes for Passengers (optional)</Text>
        <TextInput
          value={notes} onChangeText={setNotes}
          placeholder="e.g. AC available, luggage allowed"
          style={[inputStyle, { minHeight: 72 }]}
          multiline
        />

        {/* Save */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={{
            backgroundColor: C.teal, borderRadius: 16,
            paddingVertical: 18, alignItems: "center", marginTop: 8,
            marginBottom: editId ? 10 : 32,
          }}
        >
          {saving
            ? <ActivityIndicator color={C.white} />
            : <Text style={{ color: C.white, fontWeight: "900", fontSize: 17 }}>
                {editId ? "Update Listing ✓" : "Publish Listing ✓"}
              </Text>
          }
        </TouchableOpacity>

        {editId && (
          <TouchableOpacity
            onPress={handleDelete}
            style={{ paddingVertical: 14, alignItems: "center", marginBottom: 32 }}
          >
            <Text style={{ color: "#DC2626", fontSize: 14, fontWeight: "700" }}>Delete this listing</Text>
          </TouchableOpacity>
        )}
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

const labelStyle = {
  fontWeight: "700" as const, fontSize: 12, color: C.mid, marginBottom: 6,
};

const inputStyle = {
  backgroundColor: C.white, borderRadius: 12, paddingHorizontal: 14,
  paddingVertical: 13, fontSize: 14, color: C.dark,
  borderWidth: 1.5, borderColor: C.border, marginBottom: 14,
};

const stepperStyle = {
  backgroundColor: C.teal, borderRadius: 8, width: 36, height: 36,
  alignItems: "center" as const, justifyContent: "center" as const,
};
