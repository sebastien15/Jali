import { useEffect, useState } from "react";
import { View, Text, Animated } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";

export default function OfflineBanner() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [isOffline, setIsOffline] = useState(false);
  const slideAnim = useState(new Animated.Value(-120))[0];

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const offline = !(state.isConnected && state.isInternetReachable !== false);
      setIsOffline(offline);
      Animated.timing(slideAnim, {
        toValue: offline ? 0 : -120,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });
    return unsub;
  }, []);

  if (!isOffline) return null;

  return (
    <Animated.View
      style={{
        transform: [{ translateY: slideAnim }],
        position: "absolute",
        top: 0, left: 0, right: 0,
        zIndex: 999,
        backgroundColor: C.dark,
        // Sit below the notch / status bar instead of under it
        paddingTop: insets.top + 10,
        paddingBottom: 10,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Ionicons name="cloud-offline-outline" size={18} color={C.white} />
      <Text style={{ color: C.white, fontSize: 13, fontWeight: "700", flex: 1 }}>
        {t("components.offlineBanner.noConnection")}
      </Text>
      <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
        {t("components.offlineBanner.checkNetwork")}
      </Text>
    </Animated.View>
  );
}
