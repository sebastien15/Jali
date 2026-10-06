import { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Switch, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { formatRwf } from "@/lib/fare";
import { LANGUAGES, TRANSMISSIONS, HireLanguage, Transmission, nextDates, formatDay } from "../hire";
import type { components } from "@/lib/apiSchema";

type SettingsPayload = components["schemas"]["HireSettingsPayload"];
type Availability = components["schemas"]["Availability"];
type Day = { on: boolean; start: string; end: string };

const RATE_FIELDS = ["hourly_rate", "min_hours", "daily_rate", "daily_hours", "overtime_per_hour", "out_of_town_fee"] as const;
type RateField = (typeof RATE_FIELDS)[number];
const DEFAULTS: Record<RateField, string> = { hourly_rate: "3000", min_hours: "2", daily_rate: "25000", daily_hours: "10", overtime_per_hour: "4000", out_of_town_fee: "10000" };
const WEEK = [1, 2, 3, 4, 5, 6, 0];

/** Driver: hire-a-driver prices & skills (S6.1) and availability (S6.2) */
export default function HireSettingsScreen() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [rates, setRates] = useState<Record<RateField, string>>(DEFAULTS);
  const [active, setActive] = useState(true);
  const [transmissions, setTransmissions] = useState<Transmission[]>(["automatic"]);
  const [languages, setLanguages] = useState<HireLanguage[]>(["rw"]);
  const [years, setYears] = useState("");
  const [days, setDays] = useState<Record<number, Day>>(() => Object.fromEntries(WEEK.map(d => [d, { on: false, start: "07:00", end: "19:00" }])));
  const [blocked, setBlocked] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  // S13.7: hire with my car
  const [offersCar, setOffersCar] = useState(false);
  const [carId, setCarId] = useState<number | null>(null);
  const [car, setCar] = useState({ car_hourly_rate: "12000", km_per_hour: "15", extra_km_rate: "500" });
  const dates = useMemo(() => nextDates(60), []);

  const settings = useQuery({
    queryKey: queryKeys.driver.hireSettings(),
    queryFn: () => api.get<SettingsPayload>("/driver/hire-settings").then(r => r.data),
  });
  const vehicles = useQuery({
    queryKey: queryKeys.driver.vehicles(),
    queryFn: () => api.get<{ id: number; make?: string | null; model: string; plate: string; is_active: boolean }[]>("/driver/vehicles").then(r => r.data),
  });
  const availability = useQuery({
    queryKey: queryKeys.driver.availability(),
    queryFn: () => api.get<Availability>("/driver/availability").then(r => r.data),
  });

  useEffect(() => {
    const s = settings.data;
    if (!s) return;
    if (s.settings) {
      setRates(Object.fromEntries(RATE_FIELDS.map(f => [f, String(s.settings![f] ?? "")])) as Record<RateField, string>);
      setActive(s.settings.is_active);
      setOffersCar(!!s.settings.offers_car);
      setCarId(s.settings.car_vehicle_id ?? null);
      if (s.settings.car_hourly_rate != null) {
        setCar({ car_hourly_rate: String(s.settings.car_hourly_rate), km_per_hour: String(s.settings.km_per_hour ?? 15), extra_km_rate: String(s.settings.extra_km_rate ?? 0) });
      }
    }
    if (s.skills.transmissions.length) setTransmissions(s.skills.transmissions);
    if (s.skills.languages.length) setLanguages(s.skills.languages);
    if (s.skills.years_experience != null) setYears(String(s.skills.years_experience));
  }, [settings.data]);

  useEffect(() => {
    const a = availability.data;
    if (!a) return;
    setDays(prev => {
      const next = { ...prev };
      a.weekly.forEach(w => { next[w.weekday] = { on: true, start: w.start_time, end: w.end_time }; });
      return next;
    });
    setBlocked(a.blocked_dates);
  }, [availability.data]);

  const limits = settings.data?.limits;
  const forbidden = (settings.error as any)?.response?.status === 403;

  async function save() {
    setErrors({});
    setSaving(true);
    try {
      const saved = await api.put<SettingsPayload>("/driver/hire-settings", {
        ...Object.fromEntries(RATE_FIELDS.map(f => [f, Number(rates[f] || 0)])),
        is_active: active, transmissions, languages, years_experience: Number(years || 0),
        offers_car: offersCar,
        ...(offersCar ? { car_vehicle_id: carId, car_hourly_rate: Number(car.car_hourly_rate || 0), km_per_hour: Number(car.km_per_hour || 15), extra_km_rate: Number(car.extra_km_rate || 0) } : {}),
      });
      queryClient.setQueryData(queryKeys.driver.hireSettings(), saved.data);
      const weekly = WEEK.filter(d => days[d].on).map(d => ({ weekday: d, start_time: days[d].start, end_time: days[d].end }));
      const av = await api.put<Availability>("/driver/availability", { weekly, blocked_dates: blocked });
      queryClient.setQueryData(queryKeys.driver.availability(), av.data);
      Alert.alert(t("hire.settings.saved"));
      router.back();
    } catch (err: any) {
      const fieldErrors = err?.response?.data?.errors;
      if (fieldErrors) {
        setErrors(Object.fromEntries(Object.entries(fieldErrors).map(([k, v]) => [k.split(".")[0], (v as string[])[0]])));
      } else {
        Alert.alert(err?.response?.data?.message ?? "Error");
      }
    } finally {
      setSaving(false);
    }
  }

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />
      <View style={{ backgroundColor: C.white, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel={t("common.back", "Back")}>
          <Ionicons name="arrow-back" size={24} color={C.dark} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontWeight: "900", fontSize: 18, color: C.dark }}>{t("hire.settings.title")}</Text>
      </View>

      {settings.isLoading ? <ActivityIndicator color={C.teal} style={{ marginTop: 32 }} /> : forbidden ? (
        <Text style={{ color: C.mid, textAlign: "center", padding: 32 }}>{t("hire.settings.notVerified")}</Text>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 14 }} keyboardShouldPersistTaps="handled">
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "900", color: C.dark }}>{t("hire.settings.active")}</Text>
                <Text style={{ color: C.mid, fontSize: 12 }}>{t("hire.settings.activeSub")}</Text>
              </View>
              <Switch value={active} onValueChange={setActive} trackColor={{ true: C.teal, false: C.border }} accessibilityLabel={t("hire.settings.active")} />
            </View>
          </Card>

          <Card title={t("hire.settings.prices")} hint={limits ? t("hire.settings.limits", {
            hmin: formatRwf(limits.hourly_min ?? 0), hmax: formatRwf(limits.hourly_max ?? 0),
            dmin: formatRwf(limits.daily_min ?? 0), dmax: formatRwf(limits.daily_max ?? 0),
          }) : undefined}>
            {RATE_FIELDS.map(f => (
              <Field key={f} label={t(`hire.settings.${f}`)} value={rates[f]} error={errors[f]}
                onChange={v => setRates({ ...rates, [f]: v.replace(/\D/g, "") })} />
            ))}
            {limits?.commission_pct != null ? <Text style={{ color: C.muted, fontSize: 12 }}>{t("hire.settings.commission", { pct: limits.commission_pct })}</Text> : null}
          </Card>

          <Card title={t("hire.settings.withCar", "Hire with my car")} hint={t("hire.settings.withCarHint", "Customers book 2, 4 or 8 hours with your car. Each hour includes some km; extra km and time are charged at your rates.")}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ fontWeight: "800", color: C.dark }}>{t("hire.settings.offersCar", "Offer my car too")}</Text>
              <Switch value={offersCar} onValueChange={setOffersCar} trackColor={{ true: C.teal, false: C.border }} accessibilityLabel={t("hire.settings.offersCar", "Offer my car too")} />
            </View>
            {offersCar ? (
              <>
                <Text style={{ color: C.mid, fontWeight: "700", fontSize: 12, marginBottom: 6 }}>{t("hire.settings.whichCar", "Which car")}</Text>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                  {(vehicles.data ?? []).filter(v => v.is_active).map(v => (
                    <Chip key={v.id} label={`${v.make ? v.make + " " : ""}${v.model} · ${v.plate}`} on={carId === v.id} onPress={() => setCarId(v.id)} />
                  ))}
                </View>
                {errors.car_vehicle_id ? <ErrorText text={errors.car_vehicle_id} /> : null}
                <Field label={t("hire.settings.car_hourly_rate", "Price per hour with my car")} value={car.car_hourly_rate} error={errors.car_hourly_rate}
                  onChange={v => setCar({ ...car, car_hourly_rate: v.replace(/\D/g, "") })} />
                <Field label={t("hire.settings.km_per_hour", "Km included per hour")} value={car.km_per_hour} error={errors.km_per_hour}
                  onChange={v => setCar({ ...car, km_per_hour: v.replace(/\D/g, "") })} />
                <Field label={t("hire.settings.extra_km_rate", "Price per extra km")} value={car.extra_km_rate} error={errors.extra_km_rate}
                  onChange={v => setCar({ ...car, extra_km_rate: v.replace(/\D/g, "") })} />
              </>
            ) : null}
          </Card>

          <Card title={t("hire.settings.skills")}>
            <Text style={{ color: C.mid, fontWeight: "700", fontSize: 12, marginBottom: 6 }}>{t("hire.search.transmission")}</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
              {TRANSMISSIONS.map(tr => <Chip key={tr} label={t(`hire.tr_${tr}`)} on={transmissions.includes(tr)} onPress={() => setTransmissions(toggle(transmissions, tr))} />)}
            </View>
            {errors.transmissions ? <ErrorText text={errors.transmissions} /> : null}
            <Text style={{ color: C.mid, fontWeight: "700", fontSize: 12, marginVertical: 6 }}>{t("hire.settings.languages")}</Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {LANGUAGES.map(l => <Chip key={l} label={t(`hire.lang_${l}`)} on={languages.includes(l)} onPress={() => setLanguages(toggle(languages, l))} />)}
            </View>
            {errors.languages ? <ErrorText text={errors.languages} /> : null}
            <Field label={t("hire.settings.years")} value={years} error={errors.years_experience} onChange={v => setYears(v.replace(/\D/g, "").slice(0, 2))} />
            {settings.data?.skills.licence_categories.length ? (
              <Text style={{ color: C.muted, fontSize: 12 }}>{t("hire.settings.licence", { list: settings.data.skills.licence_categories.join(", ") })}</Text>
            ) : null}
          </Card>

          <Card title={t("hire.settings.week")} hint={t("hire.settings.weekHint")}>
            {WEEK.map(d => {
              const day = days[d];
              const label = formatDay(`2026-10-${String(11 + d).padStart(2, "0")}`, i18n.language).weekday; // 11 Oct 2026 is a Sunday
              return (
                <View key={d} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}>
                  <Switch value={day.on} onValueChange={on => setDays({ ...days, [d]: { ...day, on } })} trackColor={{ true: C.teal, false: C.border }} accessibilityLabel={label} />
                  <Text style={{ width: 44, fontWeight: "700", color: day.on ? C.dark : C.muted }}>{label}</Text>
                  {day.on ? (
                    <>
                      <TimeInput value={day.start} onChange={start => setDays({ ...days, [d]: { ...day, start } })} label={`${label} start`} />
                      <Text style={{ color: C.muted }}>–</Text>
                      <TimeInput value={day.end} onChange={end => setDays({ ...days, [d]: { ...day, end } })} label={`${label} end`} />
                    </>
                  ) : <Text style={{ color: C.muted, fontSize: 12 }}>{t("hire.settings.off")}</Text>}
                </View>
              );
            })}
            {errors.weekly ? <ErrorText text={errors.weekly} /> : null}
          </Card>

          <Card title={t("hire.settings.blocked")} hint={t("hire.settings.blockedHint")}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {dates.map(date => {
                const f = formatDay(date, i18n.language);
                const on = blocked.includes(date);
                return (
                  <TouchableOpacity key={date} onPress={() => setBlocked(toggle(blocked, date))} accessibilityLabel={`${f.weekday} ${f.day}`} accessibilityState={{ selected: on }}
                    style={{ width: 60, paddingVertical: 8, borderRadius: 12, alignItems: "center", backgroundColor: on ? C.orange : C.white, borderWidth: 1, borderColor: on ? C.orange : C.border }}>
                    <Text style={{ color: on ? C.white : C.mid, fontSize: 11, fontWeight: "700" }}>{f.weekday}</Text>
                    <Text style={{ color: on ? C.white : C.dark, fontWeight: "800", fontSize: 12 }}>{f.day}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Card>

          <TouchableOpacity onPress={save} disabled={saving} accessibilityLabel={t("hire.settings.save")}
            style={{ backgroundColor: C.dark, borderRadius: 16, paddingVertical: 16, alignItems: "center" }}>
            {saving ? <ActivityIndicator color={C.white} /> : <Text style={{ color: C.white, fontWeight: "900", fontSize: 16 }}>{t("hire.settings.save")}</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Card({ title, hint, children }: { title?: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: C.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.border }}>
      {title ? <Text style={{ fontWeight: "900", color: C.dark, marginBottom: hint ? 2 : 8 }}>{title}</Text> : null}
      {hint ? <Text style={{ color: C.muted, fontSize: 12, marginBottom: 8 }}>{hint}</Text> : null}
      {children}
    </View>
  );
}

function Field({ label, value, onChange, error }: { label: string; value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ color: C.mid, fontSize: 12, fontWeight: "700", marginBottom: 4 }}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} keyboardType="number-pad" accessibilityLabel={label}
        style={{ borderWidth: 1, borderColor: error ? C.orange : C.border, borderRadius: 10, padding: 10, color: C.dark }} />
      {error ? <ErrorText text={error} /> : null}
    </View>
  );
}

function TimeInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <TextInput value={value} maxLength={5} keyboardType="numbers-and-punctuation" accessibilityLabel={label}
      onChangeText={v => {
        const digits = v.replace(/\D/g, "").slice(0, 4);
        onChange(digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits);
      }}
      style={{ borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, width: 64, textAlign: "center", color: C.dark }} />
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

function ErrorText({ text }: { text: string }) {
  return <Text style={{ color: C.orange, fontSize: 12, marginTop: 2 }}>{text}</Text>;
}
