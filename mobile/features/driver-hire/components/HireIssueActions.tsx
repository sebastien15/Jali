import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { DriverHire } from "../hire";

/**
 * S6.5: report that the other side didn't show (after the start + grace) and
 * dispute the recorded hours of a completed hire. Used on both sides.
 */
export function HireIssueActions({ hire }: { hire: DriverHire }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState("");
  const [claimedEnd, setClaimedEnd] = useState("");
  const isCustomer = hire.role === "customer";

  async function post(path: string, body?: object) {
    setBusy(true);
    try {
      const res = await api.post<DriverHire>(`/driver-hire/${hire.id}/${path}`, body);
      queryClient.setQueryData(queryKeys.hire.detail(hire.id), res.data);
      queryClient.invalidateQueries({ queryKey: queryKeys.hire.mine() });
      queryClient.invalidateQueries({ queryKey: ["driver", "hires"] });
      return true;
    } catch (err: any) {
      Alert.alert(String(Object.values(err?.response?.data?.errors ?? {})[0] ?? err?.response?.data?.message ?? "Error"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const noShowFrom = hire.no_show_from ? new Date(hire.no_show_from) : null;
  const noShowNow = noShowFrom && noShowFrom.getTime() <= Date.now();
  const confirmNoShow = () => Alert.alert(
    isCustomer ? t("hire.issue.noShowDriverTitle", "Driver didn't come?") : t("hire.issue.noShowCustomerTitle", "Customer didn't show?"),
    isCustomer ? t("hire.issue.noShowDriverText", "The hire ends and you pay nothing.")
      : t("hire.issue.noShowCustomerText", "The hire ends and the customer owes the late-cancellation fee."),
    [{ text: t("common.cancel", "Cancel"), style: "cancel" }, { text: t("hire.issue.report", "Report"), style: "destructive", onPress: () => post("no-show") }],
  );

  return (
    <View style={{ gap: 10 }}>
      {noShowFrom && (noShowNow ? (
        <TouchableOpacity onPress={confirmNoShow} disabled={busy} accessibilityLabel={t("hire.issue.reportNoShow", "Report a no-show")}
          style={{ alignItems: "center", paddingVertical: 10 }}>
          <Text style={{ color: C.orange, fontWeight: "800" }}>
            {isCustomer ? t("hire.issue.driverNoShow", "My driver didn't come") : t("hire.issue.customerNoShow", "The customer didn't show")}
          </Text>
        </TouchableOpacity>
      ) : (
        <Text style={{ color: C.muted, fontSize: 12, textAlign: "center" }}>
          {t("hire.issue.noShowFrom", {
            time: noShowFrom.toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" }),
            defaultValue: `If the other side doesn't come, you can report it from ${noShowFrom.toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" })}.`,
          })}
        </Text>
      ))}

      {hire.my_dispute && (
        <View style={{ backgroundColor: hire.my_dispute.status === "open" ? C.orangeLt : C.greenLt, borderRadius: 14, padding: 12, gap: 4 }}>
          <Text style={{ fontWeight: "800", color: C.dark }}>
            {hire.my_dispute.status === "open" ? t("hire.issue.disputeOpen", "Jali is checking your dispute") : t("hire.issue.disputeResolved", "Your dispute was resolved")}
          </Text>
          {!!hire.my_dispute.resolution && <Text style={{ color: C.dark }}>{hire.my_dispute.resolution}</Text>}
        </View>
      )}

      {hire.can_dispute && !disputing && (
        <TouchableOpacity onPress={() => setDisputing(true)} accessibilityLabel={t("hire.issue.dispute", "Dispute the hours")} style={{ alignItems: "center", paddingVertical: 6 }}>
          <Text style={{ color: C.mid, fontWeight: "700" }}>{t("hire.issue.dispute", "Dispute the hours")}</Text>
        </TouchableOpacity>
      )}
      {disputing && (
        <View style={{ backgroundColor: C.white, borderRadius: 14, padding: 14, gap: 8 }}>
          <Text style={{ fontWeight: "800", color: C.dark }}>{t("hire.issue.disputeTitle", "What was wrong with the recorded hours?")}</Text>
          <TextInput value={reason} onChangeText={setReason} multiline maxLength={1000} accessibilityLabel={t("hire.issue.disputeReason", "Explain what happened")}
            placeholder={t("hire.issue.disputeReason", "Explain what happened")} placeholderTextColor={C.muted}
            style={{ backgroundColor: C.bg, borderRadius: 10, padding: 10, minHeight: 90, textAlignVertical: "top", color: C.dark }} />
          <TextInput value={claimedEnd} onChangeText={setClaimedEnd} maxLength={40} accessibilityLabel={t("hire.issue.realEnd", "Real end time (e.g. 13:30)")}
            placeholder={t("hire.issue.realEnd", "Real end time (e.g. 13:30)")} placeholderTextColor={C.muted}
            style={{ backgroundColor: C.bg, borderRadius: 10, padding: 10, color: C.dark }} />
          <TouchableOpacity disabled={busy || reason.trim().length < 10} accessibilityLabel={t("hire.issue.sendDispute", "Send to Jali")}
            onPress={async () => { if (await post("dispute", { reason: reason.trim(), claimed_end: claimedEnd.trim() || null })) setDisputing(false); }}
            style={{ backgroundColor: reason.trim().length >= 10 ? C.teal : C.border, borderRadius: 12, paddingVertical: 12, alignItems: "center" }}>
            {busy ? <ActivityIndicator color={C.white} /> : <Text style={{ color: C.white, fontWeight: "800" }}>{t("hire.issue.sendDispute", "Send to Jali")}</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
