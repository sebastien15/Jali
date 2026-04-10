import { View } from "react-native";
import { Stack } from "expo-router";
import { AdminSidebarProvider } from "@/components/admin/AdminSidebarContext";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default function AdminLayout() {
  return (
    <AdminSidebarProvider>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }} />
        <AdminSidebar />
      </View>
    </AdminSidebarProvider>
  );
}
