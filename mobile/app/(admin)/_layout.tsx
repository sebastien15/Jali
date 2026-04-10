import { View } from "react-native";
import { Stack } from "expo-router";
import { AdminNavProvider } from "@/components/admin/AdminNavContext";
import { AdminNavSheet } from "@/components/admin/AdminNavSheet";

export default function AdminLayout() {
  return (
    <AdminNavProvider>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }} />
        <AdminNavSheet />
      </View>
    </AdminNavProvider>
  );
}
