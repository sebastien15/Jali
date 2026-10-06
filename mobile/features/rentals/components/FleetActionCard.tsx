import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import { DriverCar } from "@/constants/data";

interface RentalCardProps {
  driverCars: DriverCar[];
}

export function FleetActionCard({ driverCars }: RentalCardProps) {
  const { t } = useTranslation();

  return (
    <TouchableOpacity
      onPress={() => router.push("/driver/fleet")}
      style={{
        backgroundColor: C.white,
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
        borderLeftWidth: 4,
        borderLeftColor: C.teal,
      }}
    >
      <View
        style={{
          backgroundColor: C.tealLt,
          borderRadius: 12,
          width: 44,
          height: 44,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="car-sport" size={22} color={C.teal} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "800", fontSize: 15, color: C.dark }}>
          {t("drive.myFleet")} ({driverCars.length} {t("drive.rented").toLowerCase()})
        </Text>
        <Text style={{ color: C.mid, fontSize: 12, marginTop: 2 }}>
          {driverCars.filter((c) => c.status === "available").length}{" "}
          {t("drive.available")} ·{" "}
          {driverCars.filter((c) => c.status === "rented").length}{" "}
          {t("drive.rented")}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.muted} />
    </TouchableOpacity>
  );
}
