import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useRootNavigationState } from "expo-router";
import { handleNotificationResponse } from "./notificationIntent";

/**
 * Root listener for notification taps (S23.5): foreground taps and the tap
 * that launched the app (cold start), for every account type. Waits until the
 * router is mounted before navigating.
 */
export default function NotificationTaps() {
  const navReady = !!useRootNavigationState()?.key;
  const [coldChecked, setColdChecked] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web" || !navReady) return;
    const sub = Notifications.addNotificationResponseReceivedListener(r => { handleNotificationResponse(r).catch(() => {}); });
    if (!coldChecked) {
      setColdChecked(true);
      Notifications.getLastNotificationResponseAsync()
        .then(r => (r ? handleNotificationResponse(r) : undefined))
        .catch(() => {});
    }
    return () => sub.remove();
  }, [navReady, coldChecked]);

  return null;
}
