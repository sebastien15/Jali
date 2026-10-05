import { Tabs } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { C } from "@/constants/theme";
import { useDriverMode } from "@/lib/DriverModeContext";
import { useMe, isDriverRole } from "@/lib/useMe";
import { usePushPermission } from "@/lib/usePushPermission";
import ProtectedRoute from "@/lib/ProtectedRoute";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

function TabIcon({
  icon, iconFocused, focused,
}: {
  icon: IoniconName;
  iconFocused: IoniconName;
  focused: boolean;
}) {
  return (
    <View style={{
      backgroundColor: focused ? C.blueLt : "transparent",
      borderRadius: 10,
      width: 40,
      height: 28,
      alignItems: "center",
      justifyContent: "center",
    }}>
      <Ionicons
        name={focused ? iconFocused : icon}
        size={22}
        color={focused ? C.blue : C.muted}
      />
    </View>
  );
}

function TabsNavigator() {
  const { driverMode } = useDriverMode();
  const { data: me } = useMe();
  // Driver endpoints are role-gated on the backend; never expose the tab
  // to accounts that would only get 403s.
  const showDrive = driverMode && isDriverRole(me);
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: C.blue,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600", marginTop: 2 },
        tabBarStyle: {
          backgroundColor: C.white,
          borderTopWidth: 1,
          borderTopColor: C.border,
          // Grow with the home-indicator / gesture-nav inset instead of a
          // fixed height that puts labels under the system bar.
          height: 64 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="home-outline" iconFocused="home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="calendar-outline" iconFocused="calendar" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="drive"
        options={showDrive ? {
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="car-outline" iconFocused="car" focused={focused} />
          ),
        } : { href: null }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="person-outline" iconFocused="person" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

function PushRegistrar() {
  usePushPermission();
  return null;
}

export default function TabLayout() {
  return (
    <ProtectedRoute>
      <PushRegistrar />
      <TabsNavigator />
    </ProtectedRoute>
  );
}
