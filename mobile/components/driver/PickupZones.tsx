import { View, Text, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";

const ZONES = [
  "Kigali CBD",
  "Nyabugogo",
  "Remera",
  "Kimironko",
  "Gikondo",
  "Kicukiro",
  "Kanombe",
];

interface Props {
  activeZones: number[];
  onToggleZone: (i: number) => void;
}

export function PickupZones({ activeZones, onToggleZone }: Props) {
  const { t } = useTranslation();

  return (
    <>
      <Text
        style={{
          fontWeight: "800",
          fontSize: 15,
          color: C.dark,
          marginBottom: 10,
        }}
      >
        {t("drive.myPickupZones")}
      </Text>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 24,
        }}
      >
        {ZONES.map((z, i) => {
          const active = activeZones.includes(i);
          return (
            <TouchableOpacity
              key={i}
              onPress={() => onToggleZone(i)}
              style={{
                backgroundColor: active ? C.teal : C.bg,
                borderWidth: active ? 0 : 2,
                borderColor: C.border,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 8,
              }}
            >
              <Text
                style={{
                  color: active ? C.white : C.mid,
                  fontWeight: "700",
                  fontSize: 13,
                }}
              >
                {active ? "✓ " : ""}
                {z}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
}
