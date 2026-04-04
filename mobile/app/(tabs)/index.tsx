import { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "@/constants/theme";
import { CITIES, BUSES, CARS, PRIVATE } from "@/constants/data";
import { BusCard } from "@/components/BusCard";
import { PrivateCard } from "@/components/PrivateCard";
import { RentalCard } from "@/components/RentalCard";
import { BookingSheet } from "@/components/BookingSheet";
import { CityPicker } from "@/components/CityPicker";

type Mode = "bus" | "private" | "rental";

const DATE_OPTS = ["Today", "Tomorrow", "Apr 7", "Apr 8", "Apr 9"];

export default function HomeScreen() {
  const [from, setFrom]         = useState("Kigali");
  const [to, setTo]             = useState("");
  const [date, setDate]         = useState("Today");
  const [mode, setMode]         = useState<Mode>("bus");
  const [rentalDays, setRD]     = useState(1);
  const [sheet, setSheet]       = useState<any>(null);

  const buses   = BUSES.filter(b => b.from === from && (!to || b.to === to));
  const private_ = PRIVATE.filter(p => p.from === from && (!to || p.to === to));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.blue} />

      {/* ── Blue header ── */}
      <View style={{ backgroundColor: C.blue, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 0 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <View>
            <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: "600" }}>Muraho 👋</Text>
            <Text style={{ color: C.white, fontWeight: "900", fontSize: 22 }}>Where to?</Text>
          </View>
          <View style={{
            backgroundColor: C.yellow, borderRadius: 50, width: 42, height: 42,
            alignItems: "center", justifyContent: "center",
          }}>
            <Text style={{ fontSize: 18 }}>👤</Text>
          </View>
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
            placeholder="To (any)"
          />
        </View>

        {/* Date chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 0 }}>
          <View style={{ flexDirection: "row", gap: 8, paddingBottom: 16 }}>
            {DATE_OPTS.map(d => (
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
          { id: "bus",     icon: "🚌", label: "Bus"          },
          { id: "private", icon: "💺", label: "Private Seat" },
          { id: "rental",  icon: "🚗", label: "Car Rental"   },
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
        {mode === "bus" && (
          <>
            <Text style={{ fontWeight: "800", fontSize: 16, color: C.dark, marginBottom: 12 }}>
              {buses.length} buses · {from}{to ? ` → ${to}` : " (all routes)"}
            </Text>
            {buses.length === 0 && <EmptyState icon="🚌" msg="No buses for this route" />}
            {buses.map(b => (
              <BusCard key={b.id} bus={b} onPress={() => setSheet({ type: "bus", item: b })} />
            ))}
          </>
        )}

        {mode === "private" && (
          <>
            <View style={{
              backgroundColor: C.orange, borderRadius: 12, padding: 12,
              flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 12,
            }}>
              <Text style={{ fontSize: 16 }}>⚠️</Text>
              <Text style={{ color: C.white, fontSize: 13, fontWeight: "700", flex: 1 }}>
                Upfront fee — no refund if you're late
              </Text>
            </View>
            <Text style={{ fontWeight: "800", fontSize: 16, color: C.dark, marginBottom: 12 }}>
              {private_.length} private cars · {from}{to ? ` → ${to}` : " (all routes)"}
            </Text>
            {private_.length === 0 && <EmptyState icon="💺" msg="No private cars for this route" />}
            {private_.map(p => (
              <PrivateCard key={p.id} item={p} onPress={() => setSheet({ type: "private", item: p })} />
            ))}
          </>
        )}

        {mode === "rental" && (
          <>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={{ fontWeight: "800", fontSize: 16, color: C.dark }}>
                {CARS.length} cars in Kigali
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
            {CARS.map(c => (
              <RentalCard
                key={c.id} car={c} days={rentalDays}
                onPress={() => setSheet({ type: "rental", item: c, days: rentalDays })}
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
