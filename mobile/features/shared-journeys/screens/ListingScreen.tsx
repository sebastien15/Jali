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
  CITIES, BUS_STATIONS, CAR_AMENITIES, CarAmenity, DriverListing, DriverListingPayload,
} from "@/constants/data";
import api from "@/lib/api";
import { toYmd, parseYmd, formatYmd } from "@/lib/date";
import { useTranslation } from "react-i18next";

const DISCOUNT_PCTS = [5, 10, 15, 20];

function parseListingDate(s: string | null): Date | null {
  const ymd = parseYmd(s);
  if (ymd) return ymd;
  // Legacy rows stored a display label like "Mon 5 Oct 2026"
  const d = s ? new Date(s) : null;
  return d && !isNaN(d.getTime()) ? d : null;
}

/** First validation message from a Laravel 422, or its top-level message. */
function apiErrorMessage(e: any): string | undefined {
  const errors = e?.response?.data?.errors;
  if (errors && typeof errors === "object") {
    const first = Object.values(errors)[0];
    if (Array.isArray(first) && first.length) return String(first[0]);
  }
  return e?.response?.data?.message;
}

export default function ListingScreen() {
  const { t, i18n } = useTranslation();
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
  // S25.1: stops along the way — each with its time; one fare per segment
  const [via, setVia] = useState<{ name: string; time: string }[]>([]);
  const [segFares, setSegFares] = useState<string[]>([]);
  const [arrival, setArrival] = useState("");
  const [saving, setSaving] = useState(false);

  const queryClient = useQueryClient();

  // There is no GET /driver/listings/{id}: read the driver's list (usually
  // already cached by the Drive tab) and pick the listing out of it.
  const { data: listing } = useQuery({
    queryKey: queryKeys.driver.listings(),
    queryFn: () => api.get("/driver/listings").then(r => r.data as DriverListing[]),
    enabled: !!editId,
    staleTime: 2 * 60_000,
    refetchOnWindowFocus: false,
    select: (list) => list.find(l => l.id === editId),
  });

  // Sync form fields once when the listing arrives (don't clobber edits on refetch)
  const [hydratedId, setHydratedId] = useState<number | null>(null);
  useEffect(() => {
    if (!listing || hydratedId === listing.id) return;
    setHydratedId(listing.id);
    setFrom(listing.from);
    setTo(listing.to);
    setPickupStation(listing.pickup_station ?? "");
    setDropLocation(listing.drop_location ?? "");
    const parsed = parseListingDate(listing.date);
    if (parsed) setDate(parsed);
    if (listing.dep) {
      const [h = "07", m = "00"] = listing.dep.split(":");
      setHour(h); setMinute(m); setPendingHour(h); setPendingMinute(m);
    }
    setSeats(String(listing.seats));
    setPrice(String(listing.price));
    setAmenities(listing.amenities ?? []);
    setGroupDiscount(!!listing.group_discount);
    setGroupMinSize(listing.group_min_size ?? 3);
    setGroupDiscountPct(listing.group_discount_pct ?? 10);
    setAllowCustomPickup(!!listing.allow_custom_pickup);
    setCustomPickupFee(listing.custom_pickup_fee ? String(listing.custom_pickup_fee) : "");
    setNotes(listing.notes ?? "");
    const stops = listing.stops ?? [];
    if (stops.length > 2) {
      setVia(stops.slice(1, -1).map(st => ({ name: st.name, time: st.time })));
      setSegFares(stops.slice(0, -1).map(st => String(st.fare_to_next ?? "")));
      setArrival(stops[stops.length - 1].time);
    } else if (stops.length === 2) {
      setArrival(stops[1].time);
    }
  }, [listing, hydratedId]);

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
      Alert.alert(t("listing.required"), t("listing.selectDestinationAndPickup"));
      return;
    }
    const withStops = via.length > 0;
    const fares = segFares.slice(0, via.length + 1).map(f => parseInt(f, 10));
    if (withStops && (via.some(v => !v.name.trim() || !/^\d{2}:\d{2}$/.test(v.time)) || !/^\d{2}:\d{2}$/.test(arrival)
      || fares.length < via.length + 1 || fares.some(f => isNaN(f)))) {
      Alert.alert(t("listing.required"), t("listing.stopsIncomplete", "Give every stop a name and time (HH:MM), the arrival time, and a fare for each part of the route."));
      return;
    }
    const priceNum = withStops ? fares.reduce((a, b) => a + b, 0) : parseInt(price, 10);
    if (!withStops && (!price || isNaN(priceNum))) {
      Alert.alert(t("listing.required"), t("listing.enterPrice"));
      return;
    }
    setSaving(true);
    try {
      // snake_case, exactly as PrivateSeatController@store/update validates
      const payload: DriverListingPayload = {
        from,
        to,
        pickup_station: pickupStation,
        drop_location: dropLocation.trim() || null,
        date: toYmd(date),
        dep,
        seats: parseInt(seats, 10),
        price: priceNum,
        notes: notes.trim() || null,
        amenities,
        group_discount: groupDiscount,
        group_min_size: groupMinSize,
        group_discount_pct: groupDiscountPct,
        allow_custom_pickup: allowCustomPickup,
        custom_pickup_fee: allowCustomPickup ? parseInt(customPickupFee, 10) || 0 : 0,
        // With stops the server derives from/to/dep/price from them; [] clears them
        stops: withStops ? [
          { name: from, time: dep, fare_to_next: fares[0] },
          ...via.map((v, i) => ({ name: v.name.trim(), time: v.time, fare_to_next: fares[i + 1] })),
          { name: to, time: arrival },
        ] : [],
      };
      if (editId) await api.patch(`/driver/listings/${editId}`, payload);
      else await api.post("/driver/listings", payload);
      queryClient.invalidateQueries({ queryKey: queryKeys.driver.listings() });
      Alert.alert(
        `${editId ? t("listing.listingUpdated") : t("listing.listingPublished")} ✓`,
        editId ? t("listing.listingUpdatedDesc") : t("listing.listingPublishedDesc"),
        [{ text: t("common.ok"), onPress: () => router.back() }],
      );
    } catch (e: any) {
      Alert.alert(t("listing.error"), apiErrorMessage(e) ?? t("listing.saveListingError"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    Alert.alert(t("listing.deleteListingTitle"), t("listing.deleteListingConfirm"), [
      { text: t("profile.cancel"), style: "cancel" },
      {
        text: t("common.delete"), style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/driver/listings/${editId}`);
            queryClient.invalidateQueries({ queryKey: queryKeys.driver.listings() });
            router.back();
          } catch (e: any) {
            Alert.alert(t("listing.error"), apiErrorMessage(e) ?? t("listing.deleteListingError"));
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
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600" }}>{t("listing.privateDriver")}</Text>
          <Text style={{ color: C.white, fontWeight: "900", fontSize: 20 }}>
            {editId ? t("listing.editListing") : t("listing.newTripListing")}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>

        {/* ── ROUTE ─────────────────────────────────────── */}
        <SectionHeader label={t("listing.route")} icon="map-outline" />

        {/* From */}
        <Label>{t("listing.from")}</Label>
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
            <Label>{t("listing.pickupPoint")}</Label>
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
        <Label>{t("listing.to")}</Label>
        <TouchableOpacity
          onPress={() => setCityPicker(cityPicker === "to" ? null : "to")}
          style={[rowInput, { marginBottom: 8 }]}
        >
          <Text style={{ color: to ? C.dark : C.muted, fontSize: 14, fontWeight: to ? "700" : "400", flex: 1 }}>
            {to || t("listing.selectDestination")}
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
        <Label>{t("listing.dropOffArea")}</Label>
        <TextInput
          value={dropLocation}
          onChangeText={setDropLocation}
          placeholder={t("listing.dropOffPlaceholder")}
          style={inputStyle}
        />

        {/* ── SCHEDULE ──────────────────────────────────── */}
        <SectionHeader label={t("listing.schedule")} icon="time-outline" />

        <Label>{t("listing.departureDate")}</Label>
        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          style={[rowInput, { marginBottom: 14 }]}
        >
          <Ionicons name="calendar-outline" size={16} color={C.mid} style={{ marginRight: 8 }} />
          <Text style={{ color: C.dark, fontWeight: "700", fontSize: 15, flex: 1 }}>
            {formatYmd(toYmd(date), i18n.language)}
          </Text>
          <Text style={{ color: C.teal, fontSize: 12, fontWeight: "700" }}>{t("listing.change")}</Text>
        </TouchableOpacity>

        {showDatePicker && (
          (isDev || isTest) ? (
            // Expo Go fallback — plain text input
            <TextInput
              defaultValue={toYmd(date)}
              onChangeText={(v) => {
                const parsed = parseYmd(v);
                if (parsed) setDate(parsed);
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
            <Text style={{ color: C.white, fontWeight: "800" }}>{t("listing.confirmDate")}</Text>
          </TouchableOpacity>
        )}

        <Label>{t("listing.departureTime")}</Label>
        <TouchableOpacity
          onPress={() => { setPendingHour(hour); setPendingMinute(minute); setShowTimePicker(true); }}
          style={[rowInput, { marginBottom: 14 }]}
        >
          <Ionicons name="time-outline" size={16} color={C.mid} style={{ marginRight: 8 }} />
          <Text style={{ color: C.dark, fontWeight: "700", fontSize: 15, flex: 1 }}>
            {dep}
          </Text>
          <Text style={{ color: C.teal, fontSize: 12, fontWeight: "700" }}>{t("listing.change")}</Text>
        </TouchableOpacity>

        {/* ── STOPS ALONG THE WAY (S25.1) ─────────────────── */}
        <SectionHeader label={t("listing.stops", "Stops along the way")} icon="git-commit-outline" />
        <Text style={{ color: C.mid, fontSize: 12, marginBottom: 8 }}>
          {t("listing.stopsHint", "Add towns you pass through. Passengers can ride part of the route and pay only for their part.")}
        </Text>
        {via.map((v, i) => (
          <View key={i} style={{ flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <TextInput value={v.name} onChangeText={name => setVia(via.map((x, j) => (j === i ? { ...x, name } : x)))}
              placeholder={t("listing.stopName", "Town")} placeholderTextColor={C.muted} style={[inputStyle, { flex: 1, marginBottom: 0 }]}
              accessibilityLabel={t("listing.stopName", "Town")} />
            <TextInput value={v.time} onChangeText={time => setVia(via.map((x, j) => (j === i ? { ...x, time } : x)))}
              placeholder="08:30" placeholderTextColor={C.muted} keyboardType="numbers-and-punctuation" style={[inputStyle, { width: 76, marginBottom: 0 }]}
              accessibilityLabel={t("listing.stopTime", "Time at this stop")} />
            <TouchableOpacity accessibilityLabel={t("listing.removeStop", "Remove stop")} hitSlop={8}
              onPress={() => { setVia(via.filter((_, j) => j !== i)); setSegFares(segFares.filter((_, j) => j !== i + 1)); }}>
              <Ionicons name="close-circle" size={22} color={C.muted} />
            </TouchableOpacity>
          </View>
        ))}
        {via.length < 10 && (
          <TouchableOpacity onPress={() => setVia([...via, { name: "", time: "" }])} accessibilityLabel={t("listing.addStop", "Add a stop")}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <Ionicons name="add-circle-outline" size={20} color={C.teal} />
            <Text style={{ color: C.teal, fontWeight: "700" }}>{t("listing.addStop", "Add a stop")}</Text>
          </TouchableOpacity>
        )}
        {via.length > 0 && (
          <>
            <Label>{t("listing.arrival", "Arrival time at {{to}}", { to: to || "…" })}</Label>
            <TextInput value={arrival} onChangeText={setArrival} placeholder="10:00" placeholderTextColor={C.muted}
              keyboardType="numbers-and-punctuation" style={inputStyle} accessibilityLabel={t("listing.arrivalShort", "Arrival time")} />
          </>
        )}

        {/* ── CAPACITY & PRICING ────────────────────────── */}
        <SectionHeader label={t("listing.capacityPricing")} icon="cash-outline" />

        <Label>{t("listing.availableSeats")}</Label>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <Stepper value={parseInt(seats)} min={1} max={6} onChange={v => setSeats(String(v))} />
        </View>

        {via.length === 0 ? (
          <>
            <Label>{t("listing.pricePerSeat")}</Label>
            <TextInput
              value={price} onChangeText={setPrice}
              placeholder="e.g. 8000" keyboardType="number-pad"
              style={inputStyle}
            />
          </>
        ) : (
          <>
            {[from, ...via.map(v => v.name || "…")].map((name, i) => {
              const next = i < via.length ? (via[i].name || "…") : (to || "…");
              return (
                <View key={i}>
                  <Label>{t("listing.segmentFare", "Fare {{from}} → {{to}}", { from: name, to: next })}</Label>
                  <TextInput value={segFares[i] ?? ""} keyboardType="number-pad" placeholder="e.g. 2000" placeholderTextColor={C.muted}
                    onChangeText={v => { const n = [...segFares]; n[i] = v.replace(/\D/g, ""); setSegFares(n); }} style={inputStyle}
                    accessibilityLabel={t("listing.segmentFare", "Fare {{from}} → {{to}}", { from: name, to: next })} />
                </View>
              );
            })}
            <Text style={{ color: C.mid, fontSize: 12, marginBottom: 10 }}>
              {t("listing.fullRoute", "Whole route: {{price}} RWF", { price: segFares.slice(0, via.length + 1).reduce((a, f) => a + (parseInt(f, 10) || 0), 0).toLocaleString() })}
            </Text>
          </>
        )}

        {/* ── CAR AMENITIES ─────────────────────────────── */}
        <SectionHeader label={t("listing.available")} icon="sparkles-outline" />
        <Text style={{ color: C.muted, fontSize: 12, marginBottom: 10 }}>
          {t("listing.amenitiesHint")}
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
        <SectionHeader label={t("listing.groupDiscount")} icon="people-outline" />
        <View style={{
          backgroundColor: C.white, borderRadius: 14, padding: 14, marginBottom: groupDiscount ? 0 : 14,
          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "700", fontSize: 14, color: C.dark }}>{t("listing.offerGroupDiscount")}</Text>
            <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
              {t("listing.groupDiscountDesc")}
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
            <Label>{t("listing.minGroupSize")}</Label>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <Stepper value={groupMinSize} min={2} max={6} onChange={setGroupMinSize} />
            </View>

            <Label>{t("listing.discountPercentage")}</Label>
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
                {t("listing.groupPrice", { price: Math.round((parseInt(price, 10) || 0) * (1 - groupDiscountPct / 100)).toLocaleString() })}
              </Text>
            )}
          </View>
        )}

        {/* ── DOOR PICKUP ───────────────────────────────── */}
        <SectionHeader label={t("listing.doorPickup")} icon="location-outline" />
        <View style={{
          backgroundColor: C.white, borderRadius: 14, padding: 14, marginBottom: allowCustomPickup ? 0 : 14,
          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "700", fontSize: 14, color: C.dark }}>{t("listing.offerDoorPickup")}</Text>
            <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
              {t("listing.doorPickupDesc")}
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
            <Label>{t("listing.extraFee")}</Label>
            <TextInput
              value={customPickupFee} onChangeText={setCustomPickupFee}
              placeholder="e.g. 2000" keyboardType="number-pad"
              style={inputStyle}
            />
            <Text style={{ color: C.mid, fontSize: 12, marginTop: -8 }}>
              {t("listing.extraFeeDesc")}
            </Text>
          </View>
        )}

        {/* ── NOTES ─────────────────────────────────────── */}
        <SectionHeader label={t("listing.notes")} icon="chatbubble-outline" />
        <TextInput
          value={notes} onChangeText={setNotes}
          placeholder={t("listing.notesPlaceholder")}
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
                {editId ? t("listing.updateListing") : t("listing.publishListing")} ✓
              </Text>
          }
        </TouchableOpacity>

        {editId && (
          <TouchableOpacity
            onPress={handleDelete}
            style={{ paddingVertical: 14, alignItems: "center", marginBottom: 32 }}
          >
            <Text style={{ color: "#DC2626", fontSize: 14, fontWeight: "700" }}>{t("listing.deleteListing")}</Text>
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
              {t("listing.departureTime")}
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
                {t("listing.confirmTime", { time: `${pendingHour}:${pendingMinute}` })}
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
