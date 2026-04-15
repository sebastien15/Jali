import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { ROLES } from "@/constants/roles";
import AdminHeader from "@/components/admin/AdminHeader";
import { queryKeys } from "@/lib/queryKeys";

const ALL_ROLES = [
  ROLES.USER,
  ROLES.DRIVER,
  ROLES.ADMIN,
  ROLES.SUPERADMIN,
] as const;
type Role = (typeof ALL_ROLES)[number];

const ROLE_COLOR: Record<Role, string> = {
  [ROLES.SUPERADMIN]: "#7C3AED",
  [ROLES.ADMIN]: C.teal,
  [ROLES.DRIVER]: C.blue,
  [ROLES.USER]: C.mid,
};

export default function AdminUserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [roles, setRoles] = useState<Role[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: user, isLoading } = useQuery({
    queryKey: queryKeys.admin.user(id!),
    queryFn: () =>
      // Use cached list if available, otherwise fetch list and find
      api.get("/admin/users").then(r => {
        const found = (r.data as any[]).find(u => String(u.id) === id);
        return found ?? null;
      }),
    staleTime: 60_000,
    // Try to seed from the already-cached users list
    initialData: () => {
      const cached = queryClient.getQueryData<any[]>(queryKeys.admin.users());
      return cached?.find(u => String(u.id) === id) ?? undefined;
    },
  });

  // Sync roles from fetched user
  useEffect(() => {
    if (user) setRoles(user.roles ?? []);
  }, [user]);

  function toggleRole(role: Role) {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch(`/admin/users/${id}`, { roles });
      Alert.alert("Saved", "Roles updated.");
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() });
    } catch {
      Alert.alert("Error", "Could not save roles.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: C.bg,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator color={C.teal} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />

      <AdminHeader title="Edit User" showBack />

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* User info */}
        <View
          style={{
            backgroundColor: C.white,
            borderRadius: 20,
            padding: 16,
            marginBottom: 16,
            shadowColor: "#000",
            shadowOpacity: 0.07,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 2 },
            elevation: 3,
          }}
        >
          <Text style={{ color: C.dark, fontWeight: "800", fontSize: 16 }}>
            {user?.name}
          </Text>
          <Text style={{ color: C.mid, fontSize: 13, marginTop: 4 }}>
            {user?.email}
          </Text>
          {user?.phone && (
            <Text style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>
              {user?.phone}
            </Text>
          )}
        </View>

        {/* Role picker */}
        <Text
          style={{
            color: C.muted,
            fontWeight: "700",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            marginBottom: 10,
          }}
        >
          Roles
        </Text>
        <View
          style={{
            backgroundColor: C.white,
            borderRadius: 20,
            padding: 16,
            marginBottom: 16,
            shadowColor: "#000",
            shadowOpacity: 0.07,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 2 },
            elevation: 3,
          }}
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {ALL_ROLES.map((role) => {
              const active = roles.includes(role);
              const color = ROLE_COLOR[role];
              return (
                <TouchableOpacity
                  key={role}
                  onPress={() => toggleRole(role)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: active ? color : C.bg,
                    borderWidth: 1.5,
                    borderColor: active ? color : C.border,
                  }}
                >
                  <Text
                    style={{
                      color: active ? C.white : C.mid,
                      fontWeight: "700",
                      fontSize: 13,
                    }}
                  >
                    {active ? "✓ " : ""}
                    {role}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={{
            backgroundColor: C.teal,
            borderRadius: 16,
            paddingVertical: 18,
            alignItems: "center",
            marginBottom: 32,
          }}
        >
          {saving ? (
            <ActivityIndicator color={C.white} />
          ) : (
            <Text style={{ color: C.white, fontWeight: "900", fontSize: 17 }}>
              Save Roles
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
