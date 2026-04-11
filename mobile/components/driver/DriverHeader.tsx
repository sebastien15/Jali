import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import { DriverStats } from "@/constants/data";

interface Props {
  stats: DriverStats | null;
  loading: boolean;
  online: boolean;
  onToggleOnline: () => void;
}

export function DriverHeader({ stats, loading, online, onToggleOnline }: Props) {
  const { t } = useTranslation();

  return (
    <View
      style={{
        backgroundColor: C.teal,
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 20,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <View>
          <Text
            style={{
              color: "rgba(255,255,255,0.7)",
              fontSize: 13,
              fontWeight: "600",
            }}
          >
            {t("drive.driverMode")}
          </Text>
          <Text style={{ color: C.white, fontWeight: "900", fontSize: 24 }}>
            {t("drive.dashboard")}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <TouchableOpacity
            onPress={onToggleOnline}
            style={{
              backgroundColor: online ? C.green : "rgba(255,255,255,0.2)",
              borderRadius: 14,
              paddingHorizontal: 18,
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: C.white, fontWeight: "800", fontSize: 14 }}>
              {online ? `🟢 ${t("drive.online")}` : `⚫ ${t("drive.offline")}`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/driver/setup")}
            style={{
              backgroundColor: "rgba(255,255,255,0.2)",
              borderRadius: 12,
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="settings-outline" size={20} color={C.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats row */}
      {loading && !stats ? (
        <ActivityIndicator color={C.yellow} />
      ) : (
        <View style={{ flexDirection: "row", gap: 10 }}>
          {[
            {
              v: stats ? stats.todayEarnings.toLocaleString() : "—",
              l: t("drive.todayRwf"),
            },
            { v: `${stats?.todayTrips ?? 0}`, l: t("drive.tripsToday") },
            { v: `${stats?.rating ?? "—"}`, l: `${t("drive.rating")} ⭐` },
          ].map((e, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                backgroundColor: "rgba(255,255,255,0.15)",
                borderRadius: 14,
                padding: 12,
                alignItems: "center",
              }}
            >
              <Text
                style={{ color: C.yellow, fontWeight: "900", fontSize: 17 }}
              >
                {e.v}
              </Text>
              <Text
                style={{
                  color: "rgba(255,255,255,0.7)",
                  fontSize: 11,
                  fontWeight: "600",
                }}
              >
                {e.l}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
