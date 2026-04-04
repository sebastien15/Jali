import { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "@/constants/theme";

const ZONES = ["Kigali CBD", "Nyabugogo", "Remera", "Kimironko", "Gikondo", "Kicukiro", "Kanombe"];

const UPCOMING = [
  { from: "Nyabugogo", to: "Musanze", time: "06:30", pax: 2, fee: 16000 },
  { from: "Remera",    to: "Huye",    time: "07:00", pax: 3, fee: 22500 },
];

export default function DriveScreen() {
  const [online, setOnline]         = useState(true);
  const [activeZones, setActiveZones] = useState([0, 1, 3, 5]);

  function toggleZone(i: number) {
    setActiveZones(z => z.includes(i) ? z.filter(x => x !== i) : [...z, i]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />

      {/* Teal header */}
      <View style={{ backgroundColor: C.teal, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <View>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "600" }}>Driver Mode</Text>
            <Text style={{ color: C.white, fontWeight: "900", fontSize: 24 }}>Dashboard 🚗</Text>
          </View>
          <TouchableOpacity
            onPress={() => setOnline(o => !o)}
            style={{
              backgroundColor: online ? C.green : "rgba(255,255,255,0.2)",
              borderRadius: 14, paddingHorizontal: 18, paddingVertical: 10,
            }}
          >
            <Text style={{ color: C.white, fontWeight: "800", fontSize: 14 }}>
              {online ? "🟢 Online" : "🔴 Offline"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Earnings row */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          {[
            { v: "47,500", l: "Today RWF" },
            { v: "8",      l: "Trips" },
            { v: "4.92",   l: "Rating ⭐" },
          ].map((e, i) => (
            <View
              key={i}
              style={{
                flex: 1, backgroundColor: "rgba(255,255,255,0.15)",
                borderRadius: 14, padding: 12, alignItems: "center",
              }}
            >
              <Text style={{ color: C.yellow, fontWeight: "900", fontSize: 17 }}>{e.v}</Text>
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "600" }}>{e.l}</Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Pickup zones */}
        <Text style={{ fontWeight: "800", fontSize: 16, color: C.dark, marginBottom: 10 }}>
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

        {/* Upcoming rides */}
        <Text style={{ fontWeight: "800", fontSize: 16, color: C.dark, marginBottom: 10 }}>
          Upcoming Rides
        </Text>
        {UPCOMING.map((r, i) => (
          <View
            key={i}
            style={{
              backgroundColor: C.white, borderRadius: 16, padding: 14,
              marginBottom: 10, flexDirection: "row", justifyContent: "space-between",
              alignItems: "center", shadowColor: "#000", shadowOpacity: 0.06,
              shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
            }}
          >
            <View>
              <Text style={{ fontWeight: "700", fontSize: 14, color: C.dark }}>
                {r.from} → {r.to}
              </Text>
              <Text style={{ color: C.mid, fontSize: 12, marginTop: 2 }}>
                {r.time} · {r.pax} passenger{r.pax > 1 ? "s" : ""}
              </Text>
            </View>
            <Text style={{ color: C.teal, fontWeight: "900", fontSize: 15 }}>
              {r.fee.toLocaleString()} RWF
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
