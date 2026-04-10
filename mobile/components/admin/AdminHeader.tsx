import { View, Text, TouchableOpacity, StatusBar, Image } from "react-native";
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
  const { open, user, isSuperAdmin } = useAdminNav();

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
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            flex: 1,
          }}
        >
          {showBack ? (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ marginRight: 4 }}
            >
              <Ionicons name="arrow-back" size={22} color={C.white} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={open}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                flex: 1,
              }}
            >
              {user?.profile_image_url ? (
                <Image
                  source={{ uri: user.profile_image_url }}
                  style={{ width: 36, height: 36, borderRadius: 18 }}
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
                  }}
                >
                  <Text
                    style={{ color: C.white, fontWeight: "900", fontSize: 13 }}
                  >
                    {initials}
                  </Text>
                </View>
              )}
              <View>
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
                      style={{
                        color: isSuperAdmin ? C.white : C.white,
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
                      {user.location.name}
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
          {!showBack && (
            <Text
              style={{
                color: C.white,
                fontWeight: "900",
                fontSize: 18,
                marginLeft: "auto",
              }}
            >
              {title}
            </Text>
          )}
          {showBack && (
            <Text
              style={{
                color: C.white,
                fontWeight: "900",
                fontSize: 18,
                marginLeft: "auto",
                flex: 1,
                textAlign: "center",
              }}
            >
              {title}
            </Text>
          )}
        </View>
        {right}
      </View>
    </>
  );
}

export default AdminHeader;
