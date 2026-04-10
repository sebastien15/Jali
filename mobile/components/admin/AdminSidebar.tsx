import { useMemo, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  StatusBar,
} from "react-native";
import { usePathname, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { C } from "@/constants/theme";
import { useAdminSidebar } from "./AdminSidebarContext";
import { ROLES } from "@/constants/roles";

const WIDTH = 280;
const { height: SCREEN_HEIGHT } = Dimensions.get("window");

type NavItem = {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  route: string;
  superadminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", icon: "grid-outline", route: "/(admin)/dashboard" },
  {
    label: "Bookings",
    icon: "calendar-outline",
    route: "/(admin)/bookings/index",
  },
  {
    label: "Analytics",
    icon: "bar-chart-outline",
    route: "/(admin)/analytics/index",
  },
  { label: "Profile", icon: "person-outline", route: "/(admin)/profile/index" },
];

const SUPERADMIN_ITEMS: NavItem[] = [
  {
    label: "Stations",
    icon: "location-outline",
    route: "/(admin)/stations/index",
  },
  { label: "Logs", icon: "time-outline", route: "/(admin)/logs/index" },
  { label: "Users", icon: "people-outline", route: "/(admin)/users/index" },
];

export function AdminSidebar() {
  const { isOpen, close, user, isSuperAdmin, handleLogout } = useAdminSidebar();
  const pathname = usePathname();

  const slideAnim = useMemo(() => new Animated.Value(-WIDTH), []);
  const backdropAnim = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: isOpen ? 0 : -WIDTH,
        useNativeDriver: true,
        damping: 18,
        stiffness: 200,
      }),
      Animated.timing(backdropAnim, {
        toValue: isOpen ? 1 : 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
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

  const initials =
    user?.name
      ?.split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "?";

  return (
    <>
      {/* Backdrop */}
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.45)",
          opacity: backdropAnim,
          zIndex: 100,
          pointerEvents: isOpen ? "auto" : "none",
        }}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={close}
          style={{ flex: 1 }}
        />
      </Animated.View>

      {/* Sidebar */}
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: WIDTH,
          height:
            SCREEN_HEIGHT +
            (Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0),
          backgroundColor: C.white,
          transform: [{ translateX: slideAnim }],
          zIndex: 101,
          pointerEvents: isOpen ? "auto" : "none",
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowRadius: 10,
          shadowOffset: { width: 2, height: 0 },
          elevation: 8,
        }}
      >
        {/* Header */}
        <View
          style={{
            backgroundColor: C.teal,
            paddingHorizontal: 20,
            paddingTop: 50,
            paddingBottom: 20,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              marginBottom: 4,
            }}
          >
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: "rgba(255,255,255,0.25)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: C.white, fontWeight: "900", fontSize: 16 }}>
                {initials}
              </Text>
            </View>
            <View>
              <Text
                style={{ color: C.white, fontWeight: "800", fontSize: 16 }}
                numberOfLines={1}
              >
                {user?.name ?? "Admin"}
              </Text>
              <View
                style={{
                  backgroundColor: isSuperAdmin ? "#7C3AED" : C.white,
                  borderRadius: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  alignSelf: "flex-start",
                  marginTop: 4,
                }}
              >
                <Text
                  style={{
                    color: isSuperAdmin ? C.white : C.teal,
                    fontWeight: "700",
                    fontSize: 11,
                  }}
                >
                  {isSuperAdmin ? "Superadmin" : "Admin"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Nav Items */}
        <View style={{ flex: 1, paddingVertical: 8 }}>
          {NAV_ITEMS.map((item) => (
            <SidebarItem
              key={item.label}
              item={item}
              active={isActive(item.route)}
              onPress={() => handleNav(item.route)}
            />
          ))}

          {/* Divider + Management label */}
          {isSuperAdmin && (
            <>
              <View
                style={{
                  height: 1,
                  backgroundColor: C.border,
                  marginVertical: 12,
                  marginHorizontal: 20,
                }}
              />
              <Text
                style={{
                  color: C.muted,
                  fontSize: 11,
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  paddingHorizontal: 20,
                  marginBottom: 8,
                }}
              >
                Management
              </Text>
              {SUPERADMIN_ITEMS.map((item) => (
                <SidebarItem
                  key={item.label}
                  item={item}
                  active={isActive(item.route)}
                  onPress={() => handleNav(item.route)}
                />
              ))}
            </>
          )}
        </View>

        {/* Logout */}
        <TouchableOpacity
          onPress={handleLogout}
          style={{
            padding: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            borderTopWidth: 1,
            borderTopColor: C.border,
          }}
        >
          <View
            style={{
              backgroundColor: "rgba(220,38,38,0.1)",
              borderRadius: 10,
              width: 36,
              height: 36,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="log-out-outline" size={18} color="#DC2626" />
          </View>
          <Text style={{ color: "#DC2626", fontWeight: "700", fontSize: 14 }}>
            Sign Out
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}

function SidebarItem({
  item,
  active,
  onPress,
}: {
  item: NavItem;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 20,
        backgroundColor: active ? C.tealLt : "transparent",
      }}
    >
      <Ionicons name={item.icon} size={20} color={active ? C.teal : C.mid} />
      <Text
        style={{
          color: active ? C.teal : C.dark,
          fontWeight: active ? "800" : "600",
          fontSize: 14,
        }}
      >
        {item.label}
      </Text>
    </TouchableOpacity>
  );
}
