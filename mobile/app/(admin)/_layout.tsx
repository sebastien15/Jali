import { Tabs } from "expo-router";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "@/constants/theme";
import { AdminNavProvider } from "@/components/admin/AdminNavContext";
import { AdminNavSheet } from "@/components/admin/AdminNavSheet";
import { useAdminNav } from "@/components/admin/AdminNavContext";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

function TabIcon({
  icon,
  iconFocused,
  focused,
}: {
  icon: IoniconName;
  iconFocused: IoniconName;
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
  const { isSuperAdmin } = useAdminNav();

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
          height: 72,
          paddingBottom: 8,
          paddingTop: 4,
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
        options={{
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
      <Tabs.Screen
        name="profile/index"
        options={{
          tabBarLabel: "Profile",
          tabBarIcon: ({ focused }) => (
            <TabIcon
              icon="person-outline"
              iconFocused="person"
              focused={focused}
            />
          ),
        }}
      />

      {/* Superadmin-only tabs */}
      {isSuperAdmin && (
        <>
          <Tabs.Screen
            name="stations/index"
            options={{
              tabBarLabel: "Stations",
              tabBarIcon: ({ focused }) => (
                <TabIcon
                  icon="location-outline"
                  iconFocused="location"
                  focused={focused}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="logs/index"
            options={{
              tabBarLabel: "Logs",
              tabBarIcon: ({ focused }) => (
                <TabIcon
                  icon="time-outline"
                  iconFocused="time"
                  focused={focused}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="users/index"
            options={{
              tabBarLabel: "Users",
              tabBarIcon: ({ focused }) => (
                <TabIcon
                  icon="people-outline"
                  iconFocused="people"
                  focused={focused}
                />
              ),
            }}
          />
        </>
      )}
    </Tabs>
  );
}

export default function AdminLayout() {
  return (
    <AdminNavProvider>
      <View style={{ flex: 1 }}>
        <TabsNavigator />
        <AdminNavSheet />
      </View>
    </AdminNavProvider>
  );
}
