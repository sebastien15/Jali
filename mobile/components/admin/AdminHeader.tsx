import { View, Text, TouchableOpacity, StatusBar } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { C } from "@/constants/theme";
import { useAdminSidebar } from "./AdminSidebarContext";

type Props = {
  title: string;
  showBack?: boolean;
  right?: React.ReactNode;
};

export function AdminHeader({ title, showBack = false, right }: Props) {
  const { open } = useAdminSidebar();

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />
      <View
        style={{
          backgroundColor: C.teal,
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 20,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {showBack ? (
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color={C.white} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={open}>
              <Ionicons name="menu" size={24} color={C.white} />
            </TouchableOpacity>
          )}
          <Text style={{ color: C.white, fontWeight: "900", fontSize: 22 }}>
            {title}
          </Text>
        </View>
        {right}
      </View>
    </>
  );
}

export default AdminHeader;
