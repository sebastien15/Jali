import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminNav } from "@/components/admin/AdminNavContext";
import { queryKeys } from "@/lib/queryKeys";

type Role = {
  id: number;
  name: string;
  description: string | null;
  permission_count: number;
  user_count: number;
  is_system: boolean;
};

export default function RolesScreen() {
  const { isSuperAdmin } = useAdminNav();
  const queryClient = useQueryClient();

  const [sheetVisible, setSheetVisible] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: roles = [], isLoading, isRefetching, refetch } = useQuery<Role[]>({
    queryKey: queryKeys.admin.roles(),
    queryFn: () => api.get("/admin/roles").then(r => r.data),
    enabled: isSuperAdmin,
  });

  const createMutation = useMutation({
    mutationFn: (body: { name: string; description: string }) =>
      api.post("/admin/roles", body).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.roles() });
      setSheetVisible(false);
      setName("");
      setDescription("");
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? "Failed to create role.";
      Alert.alert("Error", msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/roles/${id}`).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.roles() });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? "Failed to delete role.";
      Alert.alert("Error", msg);
    },
  });

  function handleDelete(role: Role) {
    Alert.alert(
      "Delete Role",
      `Delete "${role.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate(role.id) },
      ]
    );
  }

  if (!isSuperAdmin) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }} edges={["top", "left", "right"]}>
        <Ionicons name="lock-closed-outline" size={48} color={C.muted} />
        <Text style={{ color: C.muted, marginTop: 12, fontSize: 15 }}>Superadmin access only</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top", "left", "right"]}>
      <AdminHeader title="Roles" />

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={C.teal} />
        </View>
      ) : (
        <FlatList
          data={roles}
          keyExtractor={item => String(item.id)}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push(`/(admin)/roles/${item.id}` as any)}
              style={{
                backgroundColor: C.white,
                borderRadius: 16,
                padding: 16,
                shadowColor: "#000",
                shadowOpacity: 0.06,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
                elevation: 2,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <Text style={{ color: C.dark, fontWeight: "800", fontSize: 16 }}>{item.name}</Text>
                    {item.is_system && (
                      <View style={{ backgroundColor: C.teal + "20", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: C.teal, fontSize: 10, fontWeight: "700" }}>SYSTEM</Text>
                      </View>
                    )}
                  </View>
                  {item.description ? (
                    <Text style={{ color: C.muted, fontSize: 13 }}>{item.description}</Text>
                  ) : null}
                  <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                    <Badge label={`${item.permission_count} permissions`} color={C.purple} />
                    <Badge label={`${item.user_count} users`} color={C.blue} />
                  </View>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  {!item.is_system && (
                    <TouchableOpacity
                      onPress={() => handleDelete(item)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={18} color={C.orange} />
                    </TouchableOpacity>
                  )}
                  <Ionicons name="chevron-forward" size={18} color={C.muted} />
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 60 }}>
              <Ionicons name="shield-outline" size={48} color={C.muted} />
              <Text style={{ color: C.muted, marginTop: 12 }}>No roles found</Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        onPress={() => setSheetVisible(true)}
        style={{
          position: "absolute",
          bottom: 24,
          right: 24,
          backgroundColor: C.teal,
          width: 54,
          height: 54,
          borderRadius: 27,
          alignItems: "center",
          justifyContent: "center",
          elevation: 6,
          shadowColor: C.teal,
          shadowOpacity: 0.4,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        <Ionicons name="add" size={28} color={C.white} />
      </TouchableOpacity>

      {/* Create Role Sheet */}
      <Modal visible={sheetVisible} transparent animationType="slide" onRequestClose={() => setSheetVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setSheetVisible(false)} />
          <View style={{ backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 14 }}>
            <Text style={{ fontWeight: "800", fontSize: 18, color: C.dark }}>New Role</Text>

            <TextInput
              placeholder="Role name"
              value={name}
              onChangeText={setName}
              autoCapitalize="none"
              placeholderTextColor={C.muted}
              style={{
                borderWidth: 1,
                borderColor: C.border ?? "#e5e7eb",
                borderRadius: 12,
                padding: 14,
                fontSize: 15,
                color: C.dark,
              }}
            />
            <TextInput
              placeholder="Description (optional)"
              value={description}
              onChangeText={setDescription}
              placeholderTextColor={C.muted}
              style={{
                borderWidth: 1,
                borderColor: C.border ?? "#e5e7eb",
                borderRadius: 12,
                padding: 14,
                fontSize: 15,
                color: C.dark,
              }}
            />

            <TouchableOpacity
              onPress={() => createMutation.mutate({ name: name.trim(), description: description.trim() })}
              disabled={!name.trim() || createMutation.isPending}
              style={{
                backgroundColor: name.trim() ? C.teal : C.muted,
                borderRadius: 12,
                padding: 16,
                alignItems: "center",
              }}
            >
              {createMutation.isPending ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <Text style={{ color: C.white, fontWeight: "700", fontSize: 15 }}>Create Role</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ backgroundColor: color + "15", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ color, fontSize: 11, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}
