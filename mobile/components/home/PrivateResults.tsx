import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import { PrivateCard } from "@/components/PrivateCard";
import { StationObj } from "@/components/StationPicker";

interface Props {
  items: any[];
  loading: boolean;
  error: string | null;
  from: StationObj | null;
  to: StationObj | null;
  onPress: (item: any) => void;
  onRetry: () => void;
}

export function PrivateResults({ items, loading, error, from, to, onPress, onRetry }: Props) {
  const { t } = useTranslation();

  if (loading) return <ActivityIndicator color={C.blue} style={{ marginTop: 32 }} />;

  if (error) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 40 }}>
        <Text style={{ fontSize: 40 }}>⚠️</Text>
        <Text style={{ color: C.orange, fontWeight: "700", fontSize: 14, marginTop: 8, textAlign: "center" }}>
          {error}
        </Text>
        <TouchableOpacity
          onPress={onRetry}
          style={{ marginTop: 16, backgroundColor: C.blue, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
        >
          <Text style={{ color: C.white, fontWeight: "800", fontSize: 14 }}>{t('home.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <View style={{
        backgroundColor: C.orange, borderRadius: 12, padding: 12,
        flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 12,
      }}>
        <Text style={{ fontSize: 16 }}>⚠️</Text>
        <Text style={{ color: C.white, fontSize: 13, fontWeight: "700", flex: 1 }}>
          {t('home.upfrontFeeWarning')}
        </Text>
      </View>

      <Text style={{ fontWeight: "800", fontSize: 16, color: C.dark, marginBottom: 12 }}>
        {items.length} {t('home.privateCars')}
        {from?.city ? ` · ${from.city}` : ""}
        {to?.city ? ` → ${to.city}` : ` (${t('home.allRoutes')})`}
      </Text>

      {items.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 40 }}>
          <Text style={{ fontSize: 40 }}>💺</Text>
          <Text style={{ color: C.muted, fontWeight: "700", fontSize: 14, marginTop: 8 }}>
            {t('home.noPrivateCarsRoute')}
          </Text>
        </View>
      ) : (
        items.map(p => (
          <PrivateCard key={p.id} item={p} onPress={() => onPress(p)} />
        ))
      )}
    </>
  );
}
