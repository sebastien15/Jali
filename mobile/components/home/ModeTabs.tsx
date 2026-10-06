import { View, Text, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";

export interface ModeTab<M extends string> {
  mode: M;
  icon: string;
  labelKey: string;
}

interface Props<M extends string> {
  tabs: ModeTab<M>[];
  mode: M;
  onChange: (mode: M) => void;
}

/** Home search tabs; the list comes from the service registry (core/navigation, S23.2) */
export function ModeTabs<M extends string>({ tabs, mode, onChange }: Props<M>) {
  const { t } = useTranslation();
  if (tabs.length < 2) return null;

  return (
    <View style={{ flexDirection: "row", backgroundColor: C.white, borderBottomWidth: 2, borderBottomColor: C.border }}>
      {tabs.map(tab => (
        <TouchableOpacity
          key={tab.mode}
          onPress={() => onChange(tab.mode)}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === tab.mode }}
          style={{
            flex: 1, alignItems: "center", paddingTop: 14, paddingBottom: 11,
            borderBottomWidth: 3,
            borderBottomColor: mode === tab.mode ? C.blue : "transparent",
          }}
        >
          <Text style={{ fontSize: 18 }}>{tab.icon}</Text>
          <Text style={{ color: mode === tab.mode ? C.blue : C.mid, fontWeight: "800", fontSize: 12 }}>
            {t(tab.labelKey)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
