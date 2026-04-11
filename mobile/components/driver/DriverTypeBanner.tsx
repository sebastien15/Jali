import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";

interface Props {
  isRental: boolean;
  onChangeType: () => void;
}

export function DriverTypeBanner({ isRental, onChangeType }: Props) {
  const { t } = useTranslation();

  return (
    <View
      style={{
        backgroundColor: isRental ? C.blueLt : C.tealLt,
        paddingHorizontal: 16,
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons
          name={isRental ? "car-sport-outline" : "people-outline"}
          size={16}
          color={isRental ? C.blue : C.teal}
        />
        <Text
          style={{
            fontSize: 13,
            fontWeight: "700",
            color: isRental ? C.blue : C.teal,
          }}
        >
          {t("drive.earningAs")}{" "}
          {isRental
            ? t("drive.fleetOwner")
            : t("drive.privateSeatDriver")}
        </Text>
      </View>
      <TouchableOpacity onPress={onChangeType}>
        <Text
          style={{
            fontSize: 12,
            fontWeight: "800",
            color: C.mid,
            textDecorationLine: "underline",
          }}
        >
          {t("drive.change")}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
