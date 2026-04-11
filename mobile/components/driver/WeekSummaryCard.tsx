import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import { DriverStats } from "@/constants/data";

interface Props {
  stats: DriverStats;
}

export function WeekSummaryCard({ stats }: Props) {
  const { t } = useTranslation();

  return (
    <View
      style={{
        backgroundColor: C.tealLt,
        borderRadius: 16,
        padding: 16,
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 20,
      }}
    >
      <View>
        <Text style={{ color: C.mid, fontSize: 12, fontWeight: "600" }}>
          {t("drive.thisWeek")}
        </Text>
        <Text style={{ color: C.dark, fontWeight: "900", fontSize: 20 }}>
          {stats.weekEarnings.toLocaleString()} RWF
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ color: C.mid, fontSize: 12, fontWeight: "600" }}>
          {t("drive.trips")}
        </Text>
        <Text style={{ color: C.teal, fontWeight: "900", fontSize: 20 }}>
          {stats.weekTrips}
        </Text>
      </View>
    </View>
  );
}
