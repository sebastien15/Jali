import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { router } from "expo-router";
import api, { getApiToken } from "@/lib/api";
import { C } from "@/constants/theme";

const EXPO_PROJECT_ID = "2dd83387-a796-4ed0-841a-2093ecd11fcf";

// Show booking updates (taken / ticket ready / cancelled) while the app is open too.
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Call once after the user is logged in (mounted by the (tabs) layout).
 * Requests permission, registers the Expo push token with the backend
 * (POST /me/push-token) and routes notification taps to My Trips.
 */
export function usePushPermission() {
  useEffect(() => {
    registerForPush().catch(() => {
      // Push is best-effort: no FCM config, no network, simulator, ...
    });

    if (Platform.OS === "web") return;
    // Booking pushes carry { booking_id }; the booking lives in My Trips.
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { booking_id?: unknown } | undefined;
      if (data?.booking_id != null) router.push("/(tabs)/trips");
    });
    return () => sub.remove();
  }, []);
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
      lightColor: C.blue,
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

  let pushToken: string;
  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId: EXPO_PROJECT_ID });
    pushToken = token.data;
  } catch {
    return; // e.g. missing FCM credentials or offline — try again next launch
  }

  // Only a signed-in user can own a push token
  if (!(await getApiToken())) return;
  try {
    await api.post("/me/push-token", { token: pushToken });
  } catch {
    // Never alert for this; it is retried on the next launch
  }
}
