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
      contentContainerStyle={{ flexGrow: 0 }}
    >
      <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 9, alignItems: "center" }}>
        {/* All chip */}
        <TouchableOpacity
          onPress={() => onChange(null)}
          style={{
            paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
            backgroundColor: selected === null ? C.blue : C.blueLt,
            minWidth: 40, alignItems: "center",
          }}
        >
          <Text style={{ color: selected === null ? C.white : C.blue, fontWeight: "700", fontSize: 12 }} numberOfLines={1}>
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
                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                backgroundColor: active ? C.blue : C.blueLt,
                flexDirection: "row", alignItems: "center", gap: 5,
                minWidth: 60,
              }}
            >
              <Ionicons name="business-outline" size={11} color={active ? C.white : C.blue} />
              <Text style={{ color: active ? C.white : C.blue, fontWeight: "700", fontSize: 12 }} numberOfLines={1}>
                {name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}
