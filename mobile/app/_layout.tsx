import "../global.css";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View, ActivityIndicator } from "react-native";
import OfflineBanner from "@/components/OfflineBanner";
import { initI18n } from "@/lib/i18n";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { Suspense, useEffect, useState } from "react";

function I18nWrapper({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initI18n().then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nWrapper>
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(admin)" />
            <Stack.Screen name="legal/[doc]" options={{ presentation: "modal", headerShown: false }} />
            <Stack.Screen name="driver/setup" options={{ presentation: "card", headerShown: false }} />
            <Stack.Screen name="driver/fleet" options={{ presentation: "card", headerShown: false }} />
            <Stack.Screen name="driver/listing" options={{ presentation: "card", headerShown: false }} />
          </Stack>
          <OfflineBanner />
        </View>
      </I18nWrapper>
    </SafeAreaProvider>
  );
}
