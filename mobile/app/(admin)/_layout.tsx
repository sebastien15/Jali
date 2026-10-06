import { usePathname, Redirect } from "expo-router";
import { Tabs } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "@/constants/theme";
import {
  AdminNavProvider,
  useAdminNav,
} from "@/components/admin/AdminNavContext";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

function TabIcon({
  icon,
  iconFocused,
  focused,
}: {
  icon: IconName;
  iconFocused: IconName;
  focused: boolean;
}) {
  return (
    <View
      style={{
        backgroundColor: focused ? C.tealLt : "transparent",
        borderRadius: 10,
        width: 40,
        height: 28,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons
        name={focused ? iconFocused : icon}
        size={22}
        color={focused ? C.teal : C.muted}
      />
    </View>
  );
}

function TabsNavigator() {
  const { user, isSuperAdmin, loading } = useAdminNav();
  const pathname = usePathname();
  const isLogin = pathname.includes("/admin-login");

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: C.bg,
        }}
      >
        <ActivityIndicator size="large" color={C.teal} />
      </View>
    );
  }

  if (!user && !isLogin) {
    return <Redirect href="/(admin)/admin-login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: C.teal,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600", marginTop: 2 },
        tabBarStyle: {
          backgroundColor: C.white,
          borderTopWidth: 1,
          borderTopColor: C.border,
          height: isLogin ? 0 : 72,
          paddingBottom: isLogin ? 0 : 8,
          paddingTop: isLogin ? 0 : 4,
          display: isLogin ? "none" : "flex",
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          tabBarLabel: "Dashboard",
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="grid-outline" iconFocused="grid" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings/index"
        options={isSuperAdmin ? { href: null } : {
          tabBarLabel: "Bookings",
          tabBarIcon: ({ focused }) => (
            <TabIcon
              icon="calendar-outline"
              iconFocused="calendar"
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics/index"
        options={{
          tabBarLabel: "Analytics",
          tabBarIcon: ({ focused }) => (
            <TabIcon
              icon="bar-chart-outline"
              iconFocused="bar-chart"
              focused={focused}
            />
          ),
        }}
      />
      {/* Stations tab — visible for superadmin, hidden for others */}
      <Tabs.Screen
        name="stations/index"
        options={isSuperAdmin ? {
          tabBarLabel: "Stations",
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="location-outline" iconFocused="location" focused={focused} />
          ),
        } : { href: null }}
      />

      {/* Profile tab — visible for regular admin, hidden for superadmin (accessible via dashboard tile) */}
      <Tabs.Screen
        name="profile/index"
        options={isSuperAdmin ? { href: null } : {
          tabBarLabel: "Profile",
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="person-outline" iconFocused="person" focused={focused} />
          ),
        }}
      />

      {/* ── All other screens: navigable but hidden from tab bar ── */}
      <Tabs.Screen name="admin-login"      options={{ href: null }} />
      <Tabs.Screen name="locations/index" options={{ href: null }} />
      <Tabs.Screen name="buses/index"     options={{ href: null }} />
      <Tabs.Screen name="buses/[id]"      options={{ href: null }} />
      <Tabs.Screen name="bookings/[id]"   options={{ href: null }} />
      <Tabs.Screen name="users/index"     options={{ href: null }} />
      <Tabs.Screen name="users/[id]"      options={{ href: null }} />
      <Tabs.Screen name="logs/index"      options={{ href: null }} />
      <Tabs.Screen name="settings/rides"  options={{ href: null }} />
      <Tabs.Screen name="drivers/index"   options={{ href: null }} />
      <Tabs.Screen name="drivers/[id]"    options={{ href: null }} />
      <Tabs.Screen name="rides/index"     options={{ href: null }} />
      <Tabs.Screen name="rides/[id]"      options={{ href: null }} />
      <Tabs.Screen name="settlements/index" options={{ href: null }} />
      <Tabs.Screen name="agencies/index"  options={{ href: null }} />
      <Tabs.Screen name="trips/index"     options={{ href: null }} />
    </Tabs>
  );
}

export default function AdminLayout() {
  return (
    <AdminNavProvider>
      <View style={{ flex: 1 }}>
        <TabsNavigator />
      </View>
    </AdminNavProvider>
  );
}
