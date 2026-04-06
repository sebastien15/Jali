import { Tabs } from "expo-router";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "@/constants/theme";
import { DriverModeProvider, useDriverMode } from "@/lib/DriverModeContext";
import { usePushPermission } from "@/lib/usePushPermission";

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
          height: 72,
          paddingBottom: 8,
          paddingTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="flash-outline" iconFocused="flash" focused={focused} />
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
        options={driverMode ? {
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
    <DriverModeProvider>
      <PushRegistrar />
      <TabsNavigator />
    </DriverModeProvider>
  );
}
