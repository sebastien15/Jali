import { useMemo, useEffect } from "react";
import {
  View, Text, TouchableOpacity, Modal, ScrollView, Animated, Image,
} from "react-native";
import { usePathname, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { C } from "@/constants/theme";
import { useAdminNav } from "./AdminNavContext";

type NavItem = {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  route: string;
  superadminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", icon: "grid-outline", route: "/(admin)/dashboard" },
  { label: "Bookings", icon: "calendar-outline", route: "/(admin)/bookings/index" },
  { label: "Analytics", icon: "bar-chart-outline", route: "/(admin)/analytics/index" },
  { label: "Profile", icon: "person-outline", route: "/(admin)/profile/index" },
];

const SUPERADMIN_ITEMS: NavItem[] = [
  { label: "Bus Stops", icon: "bus-outline", route: "/(admin)/locations" },
  { label: "Stations", icon: "location-outline", route: "/(admin)/stations/index" },
  { label: "Logs", icon: "time-outline", route: "/(admin)/logs/index" },
  { label: "Users", icon: "people-outline", route: "/(admin)/users/index" },
];

export function AdminNavSheet() {
  const { isOpen, close, user, isSuperAdmin, handleLogout } = useAdminNav();
  const pathname = usePathname();

  const slideAnim = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isOpen ? 1 : 0,
      useNativeDriver: true,
      damping: 22,
      stiffness: 200,
    }).start();
  }, [isOpen]);

  function handleNav(route: string) {
    close();
    router.push(route as any);
  }

  const isActive = (route: string) => {
    const clean = pathname.replace(/^\//, "");
    const cleanRoute = route.replace(/^\//, "").replace(/\/index$/, "");
    return clean === cleanRoute || clean.startsWith(cleanRoute);
  };

  const initials = user?.name
    ?.split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "?";

  return (
    <Modal visible={isOpen} animationType="slide" transparent onRequestClose={close}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        {/* Backdrop */}
        <TouchableOpacity activeOpacity={1} onPress={close} style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.4)",
        }} />

        {/* Sheet */}
        <Animated.View
          style={{
            backgroundColor: C.white,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: "75%",
            transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [300, 0] }) }],
          }}
        >
          {/* Handle */}
          <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 8 }}>
            <View style={{ width: 40, height: 4, backgroundColor: C.border, borderRadius: 2 }} />
          </View>

          {/* User info */}
          {user && (
            <View style={{ paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                {user.profile_image_url ? (
                  <Image source={{ uri: user.profile_image_url }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                ) : (
                  <View style={{
                    width: 44, height: 44, borderRadius: 22,
                    backgroundColor: C.tealLt, alignItems: "center", justifyContent: "center",
                  }}>
                    <Text style={{ color: C.teal, fontWeight: "900", fontSize: 16 }}>{initials}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.dark, fontWeight: "800", fontSize: 16 }} numberOfLines={1}>
                    {user.name}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                    <View style={{
                      backgroundColor: isSuperAdmin ? "#7C3AED" : C.tealLt,
                      borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2,
                    }}>
                      <Text style={{
                        color: isSuperAdmin ? C.white : C.teal,
                        fontWeight: "700", fontSize: 11,
                      }}>
                        {isSuperAdmin ? "Superadmin" : "Admin"}
                      </Text>
                    </View>
                    {user.location && (
                      <Text style={{ color: C.muted, fontSize: 12 }} numberOfLines={1}>
                        📍 {user.location.name}, {user.location.city}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Nav items */}
          <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
            {NAV_ITEMS.filter(item => !(isSuperAdmin && item.label === "Bookings")).map((item) => (
              <SheetItem key={item.label} item={item} active={isActive(item.route)} onPress={() => handleNav(item.route)} />
            ))}

            {isSuperAdmin && (
              <>
                <View style={{ height: 1, backgroundColor: C.border, marginVertical: 12, marginHorizontal: 20 }} />
                <Text style={{
                  color: C.muted, fontSize: 11, fontWeight: "700",
                  textTransform: "uppercase", letterSpacing: 0.5,
                  paddingHorizontal: 20, marginBottom: 8,
                }}>
                  Management
                </Text>
                {SUPERADMIN_ITEMS.map((item) => (
                  <SheetItem key={item.label} item={item} active={isActive(item.route)} onPress={() => handleNav(item.route)} />
                ))}
              </>
            )}
          </ScrollView>

          {/* Logout */}
          <TouchableOpacity
            onPress={handleLogout}
            style={{
              padding: 16, flexDirection: "row", alignItems: "center", gap: 12,
              borderTopWidth: 1, borderTopColor: C.border,
            }}
          >
            <View style={{
              backgroundColor: "rgba(220,38,38,0.1)", borderRadius: 10,
              width: 36, height: 36, alignItems: "center", justifyContent: "center",
            }}>
              <Ionicons name="log-out-outline" size={18} color="#DC2626" />
            </View>
            <Text style={{ color: "#DC2626", fontWeight: "700", fontSize: 14 }}>Sign Out</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

function SheetItem({ item, active, onPress }: {
  item: NavItem; active: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: "row", alignItems: "center", gap: 12,
        paddingVertical: 14, paddingHorizontal: 20,
        backgroundColor: active ? C.tealLt : "transparent",
      }}
    >
      <Ionicons name={item.icon} size={20} color={active ? C.teal : C.mid} />
      <Text style={{
        color: active ? C.teal : C.dark,
        fontWeight: active ? "800" : "600",
        fontSize: 14,
      }}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );
}
