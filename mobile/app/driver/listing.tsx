import { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StatusBar, Alert, ActivityIndicator, Switch, Modal, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import { isDev, isTest } from "@/lib/env";
import { queryKeys } from "@/lib/queryKeys";

// DateTimePicker is a native community module — not available in Expo Go.
// Lazy-require it so dev/test (Expo Go) mode never loads the native binary.
const DateTimePicker = (isDev || isTest)
  ? null
  : (require("@react-native-community/datetimepicker").default as React.ComponentType<any>);
import {
  CITIES, BUS_STATIONS, CAR_AMENITIES, CarAmenity, DriverListing,
} from "@/constants/data";
import api from "@/lib/api";

const DISCOUNT_PCTS = [5, 10, 15, 20];

function formatDate(d: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function parseDateString(s: string): Date {
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

export default function ListingScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id ? parseInt(params.id) : null;

  // Route
  const [from, setFrom]                   = useState("Kigali");
  const [to, setTo]                       = useState("");
  const [pickupStation, setPickupStation] = useState("");
  const [dropLocation, setDropLocation]   = useState("");
  const [cityPicker, setCityPicker]       = useState<"from" | "to" | null>(null);

  // Schedule
  const [date, setDate]               = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [hour, setHour]               = useState("07");
  const [minute, setMinute]           = useState("00");
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pendingHour, setPendingHour]       = useState("07");
  const [pendingMinute, setPendingMinute]   = useState("00");

  // Capacity & pricing
  const [seats, setSeats]   = useState("3");
  const [price, setPrice]   = useState("");

  // Amenities
  const [amenities, setAmenities] = useState<CarAmenity[]>([]);

  // Group discount
  const [groupDiscount, setGroupDiscount]       = useState(false);
  const [groupMinSize, setGroupMinSize]         = useState(3);
  const [groupDiscountPct, setGroupDiscountPct] = useState(10);

  // Custom pickup
  const [allowCustomPickup, setAllowCustomPickup] = useState(false);
  const [customPickupFee, setCustomPickupFee]     = useState("");

  // Notes
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const queryClient = useQueryClient();

  const { data: listing } = useQuery({
    queryKey: queryKeys.driver.listing(editId!),
    queryFn: () => api.get(`/driver/listings/${editId}`).then(r => r.data as DriverListing),
    enabled: !!editId,
    staleTime: 2 * 60_000,
    refetchOnWindowFocus: false,
    initialData: () => {
      if (!editId) return undefined;
      const cached = queryClient.getQueryData<DriverListing[]>(queryKeys.driver.listings());
      return cached?.find(l => l.id === editId) ?? undefined;
    },
  });

  // Sync form fields when listing data arrives
  useEffect(() => {
    if (!listing) return;
    setFrom(listing.from);
    setTo(listing.to);
    setPickupStation(listing.pickupStation);
    setDropLocation(listing.dropLocation);
    if (listing.date) setDate(parseDateString(listing.date));
    if (listing.dep) {
      const [h, m] = listing.dep.split(":");
      setHour(h); setMinute(m); setPendingHour(h); setPendingMinute(m);
    }
    setSeats(String(listing.seats));
    setPrice(String(listing.price));
    setAmenities(listing.amenities ?? []);
    setGroupDiscount(listing.groupDiscount ?? false);
    setGroupMinSize(listing.groupMinSize ?? 3);
    setGroupDiscountPct(listing.groupDiscountPct ?? 10);
    setAllowCustomPickup(listing.allowCustomPickup ?? false);
    setCustomPickupFee(String(listing.customPickupFee ?? ""));
    setNotes(listing.notes ?? "");
  }, [listing]);

  const stations = BUS_STATIONS[from] ?? [];
  const dep = `${hour}:${minute}`;

  // Auto-reset pickup station if from city changes and station is no longer valid
  function handleFromChange(city: string) {
    setFrom(city);
    const newStations = BUS_STATIONS[city] ?? [];
    if (!newStations.includes(pickupStation)) setPickupStation("");
    setCityPicker(null);
  }

  function toggleAmenity(a: CarAmenity) {
    setAmenities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  }

  async function handleSave() {
    if (!to || !pickupStation) {
      Alert.alert("Required", "Please select destination and pickup station.");
      return;
    }
    if (!price) {
      Alert.alert("Required", "Please enter a price per seat.");
      return;
    }
    setSaving(true);
    try {
      const payload: Omit<DriverListing, "id" | "active"> = {
        from, to, pickupStation, dropLocation, date: formatDate(date), dep,
        seats: parseInt(seats), price: parseInt(price), notes,
        amenities, groupDiscount, groupMinSize, groupDiscountPct,
        allowCustomPickup, customPickupFee: allowCustomPickup ? parseInt(customPickupFee) || 0 : 0,
      };
      if (editId) await api.patch(`/driver/listings/${editId}`, payload);
      else await api.post("/driver/listings", payload);
      queryClient.invalidateQueries({ queryKey: queryKeys.driver.listings() });
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
            await api.delete(`/driver/listings/${editId}`);
            queryClient.invalidateQueries({ queryKey: queryKeys.driver.listings() });
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

        {/* ── ROUTE ─────────────────────────────────────── */}
        <SectionHeader label="Route" icon="map-outline" />

        {/* From */}
        <Label>From</Label>
        <TouchableOpacity
          onPress={() => setCityPicker(cityPicker === "from" ? null : "from")}
          style={[rowInput, { marginBottom: 8 }]}
        >
          <Text style={{ color: C.dark, fontSize: 14, fontWeight: "700", flex: 1 }}>{from}</Text>
          <Ionicons name={cityPicker === "from" ? "chevron-up" : "chevron-down"} size={16} color={C.mid} />
        </TouchableOpacity>

        {cityPicker === "from" && (
          <InlineCityPicker
            selected={from}
            onSelect={handleFromChange}
            exclude={[to]}
          />
        )}

        {/* Pickup station */}
        {stations.length > 0 && (
          <>
            <Label>Pickup Point</Label>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {stations.map(s => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setPickupStation(s)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
                    backgroundColor: pickupStation === s ? C.teal : C.white,
                    borderWidth: pickupStation === s ? 0 : 1.5, borderColor: C.border,
                  }}
                >
                  <Text style={{ color: pickupStation === s ? C.white : C.mid, fontWeight: "700", fontSize: 12 }}>
                    {pickupStation === s ? "✓ " : ""}{s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* To */}
        <Label>To</Label>
        <TouchableOpacity
          onPress={() => setCityPicker(cityPicker === "to" ? null : "to")}
          style={[rowInput, { marginBottom: 8 }]}
        >
          <Text style={{ color: to ? C.dark : C.muted, fontSize: 14, fontWeight: to ? "700" : "400", flex: 1 }}>
            {to || "Select destination"}
          </Text>
          <Ionicons name={cityPicker === "to" ? "chevron-up" : "chevron-down"} size={16} color={C.mid} />
        </TouchableOpacity>

        {cityPicker === "to" && (
          <InlineCityPicker
            selected={to}
            onSelect={(city) => { setTo(city); setCityPicker(null); }}
            exclude={[from]}
          />
        )}

        {/* Drop-off */}
        <Label>Drop-off Area (optional)</Label>
        <TextInput
          value={dropLocation}
          onChangeText={setDropLocation}
          placeholder="e.g. Near Huye University gate"
          style={inputStyle}
        />

        {/* ── SCHEDULE ──────────────────────────────────── */}
        <SectionHeader label="Schedule" icon="time-outline" />

        <Label>Departure Date</Label>
        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          style={[rowInput, { marginBottom: 14 }]}
        >
          <Ionicons name="calendar-outline" size={16} color={C.mid} style={{ marginRight: 8 }} />
          <Text style={{ color: C.dark, fontWeight: "700", fontSize: 15, flex: 1 }}>
            {formatDate(date)}
          </Text>
          <Text style={{ color: C.teal, fontSize: 12, fontWeight: "700" }}>Change</Text>
        </TouchableOpacity>

        {showDatePicker && (
          (isDev || isTest) ? (
            // Expo Go fallback — plain text input
            <TextInput
              value={formatDate(date)}
              onChangeText={(v) => {
                const parsed = new Date(v);
                if (!isNaN(parsed.getTime())) setDate(parsed);
              }}
              placeholder="e.g. 2026-04-15"
              style={[inputStyle, { marginBottom: 14 }]}
              onBlur={() => setShowDatePicker(false)}
              autoFocus
            />
          ) : (
            DateTimePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                minimumDate={new Date()}
                onChange={(_: unknown, selected?: Date) => {
                  setShowDatePicker(Platform.OS === "ios");
                  if (selected) setDate(selected);
                }}
              />
            )
          )
        )}
        {showDatePicker && !isDev && Platform.OS === "ios" && (
          <TouchableOpacity
            onPress={() => setShowDatePicker(false)}
            style={{
              backgroundColor: C.teal, borderRadius: 12, paddingVertical: 12,
              alignItems: "center", marginBottom: 14,
            }}
          >
            <Text style={{ color: C.white, fontWeight: "800" }}>Confirm Date</Text>
          </TouchableOpacity>
        )}

        <Label>Departure Time</Label>
        <TouchableOpacity
          onPress={() => { setPendingHour(hour); setPendingMinute(minute); setShowTimePicker(true); }}
          style={[rowInput, { marginBottom: 14 }]}
        >
          <Ionicons name="time-outline" size={16} color={C.mid} style={{ marginRight: 8 }} />
          <Text style={{ color: C.dark, fontWeight: "700", fontSize: 15, flex: 1 }}>
            {dep}
          </Text>
          <Text style={{ color: C.teal, fontSize: 12, fontWeight: "700" }}>Change</Text>
        </TouchableOpacity>

        {/* ── CAPACITY & PRICING ────────────────────────── */}
        <SectionHeader label="Capacity & Pricing" icon="cash-outline" />

        <Label>Available Seats</Label>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <Stepper value={parseInt(seats)} min={1} max={6} onChange={v => setSeats(String(v))} />
        </View>

        <Label>Price per Seat (RWF)</Label>
        <TextInput
          value={price} onChangeText={setPrice}
          placeholder="e.g. 8000" keyboardType="number-pad"
          style={inputStyle}
        />

        {/* ── CAR AMENITIES ─────────────────────────────── */}
        <SectionHeader label="What's Available on This Trip" icon="sparkles-outline" />
        <Text style={{ color: C.muted, fontSize: 12, marginBottom: 10 }}>
          Let passengers know what's in your car
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {CAR_AMENITIES.map(a => {
            const on = amenities.includes(a);
            return (
              <TouchableOpacity
                key={a}
                onPress={() => toggleAmenity(a)}
                style={{
                  paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
                  backgroundColor: on ? C.teal : C.white,
                  borderWidth: on ? 0 : 1.5, borderColor: C.border,
                }}
              >
                <Text style={{ color: on ? C.white : C.mid, fontWeight: "700", fontSize: 12 }}>
                  {on ? "✓ " : ""}{a}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── GROUP DISCOUNT ────────────────────────────── */}
        <SectionHeader label="Group Discount" icon="people-outline" />
        <View style={{
          backgroundColor: C.white, borderRadius: 14, padding: 14, marginBottom: groupDiscount ? 0 : 14,
          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "700", fontSize: 14, color: C.dark }}>Offer group discount</Text>
            <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
              Reduce price when multiple seats booked together
            </Text>
          </View>
          <Switch
            value={groupDiscount} onValueChange={setGroupDiscount}
            trackColor={{ false: C.border, true: C.teal }} thumbColor={C.white}
          />
        </View>

        {groupDiscount && (
          <View style={{
            backgroundColor: C.tealLt, borderRadius: 14, padding: 14, marginBottom: 14,
            borderWidth: 1.5, borderColor: C.teal,
          }}>
            <Label>Min. group size to qualify</Label>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <Stepper value={groupMinSize} min={2} max={6} onChange={setGroupMinSize} />
            </View>

            <Label>Discount percentage</Label>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {DISCOUNT_PCTS.map(p => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setGroupDiscountPct(p)}
                  style={{
                    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
                    backgroundColor: groupDiscountPct === p ? C.teal : C.white,
                    borderWidth: groupDiscountPct === p ? 0 : 1.5, borderColor: C.border,
                  }}
                >
                  <Text style={{ color: groupDiscountPct === p ? C.white : C.mid, fontWeight: "700", fontSize: 13 }}>
                    {p}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {price !== "" && (
              <Text style={{ color: C.teal, fontSize: 12, fontWeight: "700", marginTop: 10 }}>
                Group price: {Math.round(parseInt(price) * (1 - groupDiscountPct / 100)).toLocaleString()} RWF/seat
              </Text>
            )}
          </View>
        )}

        {/* ── DOOR PICKUP ───────────────────────────────── */}
        <SectionHeader label="Door Pickup" icon="location-outline" />
        <View style={{
          backgroundColor: C.white, borderRadius: 14, padding: 14, marginBottom: allowCustomPickup ? 0 : 14,
          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "700", fontSize: 14, color: C.dark }}>Offer door pickup</Text>
            <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
              Pick passengers up at their location (extra fee)
            </Text>
          </View>
          <Switch
            value={allowCustomPickup} onValueChange={setAllowCustomPickup}
            trackColor={{ false: C.border, true: C.teal }} thumbColor={C.white}
          />
        </View>

        {allowCustomPickup && (
          <View style={{
            backgroundColor: C.tealLt, borderRadius: 14, padding: 14, marginBottom: 14,
            borderWidth: 1.5, borderColor: C.teal,
          }}>
            <Label>Extra fee for door pickup (RWF)</Label>
            <TextInput
              value={customPickupFee} onChangeText={setCustomPickupFee}
              placeholder="e.g. 2000" keyboardType="number-pad"
              style={inputStyle}
            />
            <Text style={{ color: C.mid, fontSize: 12, marginTop: -8 }}>
              This will be added on top of the seat price
            </Text>
          </View>
        )}

        {/* ── NOTES ─────────────────────────────────────── */}
        <SectionHeader label="Notes" icon="chatbubble-outline" />
        <TextInput
          value={notes} onChangeText={setNotes}
          placeholder="e.g. Luggage in boot, stop in Muhanga allowed"
          style={[inputStyle, { minHeight: 72 }]}
          multiline
        />

        {/* ── SAVE ──────────────────────────────────────── */}
        <TouchableOpacity
          onPress={handleSave} disabled={saving}
          style={{
            backgroundColor: C.teal, borderRadius: 16,
            paddingVertical: 18, alignItems: "center",
            marginTop: 8, marginBottom: editId ? 10 : 32,
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

      {/* ── TIME PICKER MODAL ─────────────────────────── */}
      <Modal visible={showTimePicker} animationType="slide" transparent onRequestClose={() => setShowTimePicker(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <View style={{
            backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
            paddingBottom: 40, shadowColor: "#000", shadowOpacity: 0.15,
            shadowRadius: 20, shadowOffset: { width: 0, height: -4 }, elevation: 10,
          }}>
            <View style={{ width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginTop: 14, marginBottom: 16 }} />
            <Text style={{ textAlign: "center", fontWeight: "900", fontSize: 17, color: C.dark, marginBottom: 8 }}>
              Departure Time
            </Text>
            <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center" }}>
              <View style={{ width: 100 }}>
                <Picker
                  selectedValue={pendingHour}
                  onValueChange={setPendingHour}
                  style={{ height: 180 }}
                >
                  {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map(h => (
                    <Picker.Item key={h} label={`${h}h`} value={h} />
                  ))}
                </Picker>
              </View>
              <Text style={{ fontWeight: "900", fontSize: 24, color: C.dark, marginHorizontal: 4 }}>:</Text>
              <View style={{ width: 100 }}>
                <Picker
                  selectedValue={pendingMinute}
                  onValueChange={setPendingMinute}
                  style={{ height: 180 }}
                >
                  {["00", "15", "30", "45"].map(m => (
                    <Picker.Item key={m} label={`${m}min`} value={m} />
                  ))}
                </Picker>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => { setHour(pendingHour); setMinute(pendingMinute); setShowTimePicker(false); }}
              style={{
                backgroundColor: C.teal, borderRadius: 14, marginHorizontal: 24,
                paddingVertical: 16, alignItems: "center", marginTop: 8,
              }}
            >
              <Text style={{ color: C.white, fontWeight: "900", fontSize: 16 }}>
                Confirm — {pendingHour}:{pendingMinute}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────

function InlineCityPicker({ selected, onSelect, exclude }: {
  selected: string; onSelect: (c: string) => void; exclude: string[];
}) {
  return (
    <View style={{
      backgroundColor: C.white, borderRadius: 14, padding: 8, marginBottom: 14,
      borderWidth: 2, borderColor: C.teal,
    }}>
      {CITIES.filter(c => !exclude.includes(c)).map(city => (
        <TouchableOpacity
          key={city}
          onPress={() => onSelect(city)}
          style={{
            paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
            backgroundColor: selected === city ? C.tealLt : "transparent",
          }}
        >
          <Text style={{
            color: selected === city ? C.teal : C.dark,
            fontWeight: "700", fontSize: 14,
          }}>
            {selected === city ? "✓ " : ""}{city}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Stepper({ value, min, max, onChange }: {
  value: number; min: number; max: number; onChange: (v: number) => void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <TouchableOpacity
        onPress={() => onChange(Math.max(min, value - 1))}
        style={stepperStyle}
      >
        <Text style={{ color: C.white, fontWeight: "900", fontSize: 18 }}>−</Text>
      </TouchableOpacity>
      <Text style={{ fontWeight: "900", fontSize: 20, color: C.dark, minWidth: 32, textAlign: "center" }}>
        {value}
      </Text>
      <TouchableOpacity
        onPress={() => onChange(Math.min(max, value + 1))}
        style={stepperStyle}
      >
        <Text style={{ color: C.white, fontWeight: "900", fontSize: 18 }}>+</Text>
      </TouchableOpacity>
    </View>
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

function Label({ children }: { children: string }) {
  return (
    <Text style={{ fontWeight: "700", fontSize: 12, color: C.mid, marginBottom: 6 }}>{children}</Text>
  );
}

const inputStyle = {
  backgroundColor: C.white, borderRadius: 12, paddingHorizontal: 14,
  paddingVertical: 13, fontSize: 14, color: C.dark,
  borderWidth: 1.5, borderColor: C.border, marginBottom: 14,
};

const rowInput = {
  backgroundColor: C.white, borderRadius: 12, paddingHorizontal: 14,
  paddingVertical: 13, flexDirection: "row" as const, alignItems: "center" as const,
  borderWidth: 1.5, borderColor: C.border,
};

const stepperStyle = {
  backgroundColor: C.teal, borderRadius: 8, width: 36, height: 36,
  alignItems: "center" as const, justifyContent: "center" as const,
};
