import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Call this once after the user is logged in.
// Requests permission and logs the push token (send to backend when ready).
export function usePushPermission() {
  useEffect(() => {
    registerForPush();
  }, []);
}

async function registerForPush() {
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

  // Get the push token and log it
  // TODO: send this token to Laravel backend so it can send FCM pushes
  const token = await Notifications.getExpoPushTokenAsync({
    projectId: "2dd83387-a796-4ed0-841a-2093ecd11fcf",
  });
  console.log("Push token:", token.data);
}
