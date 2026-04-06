import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StatusBar,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "@/constants/theme";
import { useMocks } from "@/lib/env";
import {
  MOCK_DRIVER_STATS, MOCK_DRIVER_TRIPS,
  DriverStats, DriverTrip,
} from "@/constants/data";
import api from "@/lib/api";

const ZONES = ["Kigali CBD", "Nyabugogo", "Remera", "Kimironko", "Gikondo", "Kicukiro", "Kanombe"];

export default function DriveScreen() {
  const [online, setOnline]           = useState(false);
  const [activeZones, setActiveZones] = useState<number[]>([0, 1]);
  const [tab, setTab]                 = useState<"upcoming" | "history">("upcoming");
  const [stats, setStats]             = useState<DriverStats | null>(null);
  const [trips, setTrips]             = useState<DriverTrip[]>([]);
  const [loading, setLoading]         = useState(false);
  const [refreshing, setRefreshing]   = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      if (useMocks) {
        // Simulate slight delay in dev so loading state is visible
        await new Promise(r => setTimeout(r, 400));
        setStats(MOCK_DRIVER_STATS);
        setTrips(MOCK_DRIVER_TRIPS);
      } else {
        const [statsRes, tripsRes] = await Promise.all([
          api.get("/driver/stats"),
          api.get("/driver/trips"),
        ]);
        setStats(statsRes.data);
        setTrips(tripsRes.data);
      }
    } catch {
      if (useMocks) {
        setStats(MOCK_DRIVER_STATS);
        setTrips(MOCK_DRIVER_TRIPS);
      }
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleZone(i: number) {
    setActiveZones(z => z.includes(i) ? z.filter(x => x !== i) : [...z, i]);
  }

  const upcoming  = trips.filter(t => t.status === "upcoming");
  const history   = trips.filter(t => t.status !== "upcoming");
  const shown     = tab === "upcoming" ? upcoming : history;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />

      {/* Header */}
      <View style={{ backgroundColor: C.teal, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <View>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "600" }}>Driver Mode</Text>
            <Text style={{ color: C.white, fontWeight: "900", fontSize: 24 }}>Dashboard</Text>
          </View>
          <TouchableOpacity
            onPress={() => setOnline(o => !o)}
            style={{
              backgroundColor: online ? C.green : "rgba(255,255,255,0.2)",
              borderRadius: 14, paddingHorizontal: 18, paddingVertical: 10,
            }}
          >
            <Text style={{ color: C.white, fontWeight: "800", fontSize: 14 }}>
              {online ? "🟢 Online" : "⚫ Offline"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        {loading && !stats ? (
          <ActivityIndicator color={C.yellow} />
        ) : (
          <View style={{ flexDirection: "row", gap: 10 }}>
            {[
              { v: stats ? `${stats.todayEarnings.toLocaleString()}`, l: "Today RWF" },
              { v: `${stats?.todayTrips ?? 0}`,                       l: "Trips today" },
              { v: `${stats?.rating ?? "—"}`,                         l: "Rating ⭐" },
            ].map((e, i) => (
              <View key={i} style={{
                flex: 1, backgroundColor: "rgba(255,255,255,0.15)",
                borderRadius: 14, padding: 12, alignItems: "center",
              }}>
                <Text style={{ color: C.yellow, fontWeight: "900", fontSize: 17 }}>{e.v}</Text>
                <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "600" }}>{e.l}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.teal} />}
      >
        {/* Week summary card */}
        {stats && (
          <View style={{
            backgroundColor: C.tealLt, borderRadius: 16, padding: 16,
            flexDirection: "row", justifyContent: "space-between", marginBottom: 20,
          }}>
            <View>
              <Text style={{ color: C.mid, fontSize: 12, fontWeight: "600" }}>This week</Text>
              <Text style={{ color: C.dark, fontWeight: "900", fontSize: 20 }}>
                {stats.weekEarnings.toLocaleString()} RWF
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ color: C.mid, fontSize: 12, fontWeight: "600" }}>Trips</Text>
              <Text style={{ color: C.teal, fontWeight: "900", fontSize: 20 }}>{stats.weekTrips}</Text>
            </View>
          </View>
        )}

        {/* Pickup zones */}
        <Text style={{ fontWeight: "800", fontSize: 15, color: C.dark, marginBottom: 10 }}>
          My Pickup Zones
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
          {ZONES.map((z, i) => {
            const active = activeZones.includes(i);
            return (
              <TouchableOpacity
                key={i}
                onPress={() => toggleZone(i)}
                style={{
                  backgroundColor: active ? C.teal : C.bg,
                  borderWidth: active ? 0 : 2, borderColor: C.border,
                  borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8,
                }}
              >
                <Text style={{ color: active ? C.white : C.mid, fontWeight: "700", fontSize: 13 }}>
                  {active ? "✓ " : ""}{z}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Trips tabs */}
        <View style={{ flexDirection: "row", backgroundColor: C.white, borderRadius: 14, padding: 4, marginBottom: 14 }}>
          {(["upcoming", "history"] as const).map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center",
                backgroundColor: tab === t ? C.teal : "transparent",
              }}
            >
              <Text style={{
                fontWeight: "800", fontSize: 13, textTransform: "capitalize",
                color: tab === t ? C.white : C.mid,
              }}>
                {t === "upcoming" ? `Upcoming (${upcoming.length})` : `History (${history.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {shown.length === 0 && (
          <View style={{ alignItems: "center", paddingVertical: 32 }}>
            <Text style={{ fontSize: 36 }}>{tab === "upcoming" ? "🛣️" : "📋"}</Text>
            <Text style={{ color: C.muted, fontWeight: "700", fontSize: 14, marginTop: 8 }}>
              {tab === "upcoming" ? "No upcoming rides" : "No trip history yet"}
            </Text>
          </View>
        )}

        {shown.map(r => (
          <TripRow key={r.id} trip={r} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function TripRow({ trip }: { trip: DriverTrip }) {
  const isUpcoming = trip.status === "upcoming";
  return (
    <View style={{
      backgroundColor: C.white, borderRadius: 16, padding: 14,
      marginBottom: 10, flexDirection: "row", justifyContent: "space-between",
      alignItems: "center", shadowColor: "#000", shadowOpacity: 0.05,
      shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
      borderLeftWidth: 4,
      borderLeftColor: isUpcoming ? C.teal : trip.status === "cancelled" ? C.orange : C.muted,
    }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "800", fontSize: 14, color: C.dark }}>
          {trip.from} → {trip.to}
        </Text>
        <Text style={{ color: C.mid, fontSize: 12, marginTop: 2 }}>
          {trip.date} · {trip.dep} · {trip.pax} pax
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ color: C.teal, fontWeight: "900", fontSize: 15 }}>
          {trip.earning.toLocaleString()} RWF
        </Text>
        {isUpcoming && (
          <View style={{ backgroundColor: C.tealLt, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 }}>
            <Text style={{ color: C.teal, fontSize: 11, fontWeight: "700" }}>Upcoming</Text>
          </View>
        )}
      </View>
    </View>
  );
}
