import { View, Text, StatusBar, Image, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { C } from "@/constants/theme";
import { useAdminNav } from "./AdminNavContext";

type Props = {
  title: string;
  showBack?: boolean;
  right?: React.ReactNode;
};

export function AdminHeader({ title, showBack = false, right }: Props) {
  const { user, isSuperAdmin, handleLogout } = useAdminNav();

  const initials =
    user?.name
      ?.split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "?";

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />
      <View
        style={{
          backgroundColor: C.teal,
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {showBack ? (
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ marginRight: 10 }}
            >
              <Ionicons name="arrow-back" size={22} color={C.white} />
            </TouchableOpacity>
            <Text
              style={{
                color: C.white,
                fontWeight: "900",
                fontSize: 20,
                flex: 1,
              }}
              numberOfLines={1}
            >
              {title}
            </Text>
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            {user?.profile_image_url ? (
              <Image
                source={{ uri: user.profile_image_url }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  marginRight: 8,
                }}
              />
            ) : (
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: "rgba(255,255,255,0.25)",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 8,
                }}
              >
                <Text
                  style={{ color: C.white, fontWeight: "900", fontSize: 13 }}
                >
                  {initials}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: C.white, fontWeight: "800", fontSize: 14 }}
                numberOfLines={1}
              >
                {user?.name ?? "Admin"}
              </Text>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <View
                  style={{
                    backgroundColor: isSuperAdmin
                      ? "#7C3AED"
                      : "rgba(255,255,255,0.3)",
                    borderRadius: 4,
                    paddingHorizontal: 6,
                    paddingVertical: 1,
                  }}
                >
                  <Text
                    style={{ color: C.white, fontWeight: "600", fontSize: 9 }}
                  >
                    {isSuperAdmin ? "Superadmin" : "Admin"}
                  </Text>
                </View>
                {user?.location && (
                  <Text
                    style={{ color: "rgba(255,255,255,0.7)", fontSize: 10 }}
                    numberOfLines={1}
                  >
                    {user.location.name}
                  </Text>
                )}
              </View>
            </View>
            <TouchableOpacity onPress={handleLogout} style={{ padding: 6 }}>
              <Ionicons
                name="log-out-outline"
                size={20}
                color="rgba(255,255,255,0.9)"
              />
            </TouchableOpacity>
          </View>
        )}
        {right}
      </View>
    </>
  );
}

export default AdminHeader;
