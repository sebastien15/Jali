import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { C } from "@/constants/theme";

// Flip to false once Firebase credentials are set in lib/firebase.ts
const DEV_SKIP_AUTH = true;

export default function Index() {
  const [user, setUser]       = useState<User | null | undefined>(undefined);

  useEffect(() => {
    if (DEV_SKIP_AUTH) return;
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  // DEV: skip auth entirely
  if (DEV_SKIP_AUTH) return <Redirect href="/(tabs)" />;

  // Loading — waiting for Firebase to resolve
  if (user === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: C.blue }}>
        <ActivityIndicator color={C.yellow} size="large" />
      </View>
    );
  }

  return <Redirect href={user ? "/(tabs)" : "/(auth)/login"} />;
}
