import "../global.css";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View } from "react-native";
import OfflineBanner from "@/components/OfflineBanner";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="legal/[doc]" options={{ presentation: "modal", headerShown: false }} />
          <Stack.Screen name="driver/setup" options={{ presentation: "card", headerShown: false }} />
          <Stack.Screen name="driver/fleet" options={{ presentation: "card", headerShown: false }} />
          <Stack.Screen name="driver/listing" options={{ presentation: "card", headerShown: false }} />
        </Stack>
        <OfflineBanner />
      </View>
    </SafeAreaProvider>
  );
}
