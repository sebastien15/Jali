import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";
import { C } from "@/constants/theme";

export type ToastType = "success" | "error";

export interface ToastHandle {
  show: (opts: { message: string; type?: ToastType }) => void;
}

export const Toast = forwardRef<ToastHandle>((_, ref) => {
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [message, setMessage] = useState("");
  const [type, setType] = useState<ToastType>("success");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useImperativeHandle(ref, () => ({
    show({ message: msg, type: t = "success" }) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setMessage(msg);
      setType(t);

      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 20 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();

      timerRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, { toValue: 100, duration: 300, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start();
      }, 2500);
    },
  }));

  const bg = type === "success" ? C.teal : "#DC2626";
  const icon = type === "success" ? "✅" : "❌";

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        bottom: 32,
        left: 20,
        right: 20,
        transform: [{ translateY }],
        opacity,
        zIndex: 9999,
      }}
    >
      <View
        style={{
          backgroundColor: bg,
          borderRadius: 14,
          paddingHorizontal: 18,
          paddingVertical: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        }}
      >
        <Text style={{ fontSize: 16 }}>{icon}</Text>
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14, flex: 1 }}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
});
