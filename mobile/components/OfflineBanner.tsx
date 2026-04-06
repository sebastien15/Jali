import { useEffect, useState } from "react";
import { View, Text, Animated } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { Ionicons } from "@expo/vector-icons";

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const slideAnim = useState(new Animated.Value(-60))[0];

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const offline = !(state.isConnected && state.isInternetReachable !== false);
      setIsOffline(offline);
      Animated.timing(slideAnim, {
        toValue: offline ? 0 : -60,
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
        backgroundColor: "#1a1a1a",
        paddingVertical: 10,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Ionicons name="cloud-offline-outline" size={18} color="#fff" />
      <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700", flex: 1 }}>
        No internet connection
      </Text>
      <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
        Check your network
      </Text>
    </Animated.View>
  );
}
