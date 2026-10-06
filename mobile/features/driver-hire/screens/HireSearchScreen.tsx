import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, StatusBar, Alert, Modal, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { formatRwf } from "@/lib/fare";
import { Place } from "@/lib/places";
import {
  AvailableHireDriver, DriverHire, HireTripType, Transmission, TRIP_TYPES, TRANSMISSIONS, START_TIMES,
  kigaliIso, nextDates, formatDay,
} from "../hire";

type DurationType = "hours" | "days";

/** Hire a driver for my own car — story S6.3 */
export default function HireSearchScreen() {
  const { t, i18n } = useTranslation();
  const dates = useRef(nextDates(14)).current;
  const [date, setDate] = useState(dates[1]);
  const [time, setTime] = useState("09:00");
  const [durationType, setDurationType] = useState<DurationType>("hours");
  const [hours, setHours] = useState(4);
  const [days, setDays] = useState(1);
  const [tripType, setTripType] = useState<HireTripType>("city");
  const [transmission, setTransmission] = useState<Transmission>("automatic");
  const [pickup, setPickup] = useState<Place | null>(null);
  const [pickupSearch, setPickupSearch] = useState(false);
  const [carDescription, setCarDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState<Record<string, string | number> | null>(null);
  const [chosen, setChosen] = useState<AvailableHireDriver | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const place = await api.get<Place>("/places/reverse", { params: { lat: pos.coords.latitude, lng: pos.coords.longitude } }).then(r => r.data);
        setPickup(p => p ?? { ...place, name: place.name || t("ride.where.currentLocation") });
      } catch {
        // The customer can still search a pickup place
      }
    })();
  }, []);

  const durationValue = durationType === "hours" ? hours : days;
  const params = { start_at: kigaliIso(date, time), duration_type: durationType, duration_value: durationValue, trip_type: tripType, transmission };

  const { data: result, isFetching, error } = useQuery({
    queryKey: queryKeys.hire.available(search),
    queryFn: () => api.get<{ drivers: AvailableHireDriver[]; policy?: HirePolicy }>("/driver-hire/available", { params: search! }).then(r => r.data),
    enabled: !!search,
  });
  const data = result?.drivers;
  const errorMessage = (error as any)?.response?.data?.errors
    ? Object.values((error as any).response.data.errors as Record<string, string[]>)[0]?.[0]
    : error ? t("hire.search.error") : null;

  function find() {
    setSearch(params);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />
      <View style={{ backgroundColor: C.white, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel={t("common.back", "Back")}>
          <Ionicons name="arrow-back" size={24} color={C.dark} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "900", fontSize: 18, color: C.dark }}>{t("hire.title")}</Text>
          <Text style={{ color: C.mid, fontSize: 12 }}>{t("hire.subtitle")}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 14 }} keyboardShouldPersistTaps="handled">
        <Section title={t("hire.search.when")}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {dates.map((d, i) => {
              const f = formatDay(d, i18n.language);
              const on = d === date;
              return (
                <TouchableOpacity key={d} onPress={() => setDate(d)} accessibilityLabel={`${f.weekday} ${f.day}`}
                  style={{ width: 64, paddingVertical: 8, borderRadius: 12, alignItems: "center", backgroundColor: on ? C.dark : C.white, borderWidth: 1, borderColor: on ? C.dark : C.border }}>
                  <Text style={{ color: on ? C.white : C.mid, fontSize: 11, fontWeight: "700" }}>{i === 0 ? t("hire.search.today") : f.weekday}</Text>
                  <Text style={{ color: on ? C.white : C.dark, fontWeight: "800", fontSize: 12 }}>{f.day}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 10 }}>
            {START_TIMES.map(tm => (
              <Chip key={tm} label={tm} on={tm === time} onPress={() => setTime(tm)} />
            ))}
          </ScrollView>
        </Section>

        <Section title={t("hire.search.howLong")}>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
            <Chip label={t("hire.search.byHour")} on={durationType === "hours"} onPress={() => setDurationType("hours")} />
            <Chip label={t("hire.search.byDay")} on={durationType === "days"} onPress={() => setDurationType("days")} />
          </View>
          <Stepper
            value={durationValue}
            label={durationType === "hours" ? t("hire.hours", { count: hours }) : t("hire.days", { count: days })}
            onChange={v => (durationType === "hours" ? setHours(Math.min(16, Math.max(1, v))) : setDays(Math.min(14, Math.max(1, v))))}
          />
        </Section>

        <Section title={t("hire.search.tripType")}>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {TRIP_TYPES.map(tt => <Chip key={tt} label={t(`hire.trip_${tt}`)} on={tripType === tt} onPress={() => setTripType(tt)} />)}
          </View>
        </Section>

        <Section title={t("hire.search.transmission")} hint={t("hire.search.transmissionHint")}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {TRANSMISSIONS.map(tr => <Chip key={tr} label={t(`hire.tr_${tr}`)} on={transmission === tr} onPress={() => setTransmission(tr)} />)}
          </View>
        </Section>

        <Section title={t("hire.search.pickup")}>
          <TouchableOpacity onPress={() => setPickupSearch(true)} accessibilityLabel={t("hire.search.pickup")}
            style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.green }} />
            <Text numberOfLines={2} style={{ flex: 1, color: pickup ? C.dark : C.muted }}>{pickup ? (pickup.address || pickup.name) : t("hire.search.choosePickup")}</Text>
            <Ionicons name="chevron-forward" size={18} color={C.muted} />
          </TouchableOpacity>
        </Section>

        <Section title={t("hire.search.yourCar")}>
          <TextInput value={carDescription} onChangeText={setCarDescription} maxLength={200} placeholder={t("hire.search.carPlaceholder")}
            placeholderTextColor={C.muted} accessibilityLabel={t("hire.search.yourCar")}
            style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10, color: C.dark }} />
          <TextInput value={notes} onChangeText={setNotes} maxLength={500} multiline placeholder={t("hire.search.notesPlaceholder")}
            placeholderTextColor={C.muted} accessibilityLabel={t("hire.search.notes")}
            style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10, color: C.dark, marginTop: 8, minHeight: 60, textAlignVertical: "top" }} />
        </Section>

        <TouchableOpacity onPress={find} accessibilityLabel={t("hire.search.find")}
          style={{ backgroundColor: C.dark, borderRadius: 16, paddingVertical: 16, alignItems: "center" }}>
          <Text style={{ color: C.white, fontWeight: "900", fontSize: 16 }}>{t("hire.search.find")}</Text>
        </TouchableOpacity>

        {search ? (
          isFetching ? (
            <View style={{ gap: 10 }}>{[0, 1, 2].map(i => <View key={i} style={{ height: 110, borderRadius: 16, backgroundColor: C.border, opacity: 0.5 }} />)}</View>
          ) : errorMessage ? (
            <Text style={{ color: C.orange, textAlign: "center" }}>{errorMessage}</Text>
          ) : !data?.length ? (
            <View style={{ alignItems: "center", padding: 20, gap: 6 }}>
              <Ionicons name="person-outline" size={36} color={C.muted} />
              <Text style={{ color: C.mid, textAlign: "center" }}>{t("hire.search.none")}</Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <Text style={{ fontWeight: "900", color: C.dark }}>{t("hire.search.results", { count: data.length })}</Text>
              {data.map(d => <DriverCard key={d.driver_id} driver={d} onBook={() => setChosen(d)} />)}
            </View>
          )
        ) : null}
      </ScrollView>

      <PickupSearch visible={pickupSearch} onClose={() => setPickupSearch(false)} onPick={p => { setPickup(p); setPickupSearch(false); }} />
      {chosen && search ? (
        <ConfirmSheet driver={chosen} params={search} pickup={pickup} carDescription={carDescription} notes={notes} policy={result?.policy} onClose={() => setChosen(null)} />
      ) : null}
    </SafeAreaView>
  );
}

function DriverCard({ driver, onBook }: { driver: AvailableHireDriver; onBook: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={{ backgroundColor: C.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.border }}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        {driver.photo ? (
          <Image source={{ uri: driver.photo }} style={{ width: 52, height: 52, borderRadius: 26 }} />
        ) : (
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="person" size={24} color={C.mid} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "900", fontSize: 16, color: C.dark }}>{driver.name}</Text>
          <Text style={{ color: C.mid, fontSize: 12 }}>
            {driver.rating_count ? `★ ${driver.rating.toFixed(1)} (${driver.rating_count})` : t("hire.newDriver")}
            {driver.years_experience != null ? ` · ${t("hire.yearsExp", { count: driver.years_experience })}` : ""}
          </Text>
          <Text style={{ color: C.mid, fontSize: 12 }}>
            {driver.languages.map(l => t(`hire.lang_${l}`)).join(", ")} · {driver.transmissions.map(tr => t(`hire.tr_${tr}`)).join(" / ")}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontWeight: "900", fontSize: 17, color: C.dark }}>{formatRwf(driver.quote.total)}</Text>
          <Text style={{ color: C.muted, fontSize: 11 }}>{formatRwf(driver.rates.hourly_rate)}/{t("hire.perHour")}</Text>
        </View>
      </View>
      <TouchableOpacity onPress={onBook} accessibilityLabel={t("hire.book", { name: driver.name })}
        style={{ marginTop: 12, backgroundColor: C.teal, borderRadius: 12, paddingVertical: 11, alignItems: "center" }}>
        <Text style={{ color: C.white, fontWeight: "800" }}>{t("hire.book", { name: driver.name })}</Text>
      </TouchableOpacity>
    </View>
  );
}

type HirePolicy = { free_cancel_hours: number; late_cancel_pct: number; no_show_grace_min: number; overtime_grace_min: number };

/** Price breakdown, terms and payment before booking */
function ConfirmSheet({ driver, params, pickup, carDescription, notes, policy, onClose }: {
  driver: AvailableHireDriver; params: Record<string, string | number>; pickup: Place | null; carDescription: string; notes: string;
  policy?: HirePolicy; onClose: () => void;
}) {
  const { t } = useTranslation();
  const [terms, setTerms] = useState(false);
  const [payment, setPayment] = useState<"cash" | "momo">("cash");
  const [busy, setBusy] = useState(false);
  const q = driver.quote;

  async function book() {
    if (!pickup) {
      Alert.alert(t("hire.search.choosePickup"));
      return;
    }
    setBusy(true);
    try {
      const res = await api.post<DriverHire>("/driver-hire", {
        ...params, driver_id: driver.driver_id, payment_method: payment, accept_terms: terms,
        pickup: { lat: pickup.lat, lng: pickup.lng, address: pickup.address || pickup.name },
        car_description: carDescription || null, notes: notes || null,
      });
      onClose();
      router.replace(`/hire/${res.data.id}` as any);
    } catch (err: any) {
      const errors = err?.response?.data?.errors;
      Alert.alert(errors ? (Object.values(errors)[0] as string[])[0] : err?.response?.data?.message ?? t("hire.search.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 34, gap: 10 }}>
          <Text style={{ fontWeight: "900", fontSize: 18, color: C.dark }}>{t("hire.confirm.title", { name: driver.name })}</Text>
          <Row label={params.duration_type === "days"
            ? t("hire.confirm.days", { count: q.days, rate: formatRwf(driver.rates.daily_rate) })
            : t("hire.confirm.hours", { count: q.billable_hours, rate: formatRwf(driver.rates.hourly_rate) })} value="" />
          {params.trip_type === "out_of_town" && driver.rates.out_of_town_fee ? (
            <Row label={t("hire.confirm.outOfTown", { count: q.days })} value={formatRwf((driver.rates.out_of_town_fee ?? 0) * q.days)} />
          ) : null}
          <Row label={t("hire.confirm.driverPrice")} value={formatRwf(q.driver_total)} />
          <Row label={t("ride.trip.jaliFee")} value={formatRwf(q.service_fee)} />
          <Row label={t("ride.trip.total")} value={formatRwf(q.total)} bold />
          <Text style={{ color: C.muted, fontSize: 12 }}>{t("hire.confirm.overtime", { rate: formatRwf(driver.rates.overtime_per_hour) })}</Text>
          {policy ? (
            // S6.5: the rules before booking — the driver's terms; Jali takes no fee
            <View style={{ backgroundColor: C.bg, borderRadius: 12, padding: 10, gap: 3 }}>
              <Text style={{ color: C.dark, fontSize: 12 }}>
                {t("hire.policy.cancel", { hours: policy.free_cancel_hours, pct: policy.late_cancel_pct,
                  defaultValue: `Free cancellation until ${policy.free_cancel_hours} h before the start; later, ${policy.late_cancel_pct}% of the driver's price.` })}
              </Text>
              <Text style={{ color: C.dark, fontSize: 12 }}>
                {t("hire.policy.noShow", { min: policy.no_show_grace_min, pct: policy.late_cancel_pct,
                  defaultValue: `No-show: ${policy.no_show_grace_min} min after the start either side can report it. If the driver doesn't come you pay nothing; if you don't show, ${policy.late_cancel_pct}% applies.` })}
              </Text>
            </View>
          ) : null}

          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["cash", "momo"] as const).map(m => <Chip key={m} label={t(`ride.driverTrip.${m}`)} on={payment === m} onPress={() => setPayment(m)} />)}
          </View>

          <TouchableOpacity onPress={() => setTerms(!terms)} accessibilityLabel={t("hire.confirm.terms")} accessibilityState={{ checked: terms }}
            style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 4 }}>
            <Ionicons name={terms ? "checkbox" : "square-outline"} size={22} color={terms ? C.teal : C.mid} />
            <Text style={{ flex: 1, color: C.dark, fontSize: 13 }}>{t("hire.confirm.terms")}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/legal/hire-terms" as any)} accessibilityLabel={t("hire.confirm.readTerms")}>
            <Text style={{ color: C.teal, fontWeight: "800", fontSize: 13 }}>{t("hire.confirm.readTerms")}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={book} disabled={!terms || busy} accessibilityLabel={t("hire.confirm.send")}
            style={{ backgroundColor: terms ? C.dark : C.muted, borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 4 }}>
            {busy ? <ActivityIndicator color={C.white} /> : <Text style={{ color: C.white, fontWeight: "900", fontSize: 16 }}>{t("hire.confirm.send")}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} accessibilityLabel={t("ride.trip.keep")} style={{ alignItems: "center", paddingVertical: 6 }}>
            <Text style={{ color: C.mid, fontWeight: "700" }}>{t("hire.confirm.back")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function PickupSearch({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (p: Place) => void }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onChange(text: string) {
    setQuery(text);
    if (debounce.current) clearTimeout(debounce.current);
    if (text.trim().length < 2) return setResults([]);
    debounce.current = setTimeout(async () => {
      setBusy(true);
      try {
        setResults(await api.get<Place[]>("/places/search", { params: { q: text } }).then(r => r.data));
      } catch {
        setResults([]);
      } finally {
        setBusy(false);
      }
    }, 350);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.white }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 16 }}>
          <TouchableOpacity onPress={onClose} accessibilityLabel={t("common.back", "Back")}>
            <Ionicons name="close" size={24} color={C.dark} />
          </TouchableOpacity>
          <TextInput value={query} onChangeText={onChange} autoFocus placeholder={t("hire.search.pickupPlaceholder")} placeholderTextColor={C.muted}
            accessibilityLabel={t("hire.search.pickup")}
            style={{ flex: 1, backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: C.dark }} />
        </View>
        {busy ? <ActivityIndicator color={C.teal} /> : null}
        <ScrollView keyboardShouldPersistTaps="handled">
          {results.map((p, i) => (
            <TouchableOpacity key={`${p.lat},${p.lng},${i}`} onPress={() => onPick(p)} accessibilityLabel={p.name}
              style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
              <Text style={{ fontWeight: "700", color: C.dark }}>{p.name}</Text>
              {p.address ? <Text numberOfLines={1} style={{ color: C.mid, fontSize: 12 }}>{p.address}</Text> : null}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: C.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.border }}>
      <Text style={{ fontWeight: "900", color: C.dark, marginBottom: hint ? 2 : 10 }}>{title}</Text>
      {hint ? <Text style={{ color: C.muted, fontSize: 12, marginBottom: 10 }}>{hint}</Text> : null}
      {children}
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} accessibilityLabel={label} accessibilityState={{ selected: on }}
      style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: on ? C.teal : C.bg, borderWidth: 1, borderColor: on ? C.teal : C.border }}>
      <Text style={{ color: on ? C.white : C.mid, fontWeight: "700", fontSize: 13 }}>{label}</Text>
    </TouchableOpacity>
  );
}

function Stepper({ value, label, onChange }: { value: number; label: string; onChange: (v: number) => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <TouchableOpacity onPress={() => onChange(value - 1)} accessibilityLabel="−" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="remove" size={22} color={C.dark} />
      </TouchableOpacity>
      <Text style={{ fontWeight: "900", fontSize: 18, color: C.dark }}>{label}</Text>
      <TouchableOpacity onPress={() => onChange(value + 1)} accessibilityLabel="+" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="add" size={22} color={C.dark} />
      </TouchableOpacity>
    </View>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
      <Text style={{ color: bold ? C.dark : C.mid, fontWeight: bold ? "900" : "400", flex: 1 }}>{label}</Text>
      <Text style={{ color: C.dark, fontWeight: bold ? "900" : "600" }}>{value}</Text>
    </View>
  );
}
