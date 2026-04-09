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
import { CITIES } from "@/constants/data";
import { BusCard } from "@/components/BusCard";
import { PrivateCard } from "@/components/PrivateCard";
import { RentalCard } from "@/components/RentalCard";
import { BookingSheet } from "@/components/BookingSheet";
import { CityPicker } from "@/components/CityPicker";
import api from "@/lib/api";

type Mode = "bus" | "private" | "rental";

const DATE_OPTS = ["Today", "Tomorrow", "Apr 7", "Apr 8", "Apr 9"];

export default function HomeScreen() {
  const { t } = useTranslation();
  const [from, setFrom]         = useState("Kigali");
  const [to, setTo]             = useState("");
  const [date, setDate]         = useState("Today");
  const [mode, setMode]         = useState<Mode>("bus");
  const [rentalDays, setRD]     = useState(1);
  const [sheet, setSheet]       = useState<any>(null);

  const [buses, setBuses]         = useState<any[]>([]);
  const [cars, setCars]           = useState<any[]>([]);
  const [privateSeats, setPrivate]= useState<any[]>([]);
  const [loadingData, setLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get("/buses", { params: { from, ...(to ? { to } : {}), date } }),
      api.get("/car-rentals"),
      api.get("/private-seats", { params: { from, ...(to ? { to } : {}), date } }),
    ])
      .then(([busRes, carRes, privateRes]) => {
        setBuses(busRes.data);
        setCars(carRes.data);
        setPrivate(privateRes.data);
      })
      .catch((err) => {
        const msg = err?.response?.data?.message ?? err?.response?.data?.error ?? "Failed to load data. Check your connection.";
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [from, to, date]);

  const filteredBuses   = buses;
  const filteredPrivate = privateSeats;

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
          <CityPicker value={from} onChange={setFrom} cities={CITIES} placeholder="From" />
          <TouchableOpacity
            onPress={() => { const t = from; setFrom(to || "Kigali"); setTo(t); }}
            style={{
              backgroundColor: C.yellow, borderRadius: 10, width: 34, height: 34,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 16 }}>⇄</Text>
          </TouchableOpacity>
          <CityPicker
            value={to}
            onChange={setTo}
            cities={CITIES.filter(c => c !== from)}
            placeholder={t('home.toAny')}
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
              onPress={() => {
                setLoading(true);
                setError(null);
                Promise.all([
                  api.get("/buses", { params: { from, ...(to ? { to } : {}), date } }),
                  api.get("/car-rentals"),
                  api.get("/private-seats", { params: { from, ...(to ? { to } : {}), date } }),
                ])
                  .then(([busRes, carRes, privateRes]) => {
                    setBuses(busRes.data);
                    setCars(carRes.data);
                    setPrivate(privateRes.data);
                  })
                  .catch((err) => {
                    const msg = err?.response?.data?.message ?? err?.response?.data?.error ?? "Failed to load data. Check your connection.";
                    setError(msg);
                    setBuses([]);
                    setCars([]);
                    setPrivate([]);
                  })
                  .finally(() => setLoading(false));
              }}
              style={{
                marginTop: 16, backgroundColor: C.blue, borderRadius: 12,
                paddingHorizontal: 24, paddingVertical: 12,
              }}
            >
              <Text style={{ color: C.white, fontWeight: "800", fontSize: 14 }}>{t('home.retry')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loadingData && mode === "bus" && (
          <>
            <Text style={{ fontWeight: "800", fontSize: 16, color: C.dark, marginBottom: 12 }}>
              {filteredBuses.length} {t('home.buses')} · {from}{to ? ` → ${to}` : ` (${t('home.allRoutes')})`}
            </Text>
            {filteredBuses.length === 0 && <EmptyState icon="🚌" msg={t('home.noBusesRoute')} />}
            {filteredBuses.map(b => (
              <BusCard key={b.id} bus={b} onPress={() => setSheet({ type: "bus", item: b, travelDate: date })} />
            ))}
          </>
        )}

        {!loadingData && mode === "private" && (
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
              {filteredPrivate.length} {t('home.privateCars')} · {from}{to ? ` → ${to}` : ` (${t('home.allRoutes')})`}
            </Text>
            {filteredPrivate.length === 0 && <EmptyState icon="💺" msg={t('home.noPrivateCarsRoute')} />}
            {filteredPrivate.map(p => (
              <PrivateCard key={p.id} item={p} onPress={() => setSheet({ type: "private", item: p, travelDate: date })} />
            ))}
          </>
        )}

        {!loadingData && mode === "rental" && (
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

      {/* Booking sheet */}
      {sheet && (
        <BookingSheet
          data={sheet}
          onClose={() => setSheet(null)}
          onConfirm={() => setSheet(null)}
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
