import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { router } from "expo-router";
import api from "@/lib/api";

// Call this once after the user is logged in.
// Requests permission, registers the Expo push token with the backend and
// opens the right screen when a notification is tapped.
export function usePushPermission() {
  useEffect(() => {
    registerForPush();

    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      openFromNotification(response.notification.request.content.data);
    });
    return () => sub.remove();
  }, []);
}

/**
 * Backend pushes carry `{ screen, id }` (see App\Services\PushService).
 * Screens that don't exist yet fall back to the Trips tab.
 */
export function routeForNotification(data: Record<string, unknown> | undefined | null): string | null {
  if (!data || typeof data.screen !== "string") return null;
  const id = typeof data.id === "number" || typeof data.id === "string" ? data.id : null;
  switch (data.screen) {
    case "ride":
      return id ? `/ride/${id}` : "/ride";
    case "hire":
      return id ? `/hire/${id}` : "/hire";
    case "driver_hire":
      return id ? `/driver/hire/${id}` : "/(tabs)/drive";
    case "driver_ride":
      return id ? `/driver/ride/${id}` : "/(tabs)/drive";
    case "booking":
      return "/(tabs)/trips";
    case "driver":
      return "/(tabs)/drive";
    case "driver_rates":
      return "/driver/rates";
    case "driver_onboarding":
      return "/driver/onboarding";
    default:
      return "/(tabs)/trips";
  }
}

function openFromNotification(data: Record<string, unknown> | undefined) {
  const route = routeForNotification(data);
  if (route) router.push(route as any);
}

async function registerForPush() {
  // Push notifications require native platform — skip on web
  if (Platform.OS === "web") return;

  // Android needs a notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Jali Notifications",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#0055CC",
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    // User declined — respect it, don't pester again
    return;
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: "2dd83387-a796-4ed0-841a-2093ecd11fcf",
    });
    await api.post("/me/push-token", { token: token.data });
  } catch (e) {
    // Push is best-effort: never block the app on it
    console.warn("Push registration failed", e);
  }
}
