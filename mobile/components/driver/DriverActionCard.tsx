import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import { DriverListing, DriverCar } from "@/constants/data";

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

interface PrivateListingsProps {
  driverListings: DriverListing[];
}

export function PrivateListingsCard({ driverListings }: PrivateListingsProps) {
  const { t } = useTranslation();

  return (
    <View style={{ marginBottom: 20 }}>
      <TouchableOpacity
        onPress={() => router.push("/driver/listing")}
        style={{
          backgroundColor: C.teal,
          borderRadius: 14,
          padding: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <Ionicons name="add-circle-outline" size={20} color={C.white} />
        <Text style={{ color: C.white, fontWeight: "800", fontSize: 15 }}>
          {t("drive.newTripListing")}
        </Text>
      </TouchableOpacity>

      {driverListings.map((l) => (
        <TouchableOpacity
          key={l.id}
          onPress={() =>
            router.push({
              pathname: "/driver/listing",
              params: { id: String(l.id) },
            })
          }
          style={{
            backgroundColor: C.white,
            borderRadius: 14,
            padding: 14,
            marginBottom: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            shadowColor: "#000",
            shadowOpacity: 0.04,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 1 },
            elevation: 1,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{ fontWeight: "800", fontSize: 14, color: C.dark }}
            >
              {l.from} → {l.to}
            </Text>
            <Text style={{ color: C.mid, fontSize: 12, marginTop: 2 }}>
              {l.date} · {l.dep} · {l.seats} seats ·{" "}
              {l.price.toLocaleString()} RWF
            </Text>
          </View>
          <View
            style={{
              backgroundColor: l.active ? C.greenLt : C.bg,
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <Text
              style={{
                color: l.active ? C.green : C.muted,
                fontWeight: "700",
                fontSize: 11,
              }}
            >
              {l.active ? t("drive.active") : t("drive.paused")}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={C.muted} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** Entry to driver-set ride prices (on-demand rides, story S2.1). */
export function RidePricesCard() {
  const { t } = useTranslation();

  return (
    <TouchableOpacity
      onPress={() => router.push("/driver/rates")}
      accessibilityLabel={t("ride.rates.cardTitle")}
      style={{
        backgroundColor: C.white,
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        borderWidth: 1,
        borderColor: C.border,
      }}
    >
      <View style={{ backgroundColor: C.tealLt, borderRadius: 12, width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="pricetags-outline" size={22} color={C.teal} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "800", fontSize: 15, color: C.dark }}>{t("ride.rates.cardTitle")}</Text>
        <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{t("ride.rates.cardSub")}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={C.muted} />
    </TouchableOpacity>
  );
}
