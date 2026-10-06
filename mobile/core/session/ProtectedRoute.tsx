import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { getApiToken } from "@/lib/api";
import { C } from "@/constants/theme";

type Props = {
  children: React.ReactNode;
  loginPath?: "/(auth)/login" | "/(admin)/login";
};

export default function ProtectedRoute({
  children,
  loginPath = "/(auth)/login",
}: Props) {
  const [checking, setChecking] = useState(true);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    let active = true;
    getApiToken().then((token) => {
      if (active) {
        setHasToken(!!token);
        setChecking(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  if (checking) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: C.bg,
        }}
      >
        <ActivityIndicator size="large" color={C.blue} />
      </View>
    );
  }

  if (!hasToken) {
    return <Redirect href={loginPath} />;
  }

  return <>{children}</>;
}
