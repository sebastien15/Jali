import type { ReactNode } from "react";
import { View, Text, TouchableOpacity, StatusBar } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import { STATUS_META, type TicketStatus } from "../support";

export function BackHeader({ title, right, fallback = "/(tabs)" }: { title: string; right?: ReactNode; fallback?: string }) {
  return (
    <View style={{ backgroundColor: C.white, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />
      <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback as any))} accessibilityLabel="Back" hitSlop={12}>
        <Ionicons name="arrow-back" size={24} color={C.dark} />
      </TouchableOpacity>
      <Text style={{ flex: 1, fontWeight: "900", fontSize: 18, color: C.dark }} numberOfLines={1}>{title}</Text>
      {right}
    </View>
  );
}

export function StatusPill({ status }: { status: TicketStatus }) {
  const { t } = useTranslation();
  const meta = STATUS_META[status];
  const color = meta.color === "orange" ? C.orange : meta.color === "green" ? C.green : C.muted;
  const bg = meta.color === "orange" ? C.orangeLt : meta.color === "green" ? C.greenLt : C.bg;
  return (
    <View style={{ backgroundColor: bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ color, fontWeight: "800", fontSize: 11 }}>{t(`support.status.${status}`, meta.label)}</Text>
    </View>
  );
}
