import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import api, { getApiToken } from "@/lib/api";
import { C } from "@/constants/theme";

const EXPO_PROJECT_ID = "2dd83387-a796-4ed0-841a-2093ecd11fcf";

// Show booking updates (taken / ticket ready / cancelled) while the app is open too.
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Call once after the user is logged in (mounted by the (tabs) layout).
 * Requests permission, registers the Expo push token with the backend
 * (POST /me/push-token).
 */
export function usePushPermission() {
  useEffect(() => {
    registerForPush().catch(() => {
      // Push is best-effort: no FCM config, no network, simulator, ...
    });

    // Taps are handled at the root for every account (core/notifications/NotificationTaps, S23.5)
  }, []);
}

/** Payload → route; kept for older callers (the resolver lives in notificationIntent.ts, S23.5) */
export { routeForNotification } from "./notificationIntent";

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
    // S12.3: ride requests ring loudly on their own channel (sound bundled via the expo-notifications plugin)
    await Notifications.setNotificationChannelAsync("ride_requests", {
      name: "Ride requests",
      description: "New ride requests for drivers",
      importance: Notifications.AndroidImportance.MAX,
      sound: "ride_request.wav",
      vibrationPattern: [0, 600, 300, 600, 300, 600],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      lightColor: C.orange,
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
