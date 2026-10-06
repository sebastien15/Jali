import { View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "@/constants/theme";

export function Stars({ value, onChange, size = 34 }: { value: number; onChange: (v: number) => void; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, justifyContent: "center" }}>
      {[1, 2, 3, 4, 5].map(n => (
        <TouchableOpacity key={n} onPress={() => onChange(n)} accessibilityLabel={`${n} star${n > 1 ? "s" : ""}`}>
          <Ionicons name={n <= value ? "star" : "star-outline"} size={size} color={n <= value ? C.yellow : C.muted} />
        </TouchableOpacity>
      ))}
    </View>
  );
}
