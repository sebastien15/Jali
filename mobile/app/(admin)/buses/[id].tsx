import { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StatusBar, ActivityIndicator, Alert, Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import AdminHeader from "@/components/admin/AdminHeader";

export default function AdminBusFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving]   = useState(false);
  const [agency, setAgency]   = useState("");
  const [from, setFrom]       = useState("");
  const [to, setTo]           = useState("");
  const [dep, setDep]         = useState("");
  const [arr, setArr]         = useState("");
  const [price, setPrice]     = useState("");
  const [seats, setSeats]     = useState("30");
  const [active, setActive]   = useState(true);

  useEffect(() => {
    if (isNew) return;
    api.get("/admin/buses").then(res => {
      const bus = (res.data as any[]).find(b => String(b.id) === id);
      if (bus) {
        setAgency(bus.agency ?? ""); setFrom(bus.from ?? ""); setTo(bus.to ?? "");
        setDep(bus.dep ?? ""); setArr(bus.arr ?? ""); setPrice(String(bus.price ?? ""));
        setSeats(String(bus.seats ?? "30")); setActive(bus.active ?? true);
      }
    }).catch(() => Alert.alert("Error", "Could not load bus."))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  async function handleSave() {
    if (!agency.trim() || !from.trim() || !to.trim() || !dep.trim() || !price.trim()) {
      Alert.alert("Required", "Fill in all required fields.");
      return;
    }
    setSaving(true);
    try {
      const payload = { agency, from, to, dep, arr, active, price: parseInt(price), seats: parseInt(seats) };
      if (isNew) await api.post("/admin/buses", payload);
      else await api.patch(`/admin/buses/${id}`, payload);
      Alert.alert("Saved", isNew ? "Bus added." : "Bus updated.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Error", "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={C.teal} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />

      <AdminHeader title={isNew ? "Add Bus" : "Edit Bus"} showBack />

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={{
          backgroundColor: C.white, borderRadius: 20, padding: 16,
          shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 10,
          shadowOffset: { width: 0, height: 2 }, elevation: 3,
        }}>
          <Field label="Agency *" value={agency} onChangeText={setAgency} placeholder="e.g. Volcano Express" />
          <Field label="From *" value={from} onChangeText={setFrom} placeholder="e.g. Kigali" />
          <Field label="To *" value={to} onChangeText={setTo} placeholder="e.g. Musanze" />
          <Field label="Departure *" value={dep} onChangeText={setDep} placeholder="e.g. 07:00" />
          <Field label="Arrival" value={arr} onChangeText={setArr} placeholder="e.g. 09:30" />
          <Field label="Price (RWF) *" value={price} onChangeText={setPrice} placeholder="e.g. 3000" keyboardType="number-pad" />
          <Field label="Seats" value={seats} onChangeText={setSeats} placeholder="e.g. 30" keyboardType="number-pad" />

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6, marginBottom: 8 }}>
            <Text style={{ fontWeight: "700", fontSize: 13, color: C.mid }}>Active (visible to passengers)</Text>
            <Switch value={active} onValueChange={setActive} trackColor={{ true: C.teal }} />
          </View>
        </View>

        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={{ backgroundColor: C.teal, borderRadius: 16, paddingVertical: 18, alignItems: "center", marginTop: 16, marginBottom: 32 }}
        >
          {saving
            ? <ActivityIndicator color={C.white} />
            : <Text style={{ color: C.white, fontWeight: "900", fontSize: 17 }}>{isNew ? "Add Bus" : "Save Changes"}</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType = "default" as any }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontWeight: "700", fontSize: 13, color: C.mid, marginBottom: 6 }}>{label}</Text>
      <TextInput
        value={value} onChangeText={onChangeText} placeholder={placeholder}
        placeholderTextColor={C.muted} keyboardType={keyboardType}
        style={{
          backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 14,
          paddingVertical: 13, fontSize: 15, color: C.dark,
          borderWidth: 1.5, borderColor: C.border,
        }}
      />
    </View>
  );
}
