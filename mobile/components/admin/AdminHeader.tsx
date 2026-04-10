import { View, Text, StatusBar, Image } from "react-native";
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
  const { user, isSuperAdmin } = useAdminNav();

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
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                flex: 1,
              }}
            >
              {user?.profile_image_url ? (
                <Image
                  source={{ uri: user.profile_image_url }}
                  style={{ width: 34, height: 34, borderRadius: 17 }}
                />
              ) : (
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: "rgba(255,255,255,0.25)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{ color: C.white, fontWeight: "900", fontSize: 12 }}
                  >
                    {initials}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text
                  style={{ color: C.white, fontWeight: "800", fontSize: 15 }}
                  numberOfLines={1}
                >
                  {user?.name ?? "Admin"}
                </Text>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
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
                      style={{
                        color: C.white,
                        fontWeight: "600",
                        fontSize: 9,
                      }}
                    >
                      {isSuperAdmin ? "Superadmin" : "Admin"}
                    </Text>
                  </View>
                  {user?.location && (
                    <Text
                      style={{ color: "rgba(255,255,255,0.7)", fontSize: 10 }}
                      numberOfLines={1}
                    >
                      {user.location.name}, {user.location.city}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </View>
        )}
        {right}
      </View>
    </>
  );
}

import { TouchableOpacity } from "react-native";
export default AdminHeader;
