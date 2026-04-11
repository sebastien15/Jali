import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { getApiToken } from "@/lib/api";
import { C } from "@/constants/theme";

export default function Index() {
  const [ready, setReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const token = await getApiToken();
      if (active) {
        setHasToken(!!token);
        setReady(true);
      }
    })();
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

  return <Redirect href={hasToken ? "/(tabs)" : "/(auth)/login"} />;
}
