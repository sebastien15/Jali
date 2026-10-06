import { useEffect, useState } from "react";
import { View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import {
  ALLOWED_KEYS, CANCELLATION_POLICIES, CAR_FEATURES, CAR_TYPES, FUEL_POLICIES, FUEL_TYPES, LABELS, MAX_PHOTOS, OwnerRentalCar,
  RentalBlock, RentalCarInput, TRANSMISSIONS, addDays, apiError, appendFile, formatDay, nextDates, pickDocument, pickPhotos,
} from "../rentals";
import { Badge, Chip, Field, Header, NumberField, PrimaryButton, Section, SecondaryButton, Stepper, ToggleRow } from "../components/ui";

type Form = RentalCarInput & { allowed: Record<(typeof ALLOWED_KEYS)[number], boolean>; rules: string[]; amenities: string[] };

const EMPTY: Form = {
  make: "", model: "", year: null, color: "", type: "Sedan", plate: "", seats: 5, doors: 4, luggage: 2,
  priceDay: undefined, caution: 0, transmission: "automatic", fuel_type: "petrol", description: "",
  city: "Kigali", pickup_address: "", pickup_lat: null, pickup_lng: null, delivery_available: false, delivery_fee: 0,
  mileage_limit_km: null, extra_km_fee: 0, fuel_policy: "same_to_same", min_driver_age: 21, min_licence_years: 1,
  min_days: 1, max_days: 30, notice_hours: 12, weekly_discount_pct: 0, monthly_discount_pct: 0, cancellation_policy: "moderate",
  allowed: { smoking: false, pets: false, outside_kigali: true, cross_border: false }, rules: [], amenities: [], insurance_expiry: null,
  status: "available",
};

function fromCar(car: OwnerRentalCar): Form {
  const f = { ...EMPTY };
  for (const key of Object.keys(EMPTY) as (keyof Form)[]) {
    const v = (car as any)[key];
    if (v !== undefined) (f as any)[key] = v;
  }
  f.priceDay = car.priceDay;
  f.allowed = { ...EMPTY.allowed, ...car.allowed };
  f.rules = car.rules ?? [];
  f.amenities = (car.amenities as string[] | null) ?? [];
  return f;
}

/** Owner: register or edit a rental car — details, photos, papers, own rules, blocked days (S24.8, S24.2) */
export default function CarEditorScreen() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const param = useLocalSearchParams<{ id: string }>().id;
  const isNew = param === "new";
  const id = isNew ? null : Number(param);
  const [form, setForm] = useState<Form>(EMPTY);
  const [newRule, setNewRule] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [blockStart, setBlockStart] = useState(nextDates(1, 1)[0]);
  const [blockDays, setBlockDays] = useState(1);
  const [blockReason, setBlockReason] = useState("");

  const { data: car, isLoading, refetch } = useQuery({
    queryKey: queryKeys.driver.car(id ?? 0),
    queryFn: () => api.get<OwnerRentalCar & { blocks: RentalBlock[] }>(`/driver/cars/${id}`).then(r => r.data),
    enabled: !!id,
  });
  useEffect(() => { if (car) setForm(fromCar(car)); }, [car?.id, car?.verification_status]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm(f => ({ ...f, [key]: value }));

  function refreshLists(updated?: OwnerRentalCar) {
    if (updated && id) queryClient.setQueryData(queryKeys.driver.car(id), (old: any) => ({ ...old, ...updated }));
    queryClient.invalidateQueries({ queryKey: queryKeys.driver.cars() });
  }

  async function save() {
    if (!form.make?.trim() || !form.model?.trim() || !form.plate?.trim() || !form.priceDay) {
      Alert.alert(t("rental.editor.missingTitle", "Almost there"), t("rental.editor.missingText", "Add the make, model, plate and price per day."));
      return;
    }
    setSaving(true);
    const body: RentalCarInput = {
      ...form,
      name: `${form.make!.trim()} ${form.model!.trim()}`,
      make: form.make!.trim(), model: form.model!.trim(),
      description: form.description?.trim() || null,
      color: form.color?.trim() || null,
      pickup_address: form.pickup_address?.trim() || null,
      delivery_fee: form.delivery_available ? form.delivery_fee ?? 0 : 0,
      extra_km_fee: form.mileage_limit_km ? form.extra_km_fee ?? 0 : 0,
    };
    try {
      if (isNew) {
        const created = await api.post<OwnerRentalCar>("/driver/cars", body).then(r => r.data);
        refreshLists();
        Alert.alert(t("rental.editor.savedTitle", "Car saved"), t("rental.editor.savedNew", "Now add at least 3 photos and the registration and insurance papers so we can check and publish it."));
        router.replace({ pathname: "/driver/car/[id]", params: { id: String(created.id) } } as any);
      } else {
        const updated = await api.patch<OwnerRentalCar>(`/driver/cars/${id}`, body).then(r => r.data);
        refreshLists(updated);
        Alert.alert(t("rental.editor.savedTitle", "Car saved"), updated.verification_status === "pending"
          ? t("rental.editor.savedPending", "Your listing will be checked by Jali before customers see it.")
          : t("rental.editor.savedLive", "Your changes are live."));
      }
    } catch (e) {
      Alert.alert(t("rental.editor.saveFailed", "Could not save"), apiError(e, t("rental.request.tryAgain", "Please try again.")));
    } finally {
      setSaving(false);
    }
  }

  async function addPhotos(camera: boolean) {
    if (!id || !car) return;
    const room = MAX_PHOTOS - car.photos.length;
    if (room <= 0) return Alert.alert(t("rental.editor.photosFull", "You can add up to 12 photos."));
    const files = await pickPhotos({ camera, max: room });
    if (!files.length) return;
    setUploading("photos");
    try {
      let updated: OwnerRentalCar | undefined;
      for (const file of files) {
        const form = new FormData();
        await appendFile(form, "photo", file);
        updated = await api.post<OwnerRentalCar>(`/driver/cars/${id}/photos`, form, { headers: { "Content-Type": "multipart/form-data" }, timeout: 60_000 }).then(r => r.data);
      }
      refreshLists(updated);
    } catch (e) {
      Alert.alert(t("rental.editor.uploadFailed", "Upload failed"), apiError(e, ""));
    } finally {
      setUploading(null);
    }
  }

  async function photoAction(index: number) {
    Alert.alert(t("rental.editor.photo", "Photo"), undefined, [
      ...(index > 0 ? [{ text: t("rental.editor.makeCover", "Make cover photo"), onPress: async () => {
        refreshLists(await api.post<OwnerRentalCar>(`/driver/cars/${id}/photos/${index}/cover`).then(r => r.data));
      } }] : []),
      { text: t("rental.editor.deletePhoto", "Delete"), style: "destructive" as const, onPress: async () => {
        refreshLists(await api.delete<OwnerRentalCar>(`/driver/cars/${id}/photos/${index}`).then(r => r.data));
      } },
      { text: t("profile.cancel", "Cancel"), style: "cancel" as const },
    ]);
  }

  async function uploadDoc(type: "registration" | "insurance") {
    if (!id) return;
    const file = await pickDocument();
    if (!file) return;
    setUploading(type);
    try {
      const form = new FormData();
      form.append("type", type);
      await appendFile(form, "file", file);
      refreshLists(await api.post<OwnerRentalCar>(`/driver/cars/${id}/documents`, form, { headers: { "Content-Type": "multipart/form-data" }, timeout: 60_000 }).then(r => r.data));
    } catch (e) {
      Alert.alert(t("rental.editor.uploadFailed", "Upload failed"), apiError(e, ""));
    } finally {
      setUploading(null);
    }
  }

  async function useMyLocation() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setForm(f => ({ ...f, pickup_lat: pos.coords.latitude, pickup_lng: pos.coords.longitude }));
      try {
        const place = await api.get<{ name?: string; address?: string }>("/places/reverse", { params: { lat: pos.coords.latitude, lng: pos.coords.longitude } }).then(r => r.data);
        setForm(f => ({ ...f, pickup_address: f.pickup_address || place.address || place.name || "" }));
      } catch { /* the owner can type the address */ }
    } finally {
      setLocating(false);
    }
  }

  async function addBlock() {
    if (!id) return;
    try {
      await api.post(`/driver/cars/${id}/blocks`, { start_date: blockStart, end_date: addDays(blockStart, blockDays - 1), reason: blockReason.trim() || null });
      setBlockReason("");
      refetch();
    } catch (e) {
      Alert.alert(t("rental.editor.blockFailed", "Could not block these days"), apiError(e, ""));
    }
  }

  async function removeBlock(blockId: number) {
    await api.delete(`/driver/cars/${id}/blocks/${blockId}`);
    refetch();
  }

  function removeCar() {
    Alert.alert(t("rental.editor.removeTitle", "Remove this car?"), t("rental.editor.removeText", "Customers will no longer see it."), [
      { text: t("profile.cancel", "Cancel"), style: "cancel" },
      { text: t("rental.editor.remove", "Remove"), style: "destructive", onPress: async () => {
        try {
          await api.delete(`/driver/cars/${id}`);
          refreshLists();
          router.back();
        } catch (e) {
          Alert.alert(t("rental.editor.removeFailed", "Could not remove"), apiError(e, ""));
        }
      } },
    ]);
  }

  if (id && isLoading) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}><Header title={t("rental.editor.title", "My car")} /><ActivityIndicator color={C.teal} style={{ marginTop: 40 }} /></SafeAreaView>;
  }

  const status = car?.verification_status;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title={isNew ? t("rental.editor.new", "List a car for rent") : car?.name ?? ""} subtitle={car?.plate} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          {car && (
            <Section>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Badge label={status === "verified" ? t("rental.editor.live", "Live for customers") : status === "rejected" ? t("rental.editor.rejected", "Needs changes") : t("rental.editor.pending", "Waiting for review")}
                  color={status === "verified" ? C.green : C.orange} bg={status === "verified" ? C.greenLt : C.orangeLt} />
                {car.open_rentals > 0 && <Badge label={t("rental.editor.openRentals", { count: car.open_rentals, defaultValue: `${car.open_rentals} open rental(s)` })} color={C.blue} bg={C.blueLt} />}
              </View>
              {!!car.verification_note && status === "rejected" && <Text style={{ color: C.orange, marginTop: 8 }}>{car.verification_note}</Text>}
              {car.missing.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Text style={{ color: C.mid, fontSize: 12, fontWeight: "700" }}>{t("rental.editor.toAdd", "Still to add:")}</Text>
                  {car.missing.map(m => <Text key={m} style={{ color: C.dark, fontSize: 13 }}>• {LABELS.missing[m] ?? m}</Text>)}
                </View>
              )}
            </Section>
          )}

          {/* Photos */}
          {car ? (
            <Section title={t("rental.editor.photos", "Photos")} hint={t("rental.editor.photosHint", "At least 3: front, side, inside. Bright, clear photos get more bookings. The first is the cover.")}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {car.photos.map((uri, i) => (
                  <TouchableOpacity key={uri + i} onPress={() => photoAction(i)} accessibilityLabel={`Photo ${i + 1}`}>
                    <Image source={{ uri }} style={{ width: 96, height: 72, borderRadius: 10, backgroundColor: C.bg }} />
                    {i === 0 && <View style={{ position: "absolute", left: 4, top: 4, backgroundColor: C.teal, borderRadius: 6, paddingHorizontal: 5 }}><Text style={{ color: C.white, fontSize: 10, fontWeight: "800" }}>{t("rental.editor.cover", "Cover")}</Text></View>}
                  </TouchableOpacity>
                ))}
                {car.photos.length < MAX_PHOTOS && (
                  <>
                    <AddTile icon="images-outline" label={t("rental.editor.gallery", "Gallery")} onPress={() => addPhotos(false)} busy={uploading === "photos"} />
                    <AddTile icon="camera-outline" label={t("rental.editor.camera", "Camera")} onPress={() => addPhotos(true)} busy={uploading === "photos"} />
                  </>
                )}
              </View>
            </Section>
          ) : (
            <Section><Text style={{ color: C.mid }}>{t("rental.editor.photosAfter", "Save the car first, then add photos and papers.")}</Text></Section>
          )}

          <Section title={t("rental.editor.basics", "The car")}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}><Field label={t("rental.editor.make", "Make")} value={form.make ?? ""} onChangeText={v => set("make", v)} placeholder="Toyota" maxLength={60} /></View>
              <View style={{ flex: 1 }}><Field label={t("rental.editor.model", "Model")} value={form.model ?? ""} onChangeText={v => set("model", v)} placeholder="RAV4" maxLength={60} /></View>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}><NumberField label={t("rental.editor.year", "Year")} value={form.year} onChange={v => set("year", v)} placeholder="2019" maxLength={4} /></View>
              <View style={{ flex: 1 }}><Field label={t("rental.editor.color", "Colour")} value={form.color ?? ""} onChangeText={v => set("color", v)} placeholder="Silver" maxLength={30} /></View>
            </View>
            <Field label={t("rental.editor.plate", "Plate number")} value={form.plate ?? ""} onChangeText={v => set("plate", v.toUpperCase())} placeholder="RAD 123 B" autoCapitalize="characters" maxLength={20}
              hint={t("rental.editor.plateHint", "Shown to the customer only after you accept.")} />
            <Text style={{ color: C.mid, fontSize: 12, fontWeight: "700", marginBottom: 6 }}>{t("rental.editor.type", "Type")}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {CAR_TYPES.map(ct => <Chip key={ct} label={ct} on={form.type === ct} onPress={() => set("type", ct)} />)}
            </View>
            <Text style={{ color: C.mid, fontSize: 12, fontWeight: "700", marginBottom: 6 }}>{t("rental.editor.transmission", "Transmission")}</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              {TRANSMISSIONS.map(tr => <Chip key={tr} label={LABELS.transmission[tr]} on={form.transmission === tr} onPress={() => set("transmission", tr)} />)}
            </View>
            <Text style={{ color: C.mid, fontSize: 12, fontWeight: "700", marginBottom: 6 }}>{t("rental.editor.fuelType", "Fuel")}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              {FUEL_TYPES.map(f => <Chip key={f} label={LABELS.fuel[f]} on={form.fuel_type === f} onPress={() => set("fuel_type", f)} />)}
            </View>
            <Stepper label={t("rental.editor.seats", "Seats")} value={form.seats ?? 5} min={1} max={60} onChange={v => set("seats", v)} />
            <Stepper label={t("rental.editor.doors", "Doors")} value={form.doors ?? 4} min={2} max={6} onChange={v => set("doors", v)} />
            <Stepper label={t("rental.editor.luggage", "Large bags")} value={form.luggage ?? 2} min={0} max={20} onChange={v => set("luggage", v)} />
          </Section>

          <Section title={t("rental.editor.describe", "Description & features")}>
            <Field label={t("rental.editor.description", "Description")} value={form.description ?? ""} onChangeText={v => set("description", v)} multiline maxLength={2000}
              placeholder={t("rental.editor.descriptionPlaceholder", "Condition, what it's great for (city, safari, upcountry), anything customers should know")} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {CAR_FEATURES.map(feat => {
                const on = form.amenities.includes(feat);
                return <Chip key={feat} label={feat} on={on} onPress={() => set("amenities", on ? form.amenities.filter(a => a !== feat) : [...form.amenities, feat])} />;
              })}
            </View>
          </Section>

          <Section title={t("rental.editor.price", "Price")} hint={t("rental.noFees", "No Jali fees — prices are set by car owners.")}>
            <NumberField label={t("rental.editor.pricePerDay", "Price per day")} suffix="RWF" value={form.priceDay ?? null} onChange={v => set("priceDay", v ?? undefined)} placeholder="45000" />
            <NumberField label={t("rental.editor.deposit", "Refundable deposit")} suffix="RWF" value={form.caution ?? 0} onChange={v => set("caution", v ?? 0)}
              hint={t("rental.editor.depositHint", "Collected at pickup, returned when the car comes back in good condition.")} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}><NumberField label={t("rental.editor.weekly", "7+ days discount")} suffix="%" value={form.weekly_discount_pct ?? 0} onChange={v => set("weekly_discount_pct", Math.min(70, v ?? 0))} /></View>
              <View style={{ flex: 1 }}><NumberField label={t("rental.editor.monthly", "28+ days discount")} suffix="%" value={form.monthly_discount_pct ?? 0} onChange={v => set("monthly_discount_pct", Math.min(80, v ?? 0))} /></View>
            </View>
            <ToggleRow label={t("rental.editor.delivery", "I can deliver the car")} value={!!form.delivery_available} onChange={v => set("delivery_available", v)} />
            {form.delivery_available && <NumberField label={t("rental.editor.deliveryFee", "Delivery fee")} suffix="RWF" value={form.delivery_fee ?? 0} onChange={v => set("delivery_fee", v ?? 0)} />}
          </Section>

          <Section title={t("rental.editor.pickup", "Pickup place")}>
            <Field label={t("rental.editor.city", "City")} value={form.city ?? ""} onChangeText={v => set("city", v)} maxLength={60} />
            <Field label={t("rental.editor.address", "Address or landmark")} value={form.pickup_address ?? ""} onChangeText={v => set("pickup_address", v)} maxLength={255} placeholder="KG 9 Ave, Nyarutarama" />
            <SecondaryButton icon="locate-outline" color={C.blue} onPress={useMyLocation}
              label={locating ? t("rental.editor.locating", "Finding you…") : form.pickup_lat ? t("rental.editor.locationSet", "Location saved — update to here") : t("rental.editor.useLocation", "Use my current location")} />
          </Section>

          <Section title={t("rental.editor.rules", "Your rules")} hint={t("rental.editor.rulesHint", "Customers must accept these before they can request your car.")}>
            {ALLOWED_KEYS.map(k => (
              <ToggleRow key={k} label={`${LABELS.allowed[k]} ${t("rental.editor.allowed", "allowed")}`} value={form.allowed[k]} onChange={v => set("allowed", { ...form.allowed, [k]: v })} />
            ))}
            <ToggleRow label={t("rental.editor.unlimitedKm", "Unlimited kilometres")} value={!form.mileage_limit_km} onChange={v => set("mileage_limit_km", v ? null : 200)} />
            {!!form.mileage_limit_km && (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}><NumberField label={t("rental.editor.kmPerDay", "Km per day")} suffix="km" value={form.mileage_limit_km} onChange={v => set("mileage_limit_km", v ?? 10)} /></View>
                <View style={{ flex: 1 }}><NumberField label={t("rental.editor.extraKm", "Each extra km")} suffix="RWF" value={form.extra_km_fee ?? 0} onChange={v => set("extra_km_fee", v ?? 0)} /></View>
              </View>
            )}
            <Text style={{ color: C.mid, fontSize: 12, fontWeight: "700", marginVertical: 6 }}>{t("rental.editor.fuelPolicy", "Fuel policy")}</Text>
            {FUEL_POLICIES.map(p => <Option key={p} on={form.fuel_policy === p} label={LABELS.fuelPolicy[p]} onPress={() => set("fuel_policy", p)} />)}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <View style={{ flex: 1 }}><NumberField label={t("rental.editor.minAge", "Driver min. age")} value={form.min_driver_age ?? 21} onChange={v => set("min_driver_age", v ?? 18)} /></View>
              <View style={{ flex: 1 }}><NumberField label={t("rental.editor.licenceYears", "Licence for (years)")} value={form.min_licence_years ?? 1} onChange={v => set("min_licence_years", v ?? 0)} /></View>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}><NumberField label={t("rental.editor.minDays", "Min. days")} value={form.min_days ?? 1} onChange={v => set("min_days", v ?? 1)} /></View>
              <View style={{ flex: 1 }}><NumberField label={t("rental.editor.maxDays", "Max. days")} value={form.max_days ?? null} onChange={v => set("max_days", v)} /></View>
            </View>
            <NumberField label={t("rental.editor.notice", "Notice before pickup")} suffix={t("rental.editor.hours", "hours")} value={form.notice_hours ?? 0} onChange={v => set("notice_hours", Math.min(336, v ?? 0))} />
            <Text style={{ color: C.mid, fontSize: 12, fontWeight: "700", marginVertical: 6 }}>{t("rental.editor.cancellation", "Cancellation policy")}</Text>
            {CANCELLATION_POLICIES.map(p => <Option key={p} on={form.cancellation_policy === p} label={LABELS.cancellation[p]} onPress={() => set("cancellation_policy", p)} />)}

            <Text style={{ color: C.mid, fontSize: 12, fontWeight: "700", marginTop: 12, marginBottom: 6 }}>{t("rental.editor.customRules", "Your own rules")}</Text>
            {form.rules.map((rule, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border }}>
                <Text style={{ flex: 1, color: C.dark }}>{rule}</Text>
                <TouchableOpacity onPress={() => set("rules", form.rules.filter((_, j) => j !== i))} accessibilityLabel={t("rental.editor.removeRule", "Remove rule")}>
                  <Ionicons name="trash-outline" size={18} color={C.orange} />
                </TouchableOpacity>
              </View>
            ))}
            {form.rules.length < 15 && (
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8, alignItems: "center" }}>
                <TextInput value={newRule} onChangeText={setNewRule} maxLength={200} placeholder={t("rental.editor.rulePlaceholder", "e.g. Return the car washed")} placeholderTextColor={C.muted}
                  accessibilityLabel={t("rental.editor.newRule", "New rule")} style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10, color: C.dark }} />
                <TouchableOpacity onPress={() => { if (newRule.trim().length >= 3) { set("rules", [...form.rules, newRule.trim()]); setNewRule(""); } }}
                  accessibilityLabel={t("rental.editor.addRule", "Add rule")} style={{ backgroundColor: C.teal, borderRadius: 10, padding: 10 }}>
                  <Ionicons name="add" size={20} color={C.white} />
                </TouchableOpacity>
              </View>
            )}
          </Section>

          {car && (
            <Section title={t("rental.editor.papers", "Papers")} hint={t("rental.editor.papersHint", "Only Jali's team sees these. Uploading new papers sends the car for a quick check again.")}>
              <DocRow label={LABELS.missing.registration} done={car.documents.registration} busy={uploading === "registration"} onPress={() => uploadDoc("registration")} />
              <DocRow label={LABELS.missing.insurance} done={car.documents.insurance} busy={uploading === "insurance"} onPress={() => uploadDoc("insurance")} />
              <Field label={t("rental.editor.insuranceExpiry", "Insurance valid until (YYYY-MM-DD)")} value={form.insurance_expiry ?? ""} onChangeText={v => set("insurance_expiry", v || null)} placeholder="2027-06-30" maxLength={10} />
            </Section>
          )}

          {car && (
            <Section title={t("rental.editor.availability", "Availability")}>
              <ToggleRow label={t("rental.editor.pause", "Pause this car (maintenance)")} hint={t("rental.editor.pauseHint", "Hidden from search; existing rentals stay.")}
                value={form.status === "maintenance"} onChange={v => set("status", v ? "maintenance" : "available")} />
              <Text style={{ color: C.mid, fontSize: 12, fontWeight: "700", marginTop: 8, marginBottom: 6 }}>{t("rental.editor.blocked", "Blocked days")}</Text>
              {car.blocks.map(b => (
                <View key={b.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6 }}>
                  <Text style={{ flex: 1, color: C.dark }}>{b.start_date} → {b.end_date}{b.reason ? ` · ${b.reason}` : ""}</Text>
                  <TouchableOpacity onPress={() => removeBlock(b.id)} accessibilityLabel={t("rental.editor.unblock", "Unblock")}><Ionicons name="close-circle" size={20} color={C.muted} /></TouchableOpacity>
                </View>
              ))}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginVertical: 8 }}>
                {nextDates(45).map(d => {
                  const f = formatDay(d, i18n.language);
                  const on = d === blockStart;
                  return (
                    <TouchableOpacity key={d} onPress={() => setBlockStart(d)} style={{ width: 56, paddingVertical: 6, borderRadius: 10, alignItems: "center", backgroundColor: on ? C.dark : C.bg }}>
                      <Text style={{ color: on ? C.white : C.mid, fontSize: 10, fontWeight: "700" }}>{f.weekday}</Text>
                      <Text style={{ color: on ? C.white : C.dark, fontSize: 11, fontWeight: "800" }}>{f.day}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <Stepper label={t("rental.editor.blockDays", "Number of days")} value={blockDays} min={1} max={60} onChange={setBlockDays} />
              <Field label={t("rental.editor.blockReason", "Reason (optional)")} value={blockReason} onChangeText={setBlockReason} maxLength={120} placeholder="Service, family trip" />
              <SecondaryButton icon="ban-outline" onPress={addBlock} label={t("rental.editor.block", { from: blockStart, to: addDays(blockStart, blockDays - 1), defaultValue: `Block ${blockStart} → ${addDays(blockStart, blockDays - 1)}` })} />
            </Section>
          )}

          <PrimaryButton label={isNew ? t("rental.editor.create", "Save car") : t("rental.editor.save", "Save changes")} busy={saving} onPress={save} icon="checkmark-circle-outline" />
          {car && <SecondaryButton icon="trash-outline" color={C.orange} onPress={removeCar} label={t("rental.editor.remove", "Remove car")} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AddTile({ icon, label, onPress, busy }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; busy: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={busy} accessibilityLabel={label}
      style={{ width: 96, height: 72, borderRadius: 10, borderWidth: 1.5, borderStyle: "dashed", borderColor: C.teal, alignItems: "center", justifyContent: "center", backgroundColor: C.tealLt }}>
      {busy ? <ActivityIndicator color={C.teal} /> : <><Ionicons name={icon} size={22} color={C.teal} /><Text style={{ color: C.teal, fontSize: 11, fontWeight: "700" }}>{label}</Text></>}
    </TouchableOpacity>
  );
}

function DocRow({ label, done, busy, onPress }: { label: string; done: boolean; busy: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={busy} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border }}>
      <Ionicons name={done ? "checkmark-circle" : "document-attach-outline"} size={22} color={done ? C.green : C.mid} />
      <Text style={{ flex: 1, color: C.dark, fontWeight: "600" }}>{label}</Text>
      {busy ? <ActivityIndicator color={C.teal} /> : <Text style={{ color: C.teal, fontWeight: "800" }}>{done ? "Replace" : "Upload"}</Text>}
    </TouchableOpacity>
  );
}

function Option({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: on }} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 6 }}>
      <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={20} color={on ? C.teal : C.muted} />
      <Text style={{ flex: 1, color: C.dark }}>{label}</Text>
    </TouchableOpacity>
  );
}
