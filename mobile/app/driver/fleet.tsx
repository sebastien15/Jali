import { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StatusBar, Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { C } from "@/constants/theme";
import { useMocks } from "@/lib/env";
import { MOCK_DRIVER_CARS, DriverCar } from "@/constants/data";
import api from "@/lib/api";

const ZONES = ["Kigali CBD", "Nyabugogo", "Remera", "Kimironko", "Gikondo", "Kicukiro", "Kanombe"];
const CAR_TYPES = ["Sedan", "SUV", "Minivan", "Pickup"] as const;
type CarType = typeof CAR_TYPES[number];
type CarStatus = "available" | "rented" | "maintenance";

const STATUS_META: Record<CarStatus, { label: string; color: string; bg: string }> = {
  available:   { label: "Available",   color: C.green,  bg: C.greenLt },
  rented:      { label: "Rented",      color: C.blue,   bg: C.blueLt },
  maintenance: { label: "Maintenance", color: C.orange, bg: C.orangeLt },
};

export default function FleetScreen() {
  const [cars, setCars]           = useState<DriverCar[]>(MOCK_DRIVER_CARS);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [saving, setSaving]       = useState<number | null>(null); // car id being saved
  const [showAdd, setShowAdd]     = useState(false);

  // Editable fields per card (keyed by car id)
  const [edits, setEdits] = useState<Record<number, Partial<DriverCar>>>({});

  function getEdit<K extends keyof DriverCar>(car: DriverCar, key: K): DriverCar[K] {
    return (edits[car.id]?.[key] ?? car[key]) as DriverCar[K];
  }

  function setEdit(id: number, patch: Partial<DriverCar>) {
    setEdits(e => ({ ...e, [id]: { ...e[id], ...patch } }));
  }

  async function saveCar(car: DriverCar) {
    const patch = { ...car, ...edits[car.id] };
    setSaving(car.id);
    try {
      if (!useMocks) {
        await api.patch(`/driver/cars/${car.id}`, patch);
      } else {
        await new Promise(r => setTimeout(r, 500));
      }
      setCars(cs => cs.map(c => c.id === car.id ? { ...c, ...patch } : c));
      setEdits(e => { const n = { ...e }; delete n[car.id]; return n; });
      setExpandedId(null);
    } catch {
      Alert.alert("Error", "Could not save changes.");
    } finally {
      setSaving(null);
    }
  }

  async function removeCar(car: DriverCar) {
    Alert.alert(
      "Remove Car",
      `Remove ${car.name} (${car.plate}) from your fleet?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove", style: "destructive",
          onPress: async () => {
            try {
              if (!useMocks) await api.delete(`/driver/cars/${car.id}`);
              else await new Promise(r => setTimeout(r, 400));
              setCars(cs => cs.filter(c => c.id !== car.id));
            } catch {
              Alert.alert("Error", "Could not remove car.");
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />

      {/* Header */}
      <View style={{
        backgroundColor: C.teal, paddingHorizontal: 20,
        paddingTop: 16, paddingBottom: 20,
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={C.white} />
          </TouchableOpacity>
          <View>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600" }}>Fleet Owner</Text>
            <Text style={{ color: C.white, fontWeight: "900", fontSize: 20 }}>My Fleet</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => setShowAdd(true)}
          style={{
            backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12,
            flexDirection: "row", alignItems: "center", gap: 6,
            paddingHorizontal: 14, paddingVertical: 8,
          }}
        >
          <Ionicons name="add" size={18} color={C.white} />
          <Text style={{ color: C.white, fontWeight: "800", fontSize: 13 }}>Add Car</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {cars.length === 0 && (
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Text style={{ fontSize: 40 }}>🚗</Text>
            <Text style={{ color: C.muted, fontWeight: "700", fontSize: 14, marginTop: 8 }}>
              No cars yet — add your first one!
            </Text>
          </View>
        )}

        {cars.map(car => {
          const expanded = expandedId === car.id;
          const currentStatus = getEdit(car, "status") as CarStatus;
          const meta = STATUS_META[currentStatus];

          return (
            <View key={car.id} style={{
              backgroundColor: C.white, borderRadius: 16, marginBottom: 12,
              shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 }, elevation: 2,
              overflow: "hidden",
            }}>
              {/* Card header — always visible */}
              <TouchableOpacity
                onPress={() => setExpandedId(expanded ? null : car.id)}
                style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <View style={{
                  backgroundColor: C.tealLt, borderRadius: 12,
                  width: 44, height: 44, alignItems: "center", justifyContent: "center",
                }}>
                  <Ionicons name="car" size={22} color={C.teal} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "800", fontSize: 15, color: C.dark }}>{car.name}</Text>
                  <Text style={{ color: C.mid, fontSize: 12, marginTop: 2 }}>
                    {car.plate} · {car.seats} seats · {car.type}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <View style={{ backgroundColor: meta.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 }}>
                    <Text style={{ color: meta.color, fontWeight: "700", fontSize: 11 }}>{meta.label}</Text>
                  </View>
                  <Text style={{ color: C.teal, fontWeight: "700", fontSize: 12 }}>
                    {car.priceDay.toLocaleString()} RWF/day
                  </Text>
                </View>
                <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={C.muted} />
              </TouchableOpacity>

              {/* Expanded edit section */}
              {expanded && (
                <View style={{ paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: C.border }}>

                  {/* Status picker */}
                  <Text style={{ fontWeight: "700", fontSize: 12, color: C.mid, marginTop: 14, marginBottom: 8 }}>
                    Status
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {(Object.keys(STATUS_META) as CarStatus[]).map(s => (
                      <TouchableOpacity
                        key={s}
                        onPress={() => setEdit(car.id, { status: s })}
                        style={{
                          flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center",
                          backgroundColor: currentStatus === s ? STATUS_META[s].bg : C.bg,
                          borderWidth: 1.5,
                          borderColor: currentStatus === s ? STATUS_META[s].color : C.border,
                        }}
                      >
                        <Text style={{
                          fontWeight: "700", fontSize: 11,
                          color: currentStatus === s ? STATUS_META[s].color : C.muted,
                        }}>
                          {STATUS_META[s].label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Price/day */}
                  <Text style={{ fontWeight: "700", fontSize: 12, color: C.mid, marginTop: 14, marginBottom: 6 }}>
                    Price per Day (RWF)
                  </Text>
                  <TextInput
                    value={String(getEdit(car, "priceDay"))}
                    onChangeText={v => setEdit(car.id, { priceDay: parseInt(v) || 0 })}
                    keyboardType="number-pad"
                    style={inputStyle}
                  />

                  {/* Caution */}
                  <Text style={{ fontWeight: "700", fontSize: 12, color: C.mid, marginTop: 12, marginBottom: 6 }}>
                    Caution / Deposit (RWF)
                  </Text>
                  <TextInput
                    value={String(getEdit(car, "caution"))}
                    onChangeText={v => setEdit(car.id, { caution: parseInt(v) || 0 })}
                    keyboardType="number-pad"
                    style={inputStyle}
                  />

                  {/* Allowed zones */}
                  <Text style={{ fontWeight: "700", fontSize: 12, color: C.mid, marginTop: 12, marginBottom: 8 }}>
                    Allowed Zones
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {ZONES.map(z => {
                      const carZones = getEdit(car, "zones") as string[];
                      const active = carZones.includes(z);
                      return (
                        <TouchableOpacity
                          key={z}
                          onPress={() => {
                            const next = active ? carZones.filter(x => x !== z) : [...carZones, z];
                            setEdit(car.id, { zones: next });
                          }}
                          style={{
                            paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
                            backgroundColor: active ? C.teal : C.bg,
                            borderWidth: active ? 0 : 1.5, borderColor: C.border,
                          }}
                        >
                          <Text style={{ color: active ? C.white : C.mid, fontWeight: "700", fontSize: 11 }}>
                            {active ? "✓ " : ""}{z}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Notes */}
                  <Text style={{ fontWeight: "700", fontSize: 12, color: C.mid, marginTop: 12, marginBottom: 6 }}>
                    Notes for Renter
                  </Text>
                  <TextInput
                    value={getEdit(car, "notes") as string}
                    onChangeText={v => setEdit(car.id, { notes: v })}
                    placeholder="e.g. AC, music system"
                    style={[inputStyle, { minHeight: 60 }]}
                    multiline
                  />

                  {/* Actions */}
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                    <TouchableOpacity
                      onPress={() => removeCar(car)}
                      style={{
                        flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center",
                        backgroundColor: "rgba(220,38,38,0.08)",
                      }}
                    >
                      <Text style={{ color: "#DC2626", fontWeight: "800", fontSize: 14 }}>Remove</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => saveCar(car)}
                      disabled={saving === car.id}
                      style={{
                        flex: 2, paddingVertical: 12, borderRadius: 12, alignItems: "center",
                        backgroundColor: C.teal,
                      }}
                    >
                      {saving === car.id
                        ? <ActivityIndicator color={C.white} />
                        : <Text style={{ color: C.white, fontWeight: "800", fontSize: 14 }}>Save Changes</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Add Car bottom sheet */}
      <AddCarSheet
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={(car) => {
          setCars(cs => [...cs, car]);
          setShowAdd(false);
        }}
      />
    </SafeAreaView>
  );
}

// ── Add Car Sheet ──────────────────────────────────────────────────
function AddCarSheet({ visible, onClose, onAdd }: {
  visible: boolean;
  onClose: () => void;
  onAdd: (car: DriverCar) => void;
}) {
  const [name, setName]       = useState("");
  const [type, setType]       = useState<CarType>("Sedan");
  const [plate, setPlate]     = useState("");
  const [seats, setSeats]     = useState("5");
  const [priceDay, setPriceDay] = useState("");
  const [caution, setCaution] = useState("");
  const [saving, setSaving]   = useState(false);

  async function handleAdd() {
    if (!name.trim() || !plate.trim() || !priceDay) {
      Alert.alert("Required", "Please fill in car name, plate, and price/day.");
      return;
    }
    setSaving(true);
    try {
      const newCar: DriverCar = {
        id: Date.now(),
        name: name.trim(),
        type,
        plate: plate.trim().toUpperCase(),
        seats: parseInt(seats) || 5,
        priceDay: parseInt(priceDay),
        caution: caution ? parseInt(caution) : 0,
        status: "available",
        zones: ["Kigali CBD"],
        notes: "",
      };
      if (!useMocks) {
        const res = await api.post("/driver/cars", newCar);
        onAdd({ ...newCar, id: res.data.id });
      } else {
        await new Promise(r => setTimeout(r, 500));
        onAdd(newCar);
      }
      // Reset
      setName(""); setPlate(""); setPriceDay(""); setCaution("");
      setType("Sedan"); setSeats("5");
    } catch {
      Alert.alert("Error", "Could not add car.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, justifyContent: "flex-end" }}
      >
        <View style={{
          backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
          padding: 24, paddingBottom: 40,
          shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20,
          shadowOffset: { width: 0, height: -4 }, elevation: 10,
        }}>
          {/* Handle */}
          <View style={{ width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginBottom: 20 }} />

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <Text style={{ fontWeight: "900", fontSize: 18, color: C.dark }}>Add New Car</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={C.mid} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Label>Car Name / Model</Label>
            <TextInput value={name} onChangeText={setName} placeholder="e.g. Toyota RAV4" style={inputStyle} />

            <Label>Car Type</Label>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
              {CAR_TYPES.map(t => (
                <TouchableOpacity
                  key={t} onPress={() => setType(t)}
                  style={{
                    flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center",
                    backgroundColor: type === t ? C.teal : C.bg,
                    borderWidth: type === t ? 0 : 1.5, borderColor: C.border,
                  }}
                >
                  <Text style={{ color: type === t ? C.white : C.mid, fontWeight: "700", fontSize: 11 }}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Label>Plate Number</Label>
            <TextInput
              value={plate} onChangeText={setPlate}
              placeholder="e.g. RAB 123A" autoCapitalize="characters"
              style={inputStyle}
            />

            <Label>Number of Seats</Label>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <TouchableOpacity
                onPress={() => setSeats(s => String(Math.max(1, parseInt(s) - 1)))}
                style={stepperStyle}
              >
                <Text style={{ color: C.white, fontWeight: "900", fontSize: 18 }}>−</Text>
              </TouchableOpacity>
              <Text style={{ fontWeight: "900", fontSize: 18, color: C.dark, minWidth: 32, textAlign: "center" }}>{seats}</Text>
              <TouchableOpacity
                onPress={() => setSeats(s => String(Math.min(14, parseInt(s) + 1)))}
                style={stepperStyle}
              >
                <Text style={{ color: C.white, fontWeight: "900", fontSize: 18 }}>+</Text>
              </TouchableOpacity>
            </View>

            <Label>Price per Day (RWF)</Label>
            <TextInput value={priceDay} onChangeText={setPriceDay} placeholder="e.g. 65000" keyboardType="number-pad" style={inputStyle} />

            <Label>Caution / Deposit (RWF)</Label>
            <TextInput value={caution} onChangeText={setCaution} placeholder="e.g. 50000" keyboardType="number-pad" style={inputStyle} />

            <TouchableOpacity
              onPress={handleAdd}
              disabled={saving}
              style={{ backgroundColor: C.teal, borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 8 }}
            >
              {saving
                ? <ActivityIndicator color={C.white} />
                : <Text style={{ color: C.white, fontWeight: "900", fontSize: 16 }}>Add to Fleet</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Label({ children }: { children: string }) {
  return (
    <Text style={{ fontWeight: "700", fontSize: 12, color: C.mid, marginBottom: 6, marginTop: 2 }}>{children}</Text>
  );
}

const inputStyle = {
  backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 14,
  paddingVertical: 12, fontSize: 14, color: C.dark,
  borderWidth: 1.5, borderColor: C.border, marginBottom: 14,
};

const stepperStyle = {
  backgroundColor: C.teal, borderRadius: 8, width: 34, height: 34,
  alignItems: "center" as const, justifyContent: "center" as const,
};
