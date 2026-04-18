import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import AdminHeader from "@/components/admin/AdminHeader";
import { queryKeys } from "@/lib/queryKeys";

type Permission = {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
};

type Role = {
  id: number;
  name: string;
  description: string | null;
  is_system: boolean;
};

const CATEGORIES = ["All", "Bookings", "Agencies", "Locations", "Analytics", "Buses", "Users", "Admins", "Driver"];

export default function RoleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const roleId = Number(id);
  const queryClient = useQueryClient();

  const [selectedCategory, setSelectedCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [assignedIds, setAssignedIds] = useState<Set<number> | null>(null);
  const [editSheet, setEditSheet] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Fetch role detail from the list cache
  const rolesData = queryClient.getQueryData<Role[]>(queryKeys.admin.roles());
  const cachedRole = rolesData?.find(r => r.id === roleId);

  // Fetch all permissions
  const { data: allPermissions = [], isLoading: loadingPerms } = useQuery<Permission[]>({
    queryKey: queryKeys.admin.permissions(),
    queryFn: () => api.get("/admin/permissions").then(r => r.data),
    staleTime: 5 * 60_000,
  });

  // Fetch role's assigned permissions
  const { data: rolePermissions, isLoading: loadingRolePerms } = useQuery<Permission[]>({
    queryKey: queryKeys.admin.role(roleId),
    queryFn: () => api.get(`/admin/roles/${roleId}/permissions`).then(r => r.data),
    staleTime: 0,
  });

  useEffect(() => {
    if (rolePermissions && assignedIds === null) {
      setAssignedIds(new Set(rolePermissions.map(p => p.id)));
    }
  }, [rolePermissions]);

  const isSuperAdmin = cachedRole?.name === "superadmin";
  const isLoading = loadingPerms || loadingRolePerms;

  const currentAssigned = assignedIds ?? new Set<number>((rolePermissions ?? []).map(p => p.id));

  const permissionsMap = useMemo(() => {
    const map = new Map<number, Permission>();
    allPermissions.forEach(p => map.set(p.id, p));
    return map;
  }, [allPermissions]);

  const assignedList = useMemo(
    () => allPermissions.filter(p => currentAssigned.has(p.id)),
    [allPermissions, currentAssigned]
  );

  const availableFiltered = useMemo(() => {
    return allPermissions.filter(p => {
      if (currentAssigned.has(p.id)) return false;
      if (selectedCategory !== "All" && p.category !== selectedCategory) return false;
      if (search.trim() && !p.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [allPermissions, currentAssigned, selectedCategory, search]);

  function assignPermission(p: Permission) {
    if (isSuperAdmin) return;
    setAssignedIds(prev => {
      const next = new Set(prev ?? currentAssigned);
      next.add(p.id);
      return next;
    });
  }

  function unassignPermission(p: Permission) {
    if (isSuperAdmin) return;
    setAssignedIds(prev => {
      const next = new Set(prev ?? currentAssigned);
      next.delete(p.id);
      return next;
    });
  }

  const saveMutation = useMutation({
    mutationFn: (ids: number[]) =>
      api.put(`/admin/roles/${roleId}/permissions`, { permission_ids: ids }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.role(roleId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.roles() });
      Alert.alert("Saved", "Permissions updated successfully.");
    },
    onError: (err: any) => {
      Alert.alert("Error", err?.response?.data?.message ?? "Failed to save permissions.");
    },
  });

  const editMutation = useMutation({
    mutationFn: (body: { name: string; description: string }) =>
      api.patch(`/admin/roles/${roleId}`, body).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.roles() });
      setEditSheet(false);
    },
    onError: (err: any) => {
      Alert.alert("Error", err?.response?.data?.message ?? "Failed to update role.");
    },
  });

  function openEditSheet() {
    setEditName(cachedRole?.name ?? "");
    setEditDesc(cachedRole?.description ?? "");
    setEditSheet(true);
  }

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }} edges={["top", "left", "right"]}>
        <ActivityIndicator size="large" color={C.teal} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top", "left", "right"]}>
      <AdminHeader title={cachedRole?.name ?? "Role"} />

      <View style={{ flex: 1, padding: 12, gap: 12 }}>
        {/* Role info header */}
        <View style={{
          backgroundColor: C.white, borderRadius: 16, padding: 16,
          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.dark, fontWeight: "800", fontSize: 17 }}>{cachedRole?.name}</Text>
            {cachedRole?.description ? (
              <Text style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>{cachedRole.description}</Text>
            ) : null}
          </View>
          {!isSuperAdmin && (
            <TouchableOpacity onPress={openEditSheet} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="pencil-outline" size={20} color={C.teal} />
            </TouchableOpacity>
          )}
        </View>

        {isSuperAdmin && (
          <View style={{ backgroundColor: C.teal + "15", borderRadius: 12, padding: 12 }}>
            <Text style={{ color: C.teal, fontWeight: "700", fontSize: 13, textAlign: "center" }}>
              Superadmin always has all permissions — read only
            </Text>
          </View>
        )}

        {/* Dual panel */}
        <View style={{ flex: 1, flexDirection: "row", gap: 10 }}>
          {/* Left — Available */}
          <View style={{ flex: 1, backgroundColor: C.white, borderRadius: 16, overflow: "hidden" }}>
            <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: C.border ?? "#f0f0f0" }}>
              <Text style={{ fontWeight: "800", fontSize: 13, color: C.dark, marginBottom: 8 }}>Available</Text>

              {/* Search */}
              <View style={{
                flexDirection: "row", alignItems: "center",
                borderWidth: 1, borderColor: C.border ?? "#e5e7eb", borderRadius: 10,
                paddingHorizontal: 10, marginBottom: 8,
              }}>
                <Ionicons name="search-outline" size={14} color={C.muted} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search..."
                  placeholderTextColor={C.muted}
                  style={{ flex: 1, paddingVertical: 7, paddingLeft: 6, fontSize: 13, color: C.dark }}
                />
              </View>

              {/* Category chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -2 }}>
                <View style={{ flexDirection: "row", gap: 4, paddingHorizontal: 2 }}>
                  {CATEGORIES.map(cat => (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setSelectedCategory(cat)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 20,
                        backgroundColor: selectedCategory === cat ? C.teal : C.bg,
                      }}
                    >
                      <Text style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: selectedCategory === cat ? C.white : C.muted,
                      }}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <FlatList
              data={availableFiltered}
              keyExtractor={item => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => assignPermission(item)}
                  style={{
                    padding: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: C.border ?? "#f5f5f5",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.dark, fontWeight: "600", fontSize: 12 }}>{item.name}</Text>
                    {item.category ? (
                      <Text style={{ color: C.muted, fontSize: 10 }}>{item.category}</Text>
                    ) : null}
                  </View>
                  {!isSuperAdmin && (
                    <Ionicons name="arrow-forward-outline" size={14} color={C.teal} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ alignItems: "center", paddingTop: 30 }}>
                  <Text style={{ color: C.muted, fontSize: 12 }}>No permissions</Text>
                </View>
              }
            />
          </View>

          {/* Right — Assigned */}
          <View style={{ flex: 1, backgroundColor: C.white, borderRadius: 16, overflow: "hidden" }}>
            <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: C.border ?? "#f0f0f0" }}>
              <Text style={{ fontWeight: "800", fontSize: 13, color: C.dark }}>Assigned</Text>
              <Text style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{currentAssigned.size} selected</Text>
            </View>

            <FlatList
              data={assignedList}
              keyExtractor={item => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => unassignPermission(item)}
                  style={{
                    padding: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: C.border ?? "#f5f5f5",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    backgroundColor: isSuperAdmin ? C.teal + "08" : undefined,
                  }}
                >
                  {!isSuperAdmin && (
                    <Ionicons name="arrow-back-outline" size={14} color={C.orange} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.dark, fontWeight: "600", fontSize: 12 }}>{item.name}</Text>
                    {item.category ? (
                      <Text style={{ color: C.muted, fontSize: 10 }}>{item.category}</Text>
                    ) : null}
                  </View>
                  {isSuperAdmin && (
                    <Ionicons name="lock-closed" size={12} color={C.teal} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ alignItems: "center", paddingTop: 30 }}>
                  <Text style={{ color: C.muted, fontSize: 12 }}>None assigned</Text>
                </View>
              }
            />
          </View>
        </View>

        {/* Save button */}
        {!isSuperAdmin && (
          <TouchableOpacity
            onPress={() => saveMutation.mutate(Array.from(currentAssigned))}
            disabled={saveMutation.isPending}
            style={{
              backgroundColor: C.teal,
              borderRadius: 14,
              padding: 16,
              alignItems: "center",
            }}
          >
            {saveMutation.isPending ? (
              <ActivityIndicator color={C.white} />
            ) : (
              <Text style={{ color: C.white, fontWeight: "800", fontSize: 15 }}>Save Permissions</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Edit role sheet */}
      <Modal visible={editSheet} transparent animationType="slide" onRequestClose={() => setEditSheet(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setEditSheet(false)} />
          <View style={{ backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 14 }}>
            <Text style={{ fontWeight: "800", fontSize: 18, color: C.dark }}>Edit Role</Text>
            <TextInput
              placeholder="Role name"
              value={editName}
              onChangeText={setEditName}
              autoCapitalize="none"
              placeholderTextColor={C.muted}
              style={{
                borderWidth: 1, borderColor: C.border ?? "#e5e7eb",
                borderRadius: 12, padding: 14, fontSize: 15, color: C.dark,
              }}
            />
            <TextInput
              placeholder="Description (optional)"
              value={editDesc}
              onChangeText={setEditDesc}
              placeholderTextColor={C.muted}
              style={{
                borderWidth: 1, borderColor: C.border ?? "#e5e7eb",
                borderRadius: 12, padding: 14, fontSize: 15, color: C.dark,
              }}
            />
            <TouchableOpacity
              onPress={() => editMutation.mutate({ name: editName.trim(), description: editDesc.trim() })}
              disabled={!editName.trim() || editMutation.isPending}
              style={{
                backgroundColor: editName.trim() ? C.teal : C.muted,
                borderRadius: 12, padding: 16, alignItems: "center",
              }}
            >
              {editMutation.isPending ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <Text style={{ color: C.white, fontWeight: "700", fontSize: 15 }}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
