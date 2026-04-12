import { useState, useEffect, useMemo } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, Platform, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import { PrivateCard } from "@/components/PrivateCard";
import { RentalCard } from "@/components/RentalCard";
import { BookingSheet } from "@/components/BookingSheet";
import { StationPicker } from "@/components/StationPicker";
import { TripCard, TripResult } from "@/components/TripCard";
import { TripBookingSheet } from "@/components/TripBookingSheet";
import api from "@/lib/api";

type Mode = "bus" | "private" | "rental";

function formatDateLabel(d: Date): string {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-RW", { month: "short", day: "numeric" });
}

function formatDateParam(d: Date): string {
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

type StationObj = { id: number; city: string };

export default function HomeScreen() {
  const { t } = useTranslation();

  const [from, setFrom]     = useState<StationObj | null>(null);
  const [to, setTo]         = useState<StationObj | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showPicker, setShowPicker]     = useState(false);

  const [mode, setMode]         = useState<Mode>("bus");
  const [rentalDays, setRD]     = useState(1);
  const [agencyFilter, setAgencyFilter] = useState<string | null>(null);

  const [sheet, setSheet]         = useState<any>(null);
  const [tripSheet, setTripSheet] = useState<TripResult | null>(null);
  const [tripSheetDate, setTripSheetDate] = useState<string>("");

  const [trips, setTrips]       = useState<TripResult[]>([]);
  const [cars, setCars]         = useState<any[]>([]);
  const [privateSeats, setPrivate] = useState<any[]>([]);
  const [loadingData, setLoading]  = useState(false);
  const [error, setError]          = useState<string | null>(null);

  const dateLabel = formatDateLabel(selectedDate);
  const dateParam = formatDateParam(selectedDate);

  function fetchAll() {
    setLoading(true);
    setError(null);

    const tripParams: Record<string, any> = {};
    if (from?.id) tripParams.from_station_id = from.id;
    if (to?.id)   tripParams.to_station_id   = to.id;

    Promise.all([
      api.get("/trips", { params: tripParams }),
      api.get("/car-rentals"),
      api.get("/private-seats", {
        params: { from: from?.city, ...(to?.city ? { to: to.city } : {}), date: dateParam },
      }),
    ])
      .then(([tripsRes, carRes, privateRes]) => {
        setTrips(tripsRes.data ?? []);
        setCars(carRes.data ?? []);
        setPrivate(privateRes.data ?? []);
        setAgencyFilter(null); // reset agency filter on new fetch
      })
      .catch((err) => {
        const msg = err?.response?.data?.message ?? err?.response?.data?.error ?? "Failed to load. Check your connection.";
        setError(msg);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchAll(); }, [from, to, selectedDate]);

  // Unique agencies from trips list
  const agencies = useMemo(() => {
    const names = [...new Set(trips.map(t => t.agency_name))].sort();
    return names;
  }, [trips]);

  // Apply agency filter to trips
  const filteredTrips = useMemo(() => {
    return trips.filter(trip => {
      if (agencyFilter && trip.agency_name !== agencyFilter) return false;
      return true;
    });
  }, [trips, agencyFilter]);

  const isFiltered = !!from || !!to;

  const quickDates = [
    { label: "Today",    date: new Date() },
    { label: "Tomorrow", date: (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; })() },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.blue} />

      {/* ── Blue header ── */}
      <View style={{ backgroundColor: C.blue, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 0 }}>
        {/* Title row */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <View>
            <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: "600" }}>{t('home.greeting')}</Text>
            <Text style={{ color: C.white, fontWeight: "900", fontSize: 22 }}>{t('home.whereTo')}</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/profile")}
            style={{
              backgroundColor: C.yellow, borderRadius: 50, width: 42, height: 42,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Ionicons name="person" size={20} color={C.dark} />
          </TouchableOpacity>
        </View>

        {/* From / To */}
        <View style={{
          backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 18,
          padding: 14, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12,
        }}>
          <StationPicker value={from} onChange={setFrom as any} placeholder="From" exclude={to} />
          <TouchableOpacity
            onPress={() => { const tmp = from; setFrom(to); setTo(tmp); }}
            style={{
              backgroundColor: C.yellow, borderRadius: 10, width: 34, height: 34,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 16 }}>⇄</Text>
          </TouchableOpacity>
          <StationPicker value={to} onChange={setTo as any} placeholder={t('home.toAny')} exclude={from} />
        </View>

        {/* Date chips — Today, Tomorrow, Pick date */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 8, paddingBottom: 16 }}>
            {quickDates.map(qd => {
              const active = qd.label === dateLabel;
              return (
                <TouchableOpacity
                  key={qd.label}
                  onPress={() => setSelectedDate(qd.date)}
                  style={{
                    backgroundColor: active ? C.yellow : "rgba(255,255,255,0.15)",
                    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8,
                  }}
                >
                  <Text style={{ color: active ? C.dark : C.white, fontWeight: "800", fontSize: 13 }}>
                    {qd.label}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Custom date chip */}
            <TouchableOpacity
              onPress={() => setShowPicker(true)}
              style={{
                flexDirection: "row", alignItems: "center", gap: 6,
                backgroundColor: !["Today", "Tomorrow"].includes(dateLabel)
                  ? C.yellow
                  : "rgba(255,255,255,0.15)",
                borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
              }}
            >
              <Ionicons
                name="calendar-outline"
                size={14}
                color={!["Today", "Tomorrow"].includes(dateLabel) ? C.dark : C.white}
              />
              <Text style={{
                color: !["Today", "Tomorrow"].includes(dateLabel) ? C.dark : C.white,
                fontWeight: "800", fontSize: 13,
              }}>
                {["Today", "Tomorrow"].includes(dateLabel) ? "Pick date" : dateLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      {/* DateTimePicker in a modal so it's visible on all platforms */}
      <Modal visible={showPicker} transparent animationType="fade">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
          activeOpacity={1}
          onPress={() => setShowPicker(false)}
        >
          <View style={{ backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: 32 }}>
            <DateTimePicker
              value={selectedDate}
              mode="date"
              minimumDate={new Date()}
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(_, date) => {
                if (date) setSelectedDate(date);
                if (Platform.OS === "android") setShowPicker(false);
              }}
            />
            {Platform.OS === "ios" && (
              <TouchableOpacity
                onPress={() => setShowPicker(false)}
                style={{ backgroundColor: C.blue, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 8 }}
              >
                <Text style={{ color: C.white, fontWeight: "800", fontSize: 16 }}>Done</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Mode tabs ── */}
      <View style={{ flexDirection: "row", backgroundColor: C.white, borderBottomWidth: 2, borderBottomColor: C.border }}>
        {([
          { id: "bus",     icon: "🚌", label: t('home.modeBus')    },
          { id: "private", icon: "💺", label: t('home.modePrivate') },
          { id: "rental",  icon: "🚗", label: t('home.modeRental')  },
        ] as const).map(m => (
          <TouchableOpacity
            key={m.id}
            onPress={() => setMode(m.id)}
            style={{
              flex: 1, alignItems: "center", paddingTop: 14, paddingBottom: 11,
              borderBottomWidth: 3,
              borderBottomColor: mode === m.id ? C.blue : "transparent",
            }}
          >
            <Text style={{ fontSize: 18 }}>{m.icon}</Text>
            <Text style={{ color: mode === m.id ? C.blue : C.mid, fontWeight: "800", fontSize: 12 }}>
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Filter bar (bus only) ── */}
      {mode === "bus" && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border }}
        >
          <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 9, alignItems: "center" }}>
            {/* Agency chips */}
            {agencies.map(name => {
              const active = agencyFilter === name;
              return (
                <TouchableOpacity
                  key={name}
                  onPress={() => setAgencyFilter(active ? null : name)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
                    backgroundColor: active ? C.teal : C.bg,
                    borderWidth: active ? 0 : 1.5, borderColor: C.border,
                    flexDirection: "row", alignItems: "center", gap: 5,
                  }}
                >
                  <Ionicons name="business-outline" size={11} color={active ? C.white : C.mid} />
                  <Text style={{ color: active ? C.white : C.mid, fontWeight: "700", fontSize: 12 }}>
                    {name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* ── Listings ── */}
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {loadingData && <ActivityIndicator color={C.blue} style={{ marginTop: 32 }} />}

        {error && !loadingData && (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <Text style={{ fontSize: 40 }}>⚠️</Text>
            <Text style={{ color: C.orange, fontWeight: "700", fontSize: 14, marginTop: 8, textAlign: "center" }}>
              {error}
            </Text>
            <TouchableOpacity
              onPress={fetchAll}
              style={{ marginTop: 16, backgroundColor: C.blue, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
            >
              <Text style={{ color: C.white, fontWeight: "800", fontSize: 14 }}>{t('home.retry')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Bus / Trips ── */}
        {!loadingData && !error && mode === "bus" && (
          <>
            {isFiltered ? (
              <Text style={{ fontWeight: "800", fontSize: 15, color: C.dark, marginBottom: 12 }}>
                {filteredTrips.length} {filteredTrips.length === 1 ? "trip" : "trips"}
                {from ? ` · ${from.city}` : ""}
                {to ? ` → ${to.city}` : ""}
              </Text>
            ) : (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontWeight: "900", fontSize: 16, color: C.dark }}>Available trips</Text>
                <Text style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>
                  Select stations above to filter by route
                </Text>
              </View>
            )}

            {filteredTrips.length === 0 && !loadingData && (
              <EmptyState
                icon="🚌"
                msg={isFiltered ? "No trips found for this route" : "No trips available right now"}
              />
            )}
            {filteredTrips.map(trip => (
              <TripCard key={trip.id} trip={trip} onPress={() => { setTripSheet(trip); setTripSheetDate(dateLabel); }} />
            ))}
          </>
        )}

        {/* ── Private ── */}
        {!loadingData && !error && mode === "private" && (
          <>
            <View style={{
              backgroundColor: C.orange, borderRadius: 12, padding: 12,
              flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 12,
            }}>
              <Text style={{ fontSize: 16 }}>⚠️</Text>
              <Text style={{ color: C.white, fontSize: 13, fontWeight: "700", flex: 1 }}>
                {t('home.upfrontFeeWarning')}
              </Text>
            </View>
            <Text style={{ fontWeight: "800", fontSize: 16, color: C.dark, marginBottom: 12 }}>
              {privateSeats.length} {t('home.privateCars')}
              {from?.city ? ` · ${from.city}` : ""}
              {to?.city ? ` → ${to.city}` : ` (${t('home.allRoutes')})`}
            </Text>
            {privateSeats.length === 0 && <EmptyState icon="💺" msg={t('home.noPrivateCarsRoute')} />}
            {privateSeats.map(p => (
              <PrivateCard key={p.id} item={p} onPress={() => setSheet({ type: "private", item: p, travelDate: dateLabel })} />
            ))}
          </>
        )}

        {/* ── Rental ── */}
        {!loadingData && !error && mode === "rental" && (
          <>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={{ fontWeight: "800", fontSize: 16, color: C.dark }}>
                {cars.length} {t('home.carsInCity')}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <TouchableOpacity
                  onPress={() => setRD(d => Math.max(1, d - 1))}
                  style={{ backgroundColor: C.green, borderRadius: 8, width: 28, height: 28, alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ color: C.white, fontWeight: "900", fontSize: 18 }}>−</Text>
                </TouchableOpacity>
                <Text style={{ fontWeight: "800", color: C.green, fontSize: 14 }}>{rentalDays}d</Text>
                <TouchableOpacity
                  onPress={() => setRD(d => d + 1)}
                  style={{ backgroundColor: C.green, borderRadius: 8, width: 28, height: 28, alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ color: C.white, fontWeight: "900", fontSize: 18 }}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            {cars.map(c => (
              <RentalCard
                key={c.id} car={c} days={rentalDays}
                onPress={() => setSheet({ type: "rental", item: c, days: rentalDays, travelDate: dateLabel })}
              />
            ))}
          </>
        )}
      </ScrollView>

      {sheet && (
        <BookingSheet data={sheet} onClose={() => setSheet(null)} onConfirm={() => setSheet(null)} />
      )}
      {tripSheet && (
        <TripBookingSheet
          trip={tripSheet}
          onClose={() => { setTripSheet(null); setTripSheetDate(""); }}
          onConfirm={() => { setTripSheet(null); setTripSheetDate(""); }}
          travelDate={tripSheetDate}
        />
      )}
    </SafeAreaView>
  );
}

function EmptyState({ icon, msg }: { icon: string; msg: string }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 40 }}>
      <Text style={{ fontSize: 40 }}>{icon}</Text>
      <Text style={{ color: C.muted, fontWeight: "700", fontSize: 14, marginTop: 8 }}>{msg}</Text>
    </View>
  );
}
