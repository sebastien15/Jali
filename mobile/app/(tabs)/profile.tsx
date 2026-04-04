import {
  View, Text, ScrollView, TouchableOpacity, StatusBar, Alert, Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { C } from "@/constants/theme";
import { useDriverMode } from "@/lib/DriverModeContext";

type MenuItem = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  sub: string;
};

const MENU: MenuItem[] = [
  { icon: "card-outline",           label: "Payment Methods", sub: "MoMo, Airtel, Card" },
  { icon: "language-outline",       label: "Language",        sub: "Kinyarwanda / English" },
  { icon: "notifications-outline",  label: "Notifications",   sub: "Enabled" },
  { icon: "help-circle-outline",    label: "Help & Support",  sub: "Chat, Call" },
  { icon: "star-outline",           label: "Rate Jali",       sub: "Share your feedback" },
];

export default function ProfileScreen() {
  const { driverMode, setDriverMode } = useDriverMode();

  function handleDriverToggle(value: boolean) {
    setDriverMode(value);
    if (value) {
      router.push("/(tabs)/drive");
    }
  }

  async function handleLogout() {
    Alert.alert("Log out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => signOut(auth) },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.blue} />

      {/* Header */}
      <View style={{ backgroundColor: C.blue, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <View style={{
            backgroundColor: C.yellow, borderRadius: 50, width: 60, height: 60,
            alignItems: "center", justifyContent: "center",
          }}>
            <Ionicons name="person" size={28} color={C.dark} />
          </View>
          <View>
            <Text style={{ color: C.white, fontWeight: "900", fontSize: 22 }}>Jean Pierre</Text>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
              +250 78X XXX XXX · Kigali 🇷🇼
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          {[{ v: "12", l: "Trips" }, { v: "4.9", l: "Rating" }, { v: "0", l: "Pending" }].map((s, i) => (
            <View key={i} style={{
              flex: 1, backgroundColor: "rgba(255,255,255,0.15)",
              borderRadius: 12, paddingVertical: 10, alignItems: "center",
            }}>
              <Text style={{ color: C.yellow, fontWeight: "900", fontSize: 18 }}>{s.v}</Text>
              <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 12 }}>{s.l}</Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>

        {/* Driver Mode toggle */}
        <View style={{
          backgroundColor: driverMode ? C.tealLt : C.white,
          borderRadius: 16, padding: 16, marginBottom: 16,
          borderWidth: 2, borderColor: driverMode ? C.teal : C.border,
          flexDirection: "row", alignItems: "center", gap: 14,
        }}>
          <View style={{
            backgroundColor: driverMode ? C.teal : C.bg,
            borderRadius: 12, width: 44, height: 44,
            alignItems: "center", justifyContent: "center",
          }}>
            <Ionicons name="car" size={22} color={driverMode ? C.white : C.mid} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "800", fontSize: 15, color: driverMode ? C.teal : C.dark }}>
              Driver Mode
            </Text>
            <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
              {driverMode ? "You are live — accepting rides" : "Switch to drive and earn"}
            </Text>
          </View>
          <Switch
            value={driverMode}
            onValueChange={handleDriverToggle}
            trackColor={{ false: C.border, true: C.teal }}
            thumbColor={C.white}
          />
        </View>

        {/* Menu items */}
        {MENU.map((item, i) => (
          <TouchableOpacity
            key={i}
            style={{
              backgroundColor: C.white, borderRadius: 14, padding: 14,
              marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 14,
              shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4,
              shadowOffset: { width: 0, height: 1 }, elevation: 1,
            }}
          >
            <View style={{
              backgroundColor: C.bg, borderRadius: 10, width: 38, height: 38,
              alignItems: "center", justifyContent: "center",
            }}>
              <Ionicons name={item.icon} size={20} color={C.mid} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.dark, fontWeight: "700", fontSize: 14 }}>{item.label}</Text>
              <Text style={{ color: C.muted, fontSize: 12 }}>{item.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.muted} />
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          onPress={handleLogout}
          style={{
            backgroundColor: "rgba(220,38,38,0.08)", borderRadius: 14,
            paddingVertical: 16, alignItems: "center", marginTop: 8,
            flexDirection: "row", justifyContent: "center", gap: 8,
          }}
        >
          <Ionicons name="log-out-outline" size={18} color="#DC2626" />
          <Text style={{ color: "#DC2626", fontWeight: "800", fontSize: 15 }}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
