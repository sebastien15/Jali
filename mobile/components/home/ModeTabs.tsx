import { View, Text, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";

type Mode = "bus" | "private" | "rental";

interface Props {
  mode: Mode;
  onChange: (mode: Mode) => void;
}

const TABS: { id: Mode; icon: string; labelKey: string }[] = [
  { id: "bus",     icon: "🚌", labelKey: "home.modeBus"     },
  { id: "private", icon: "💺", labelKey: "home.modePrivate" },
  { id: "rental",  icon: "🚗", labelKey: "home.modeRental"  },
];

export function ModeTabs({ mode, onChange }: Props) {
  const { t } = useTranslation();

  return (
    <View style={{ flexDirection: "row", backgroundColor: C.white, borderBottomWidth: 2, borderBottomColor: C.border }}>
      {TABS.map(tab => (
        <TouchableOpacity
          key={tab.id}
          onPress={() => onChange(tab.id)}
          style={{
            flex: 1, alignItems: "center", paddingTop: 14, paddingBottom: 11,
            borderBottomWidth: 3,
            borderBottomColor: mode === tab.id ? C.blue : "transparent",
          }}
        >
          <Text style={{ fontSize: 18 }}>{tab.icon}</Text>
          <Text style={{ color: mode === tab.id ? C.blue : C.mid, fontWeight: "800", fontSize: 12 }}>
            {t(tab.labelKey)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
