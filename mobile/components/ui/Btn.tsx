import { TouchableOpacity, Text, ActivityIndicator } from "react-native";
import { C } from "@/constants/theme";

interface BtnProps {
  label: string;
  color: string;
  onPress: () => void;
  loading?: boolean;
  textColor?: string;
}

export function Btn({ label, color, onPress, loading, textColor }: BtnProps) {
  const tColor = textColor ?? (color === C.blue ? C.yellow : C.white);
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      style={{
        backgroundColor: color, borderRadius: 14,
        paddingVertical: 16, alignItems: "center",
      }}
    >
      {loading
        ? <ActivityIndicator color={tColor} />
        : <Text style={{ color: tColor, fontWeight: "900", fontSize: 16 }}>{label}</Text>
      }
    </TouchableOpacity>
  );
}
