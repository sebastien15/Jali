import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import { DriverListing } from "@/constants/data";
import { formatYmd } from "@/lib/date";

interface PrivateListingsProps {
  driverListings: DriverListing[];
}

export function PrivateListingsCard({ driverListings }: PrivateListingsProps) {
  const { t, i18n } = useTranslation();

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
              {formatYmd(l.date, i18n.language)} · {l.dep} · {l.seats} {t("listing.seats")} ·{" "}
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
