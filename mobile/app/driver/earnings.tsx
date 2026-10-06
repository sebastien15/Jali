import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, StatusBar, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { formatRwf } from "@/lib/fare";
import type { DriverEarnings } from "@/components/driver/EarningsCard";

type Period = "today" | "week" | "month";

/** Driver money: earnings, what I owe Jali, settle by MoMo, my MoMo details, payouts (S5.4, S7.1, S7.2) */
export default function EarningsScreen() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>("today");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [momoNumber, setMomoNumber] = useState("");
  const [momoName, setMomoName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: queryKeys.driver.earnings(),
    queryFn: () => api.get<DriverEarnings>("/driver/earnings").then(r => r.data),
  });

  useEffect(() => {
    if (!data) return;
    if (!amount && data.owed) setAmount(String(data.owed));
    setMomoNumber(n => n || data.momo.number || "");
    setMomoName(n => n || data.momo.name || "");
  }, [data]);

  async function run(key: string, fn: () => Promise<unknown>, done: string) {
    setBusy(key);
    try {
      await fn();
      Alert.alert(done);
      queryClient.invalidateQueries({ queryKey: queryKeys.driver.earnings() });
    } catch (err: any) {
      const errors = err?.response?.data?.errors;
      Alert.alert(errors ? (Object.values(errors)[0] as string[])[0] : err?.response?.data?.message ?? "Error");
    } finally {
      setBusy(null);
    }
  }

  if (isLoading || !data) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center" }}><ActivityIndicator color={C.teal} /></SafeAreaView>;
  }
  const p = data.periods[period];
  const pending = data.settlements.find(s => s.status === "pending");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />
      <View style={{ backgroundColor: C.white, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel={t("common.back")}>
          <Ionicons name="arrow-back" size={24} color={C.dark} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontWeight: "900", fontSize: 18, color: C.dark }}>{t("earnings.title")}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 12 }} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.teal} />}>
        <View style={{ flexDirection: "row", backgroundColor: C.white, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: C.border }}>
          {(["today", "week", "month"] as Period[]).map(k => (
            <TouchableOpacity key={k} onPress={() => setPeriod(k)} accessibilityLabel={t(`earnings.${k}`)} accessibilityState={{ selected: period === k }}
              style={{ flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: "center", backgroundColor: period === k ? C.teal : "transparent" }}>
              <Text style={{ fontWeight: "800", color: period === k ? C.white : C.mid }}>{t(`earnings.${k}`)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Card>
          <Text style={{ color: C.mid, fontSize: 12, fontWeight: "700" }}>{t("earnings.net")}</Text>
          <Text style={{ fontSize: 32, fontWeight: "900", color: C.green }}>{formatRwf(p.earnings)}</Text>
          <Row label={t("earnings.tripsLabel")} value={String(p.trips)} />
          <Row label={t("earnings.collected")} value={formatRwf(p.collected)} />
          <Row label={t("earnings.commission")} value={formatRwf(p.commission)} />
        </Card>

        <Card>
          <Row label={t("earnings.owed")} value={formatRwf(data.owed)} bold />
          {data.blocked ? <Text style={{ color: C.orange, fontWeight: "800", marginTop: 6 }}>{t("earnings.blocked", { max: formatRwf(data.max_owed) })}</Text> : null}
          {data.owed > 0 ? (
            pending ? (
              <Text style={{ color: C.teal, fontWeight: "700", marginTop: 8 }}>{t("earnings.pending", { amount: formatRwf(pending.amount ?? 0) })}</Text>
            ) : (
              <>
                <Text style={{ color: C.mid, marginTop: 8 }}>
                  {data.pay_to.number ? t("earnings.payTo", { number: data.pay_to.number, name: data.pay_to.name ?? "Jali" }) : t("earnings.payToSupport")}
                </Text>
                <Field label={t("earnings.amount")} value={amount} onChange={v => setAmount(v.replace(/\D/g, ""))} numeric />
                <Field label={t("earnings.reference")} value={reference} onChange={setReference} />
                <Primary label={t("earnings.settle")} loading={busy === "settle"} disabled={!amount || reference.length < 4}
                  onPress={() => run("settle", () => api.post("/driver/settlements", { amount: Number(amount), reference }), t("earnings.settleSent"))} />
              </>
            )
          ) : null}
          {data.balance > 0 ? (
            <Primary label={t("earnings.cashout", { amount: formatRwf(data.balance) })} loading={busy === "payout"}
              onPress={() => run("payout", () => api.post("/driver/payouts", { amount: data.balance }), t("earnings.cashoutSent"))} />
          ) : null}
        </Card>

        <Card>
          <Text style={{ fontWeight: "900", color: C.dark }}>{t("earnings.myMomo")}</Text>
          <Text style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>{t("earnings.myMomoHint")}</Text>
          <Field label={t("earnings.momoNumber")} value={momoNumber} onChange={setMomoNumber} numeric />
          <Field label={t("earnings.momoName")} value={momoName} onChange={setMomoName} />
          <Primary label={t("hire.settings.save")} loading={busy === "momo"} disabled={!momoNumber || !momoName}
            onPress={() => run("momo", () => api.put("/driver/momo", { momo_number: momoNumber, momo_name: momoName }), t("hire.settings.saved"))} />
        </Card>

        <Card>
          <Text style={{ fontWeight: "900", color: C.dark, marginBottom: 6 }}>{t("earnings.history")}</Text>
          {data.ledger.length ? data.ledger.map(e => (
            <View key={e.id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 7, borderTopWidth: 1, borderTopColor: C.border, gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.dark, fontWeight: "700" }}>{t(`earnings.type_${e.type}`)}</Text>
                <Text style={{ color: C.muted, fontSize: 11 }}>{e.at ? new Date(e.at).toLocaleString(i18n.language) : ""}{e.note ? ` · ${e.note}` : ""}</Text>
              </View>
              <Text style={{ fontWeight: "800", color: e.balance_effect > 0 ? C.green : e.balance_effect < 0 ? C.orange : C.dark }}>
                {e.balance_effect > 0 ? "+" : e.balance_effect < 0 ? "−" : ""}{formatRwf(e.amount)}
              </Text>
            </View>
          )) : <Text style={{ color: C.muted }}>{t("earnings.empty")}</Text>}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={{ backgroundColor: C.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.border }}>{children}</View>;
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
      <Text style={{ color: bold ? C.dark : C.mid, fontWeight: bold ? "900" : "400" }}>{label}</Text>
      <Text style={{ color: C.dark, fontWeight: bold ? "900" : "600" }}>{value}</Text>
    </View>
  );
}

function Field({ label, value, onChange, numeric }: { label: string; value: string; onChange: (v: string) => void; numeric?: boolean }) {
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={{ color: C.mid, fontSize: 12, fontWeight: "700", marginBottom: 4 }}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} keyboardType={numeric ? "phone-pad" : "default"} accessibilityLabel={label}
        style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10, color: C.dark }} />
    </View>
  );
}

function Primary({ label, onPress, loading, disabled }: { label: string; onPress: () => void; loading?: boolean; disabled?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={loading || disabled} accessibilityLabel={label}
      style={{ backgroundColor: disabled ? C.muted : C.dark, borderRadius: 14, paddingVertical: 13, alignItems: "center", marginTop: 10 }}>
      {loading ? <ActivityIndicator color={C.white} /> : <Text style={{ color: C.white, fontWeight: "900" }}>{label}</Text>}
    </TouchableOpacity>
  );
}
