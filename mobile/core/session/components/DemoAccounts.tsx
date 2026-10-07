import { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { isAdminRole } from "@/constants/roles";
import { startSession } from "@/core/session/teardown";

type Demo = { stage: string; enabled: boolean; accounts: { key: string; name: string; role: string; description: string }[] };

const ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  customer: "person-outline", driver: "car-sport-outline", agent: "briefcase-outline", superadmin: "shield-checkmark-outline",
};

/**
 * One-tap demo accounts on the login screen. The server lists them only when
 * its stage is dev (JALI_ENV=dev); in test and prod this renders nothing.
 */
export function DemoAccounts() {
  const [busy, setBusy] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ["auth", "demoAccounts"],
    queryFn: () => api.get<Demo>("/auth/demo-accounts").then(r => r.data),
    staleTime: 5 * 60_000,
    retry: false,
  });
  if (!data?.enabled || !data.accounts.length) return null;

  async function login(key: string) {
    setBusy(key);
    try {
      const res = await api.post<{ token: string; user: { roles: string } }>("/auth/demo-login", { key });
      await startSession(res.data.token);
      router.replace((isAdminRole(res.data.user.roles) ? "/(admin)/dashboard" : "/(tabs)") as any);
    } catch (err: any) {
      Alert.alert("Demo login", err?.response?.data?.message ?? "Could not sign in.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={{ marginTop: 24, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 16, gap: 8 }}>
      <Text style={{ fontWeight: "800", color: C.mid, fontSize: 12, textTransform: "uppercase" }}>
        Demo accounts · {data.stage}
      </Text>
      {data.accounts.map(a => (
        <TouchableOpacity key={a.key} onPress={() => login(a.key)} disabled={!!busy} accessibilityLabel={`Sign in as ${a.name}`}
          style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.bg, borderRadius: 12, padding: 12 }}>
          <Ionicons name={ICON[a.key] ?? "person-outline"} size={22} color={C.teal} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "800", color: C.dark }}>{a.name}</Text>
            <Text style={{ color: C.mid, fontSize: 12 }}>{a.description}</Text>
          </View>
          {busy === a.key ? <ActivityIndicator color={C.teal} /> : <Ionicons name="log-in-outline" size={20} color={C.muted} />}
        </TouchableOpacity>
      ))}
    </View>
  );
}
