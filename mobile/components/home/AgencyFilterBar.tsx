import { ScrollView, View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "@/constants/theme";

interface Props {
  agencies: string[];
  selected: string | null;
  onChange: (name: string | null) => void;
}

export function AgencyFilterBar({ agencies, selected, onChange }: Props) {
  if (agencies.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border }}
    >
      <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 9, alignItems: "center" }}>
        {/* All chip */}
        <TouchableOpacity
          onPress={() => onChange(null)}
          style={{
            paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
            backgroundColor: selected === null ? C.teal : C.bg,
            borderWidth: selected === null ? 0 : 1.5, borderColor: C.border,
          }}
        >
          <Text style={{ color: selected === null ? C.white : C.mid, fontWeight: "700", fontSize: 12 }}>
            All
          </Text>
        </TouchableOpacity>

        {agencies.map(name => {
          const active = selected === name;
          return (
            <TouchableOpacity
              key={name}
              onPress={() => onChange(active ? null : name)}
              style={{
                paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
                backgroundColor: active ? C.teal : C.bg,
                borderWidth: active ? 0 : 1.5, borderColor: C.border,
                flexDirection: "row", alignItems: "center", gap: 5,
              }}
            >
              <Ionicons name="business-outline" size={11} color={active ? C.white : C.mid} />
              <Text style={{ color: active ? C.white : C.mid, fontWeight: "700", fontSize: 12 }}>
                {name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}
