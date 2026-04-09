import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { onAuthStateChanged, signInAnonymously, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { C } from "@/constants/theme";
import { isDev, isTest } from "@/lib/env";
import api from "@/lib/api";

export default function Index() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    if (isDev) return;

    if (isTest) {
      signInAnonymously(auth)
        .then((cred) => setUser(cred.user))
        .catch(() => setUser(null));
      return;
    }

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        return;
      }
      // Sync with backend and check roles
      try {
        const res = await api.post("/auth/login");
        const roles: string[] = res.data.user?.roles ?? [];
        if (roles.includes("admin") || roles.includes("superadmin")) {
          router.replace("/(admin)/dashboard");
          return;
        }
      } catch {
        // network error — fall through to regular app
      }
      setUser(firebaseUser);
    });
    return unsub;
  }, []);

  // dev mode — skip auth entirely
  if (isDev) return <Redirect href="/(tabs)" />;

  // waiting for Firebase / anon sign-in
  if (user === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: C.blue }}>
        <ActivityIndicator color={C.yellow} size="large" />
      </View>
    );
  }

  // test mode — go straight to app after anon sign-in
  if (isTest) return <Redirect href="/(tabs)" />;

  return <Redirect href={user ? "/(tabs)" : "/(auth)/login"} />;
}
