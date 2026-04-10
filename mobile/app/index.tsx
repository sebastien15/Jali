import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { C } from "@/constants/theme";

export default function Index() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function resetSession() {
      try {
        if (auth.currentUser) {
          await signOut(auth);
        }
      } finally {
        if (active) {
          setReady(true);
        }
      }
    }

    resetSession();

    return () => {
      active = false;
    };
  }, []);

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: C.blue,
        }}
      >
        <ActivityIndicator color={C.yellow} size="large" />
      </View>
    );
  }

  return <Redirect href="/(auth)/login" />;
}
