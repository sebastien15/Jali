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
import { useTranslation } from "react-i18next";
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
  [ROLES.SUPERADMIN]: C.purple,
  [ROLES.ADMIN]: C.teal,
  [ROLES.DRIVER]: C.blue,
  [ROLES.USER]: C.mid,
};

export default function AdminUserDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  // AdminUserController returns and accepts a single `role` name.
  const [role, setRole] = useState<Role | null>(null);
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

  // Sync role from fetched user
  useEffect(() => {
    if (user?.role) setRole(user.role as Role);
  }, [user]);

  const unchanged = !role || role === user?.role;

  async function handleSave() {
    if (unchanged) return;
    setSaving(true);
    try {
      const res = await api.patch(`/admin/users/${id}`, { role });
      queryClient.setQueryData(queryKeys.admin.user(id!), (prev: any) => ({ ...(prev ?? {}), ...res.data }));
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() });
      Alert.alert(t("adminUsers.saved"), t("adminUsers.roleUpdated", { role: res.data?.role ?? role }));
    } catch (e: any) {
      // 422: "You cannot change your own role." / "Cannot demote the last superadmin."
      Alert.alert(t("admin.error"), e?.response?.data?.message ?? t("adminUsers.saveRoleFailed"));
      if (user?.role) setRole(user.role as Role);
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

      <AdminHeader title={t("adminUsers.editUser")} showBack />

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
          {t("adminUsers.role")}
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
            {ALL_ROLES.map((r) => {
              const active = role === r;
              const color = ROLE_COLOR[r];
              return (
                <TouchableOpacity
                  key={r}
                  onPress={() => setRole(r)}
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
                    {active ? "● " : "○ "}
                    {r}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          onPress={handleSave}
          disabled={saving || unchanged}
          style={{
            backgroundColor: unchanged ? C.border : C.teal,
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
              {t("adminUsers.saveRole")}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
