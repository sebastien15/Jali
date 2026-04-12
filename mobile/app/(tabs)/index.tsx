import { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
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

const TIME_FILTERS = [
  { id: "all" as const, label: "All times" },
  { id: "morning" as const, label: "Morning (5–12)" },
  { id: "afternoon" as const, label: "Afternoon (12–18)" },
  { id: "evening" as const, label: "Evening (18–24)" },
];

type StationObj = { id: number; city: string };

export default function HomeScreen() {
  const { t } = useTranslation();
  const [from, setFrom]         = useState<StationObj | null>(null);
  const [to, setTo]             = useState<StationObj | null>(null);
  const [date, setDate]         = useState("Today");
  const [mode, setMode]         = useState<Mode>("bus");
  const [rentalDays, setRD]     = useState(1);
  const [timeFilter, setTimeFilter] = useState<"all" | "morning" | "afternoon" | "evening">("all");
  const [sheet, setSheet]       = useState<any>(null);
  const [tripSheet, setTripSheet] = useState<TripResult | null>(null);

  const [trips, setTrips]       = useState<TripResult[]>([]);
  const [cars, setCars]         = useState<any[]>([]);
  const [privateSeats, setPrivate] = useState<any[]>([]);
  const [loadingData, setLoading]  = useState(false);
  const [error, setError]          = useState<string | null>(null);

  const fromStationId = from?.id ?? null;
  const toStationId   = to?.id ?? null;

  function fetchAll() {
    setLoading(true);
    setError(null);

    const tripParams: Record<string, any> = {};
    if (fromStationId) tripParams.from_station_id = fromStationId;
    if (toStationId)   tripParams.to_station_id   = toStationId;

    Promise.all([
      api.get("/trips", { params: tripParams }),
      api.get("/car-rentals"),
      api.get("/private-seats", { params: { from: from?.city, ...(to?.city ? { to: to.city } : {}), date } }),
    ])
      .then(([tripsRes, carRes, privateRes]) => {
        setTrips(tripsRes.data ?? []);
        setCars(carRes.data ?? []);
        setPrivate(privateRes.data ?? []);
      })
      .catch((err) => {
        const msg = err?.response?.data?.message ?? err?.response?.data?.error ?? "Failed to load data. Check your connection.";
        setError(msg);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchAll(); }, [from, to, date]);

  // Filter trips by time
  const filteredTrips = trips.filter((trip) => {
    if (timeFilter === "all") return true;
    const hour = parseInt(trip.departure_time.split(":")[0], 10);
    if (timeFilter === "morning")   return hour >= 5  && hour < 12;
    if (timeFilter === "afternoon") return hour >= 12 && hour < 18;
    if (timeFilter === "evening")   return hour >= 18 && hour < 24;
    return true;
  });

  const isFiltered = !!from || !!to;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.blue} />

      {/* ── Blue header ── */}
      <View style={{ backgroundColor: C.blue, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 0 }}>
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
          <StationPicker
            value={to}
            onChange={setTo as any}
            placeholder={t('home.toAny')}
            exclude={from}
          />
        </View>

        {/* Date chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 0 }}>
          <View style={{ flexDirection: "row", gap: 8, paddingBottom: 16 }}>
            {[t('home.dateToday'), t('home.dateTomorrow'), "Apr 7", "Apr 8", "Apr 9"].map(d => (
              <TouchableOpacity
                key={d}
                onPress={() => setDate(d)}
                style={{
                  backgroundColor: date === d ? C.yellow : "rgba(255,255,255,0.15)",
                  borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8,
                }}
              >
                <Text style={{ color: date === d ? C.dark : C.white, fontWeight: "800", fontSize: 13 }}>
                  {d}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

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

      {/* ── Time filter (bus/trips only) ── */}
      {mode === "bus" && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
            {TIME_FILTERS.map(tf => (
              <TouchableOpacity
                key={tf.id}
                onPress={() => setTimeFilter(tf.id)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8,
                  backgroundColor: timeFilter === tf.id ? C.blue : C.bg,
                }}
              >
                <Text style={{
                  color: timeFilter === tf.id ? C.white : C.dark,
                  fontWeight: "700", fontSize: 12,
                }}>
                  {tf.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {/* ── Listings ── */}
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {loadingData && (
          <ActivityIndicator color={C.blue} style={{ marginTop: 32 }} />
        )}

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

        {/* ── Bus = Trips ── */}
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
                <Text style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>Select stations above to filter by route</Text>
              </View>
            )}

            {filteredTrips.length === 0 && (
              <EmptyState icon="🚌" msg={isFiltered ? "No trips found for this route" : "No trips available right now"} />
            )}

            {filteredTrips.map(trip => (
              <TripCard
                key={trip.id}
                trip={trip}
                onPress={() => setTripSheet(trip)}
              />
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
              {privateSeats.length} {t('home.privateCars')} · {from?.city ?? ""}{to?.city ? ` → ${to.city}` : ` (${t('home.allRoutes')})`}
            </Text>
            {privateSeats.length === 0 && <EmptyState icon="💺" msg={t('home.noPrivateCarsRoute')} />}
            {privateSeats.map(p => (
              <PrivateCard key={p.id} item={p} onPress={() => setSheet({ type: "private", item: p, travelDate: date })} />
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
                onPress={() => setSheet({ type: "rental", item: c, days: rentalDays, travelDate: date })}
              />
            ))}
          </>
        )}
      </ScrollView>

      {/* Booking sheet for private/rental */}
      {sheet && (
        <BookingSheet
          data={sheet}
          onClose={() => setSheet(null)}
          onConfirm={() => setSheet(null)}
        />
      )}

      {/* Trip booking sheet */}
      {tripSheet && (
        <TripBookingSheet
          trip={tripSheet}
          onClose={() => setTripSheet(null)}
          onConfirm={() => setTripSheet(null)}
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
