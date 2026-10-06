import { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Image, StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api, { getApiToken } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { pickPhotoForm } from "@/lib/uploadImage";
import type { components } from "@/lib/apiSchema";

type Onboarding = components["schemas"]["DriverOnboarding"];
type Service = components["schemas"]["DriverService"];
type StepKey = Onboarding["steps"][number]["key"];

const SERVICES: Service[] = ["ride", "hire", "private_seat", "rental"];
const CATEGORIES = ["A", "B", "C", "C1", "D", "D1", "E", "F"];

const STATUS_STYLE: Record<Onboarding["status"], { bg: string; fg: string; icon: React.ComponentProps<typeof Ionicons>["name"] }> = {
  draft:     { bg: C.blueLt,   fg: C.blue,   icon: "create-outline" },
  pending:   { bg: C.yellow,   fg: C.dark,   icon: "time-outline" },
  verified:  { bg: C.greenLt,  fg: C.green,  icon: "checkmark-circle-outline" },
  rejected:  { bg: C.orangeLt, fg: C.orange, icon: "alert-circle-outline" },
  suspended: { bg: C.orangeLt, fg: C.orange, icon: "ban-outline" },
};

export default function DriverOnboardingScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<StepKey | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [licence, setLicence] = useState({ licence_no: "", licence_categories: [] as string[], licence_expiry: "", national_id_no: "" });
  const [token, setToken] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: queryKeys.driver.onboarding(),
    queryFn: () => api.get<Onboarding>("/driver/onboarding").then(r => r.data),
  });

  // Vehicle and prices are edited on other screens — refresh when coming back
  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));
  useEffect(() => { getApiToken().then(setToken); }, []);

  useEffect(() => {
    if (!data) return;
    setLicence({
      licence_no: data.licence.licence_no ?? "",
      licence_categories: data.licence.licence_categories ?? [],
      licence_expiry: data.licence.licence_expiry ?? "",
      national_id_no: data.licence.national_id_no ?? "",
    });
  }, [data?.licence.licence_no, data?.licence.licence_expiry]);

  const setData = (next: Onboarding) => queryClient.setQueryData(queryKeys.driver.onboarding(), next);

  async function run(key: string, fn: () => Promise<{ data: Onboarding }>) {
    setBusy(key);
    setErrors({});
    try {
      const res = await fn();
      setData(res.data);
      return true;
    } catch (err: any) {
      const fe = err?.response?.status === 422 ? err.response.data?.errors : null;
      if (fe) {
        const first: Record<string, string> = {};
        for (const [k, v] of Object.entries(fe)) first[k] = Array.isArray(v) ? String(v[0]) : String(v);
        setErrors(first);
        Alert.alert(Object.values(first)[0]);
      } else {
        Alert.alert(err?.response?.data?.message ?? t("ride.onboarding.error"));
      }
      return false;
    } finally {
      setBusy(null);
    }
  }

  const toggleService = (s: Service) => {
    if (!data) return;
    const next = data.services.includes(s) ? data.services.filter(x => x !== s) : [...data.services, s];
    if (next.length) run("services", () => api.put("/driver/onboarding/services", { services: next }));
  };

  async function uploadDoc(type: string) {
    const form = await pickPhotoForm("file", { type });
    if (form) await run(`doc-${type}`, () => api.post("/driver/documents", form, { headers: { "Content-Type": "multipart/form-data" } }));
  }

  async function submit() {
    if (await run("submit", () => api.post("/driver/onboarding/submit"))) {
      Alert.alert(t("ride.onboarding.submitted"));
    }
  }

  if (isLoading || !data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <Header t={t} />
        <View style={{ padding: 16, gap: 10 }}>
          {[0, 1, 2, 3].map(i => <View key={i} style={{ height: 58, borderRadius: 14, backgroundColor: C.border, opacity: 0.5 }} />)}
        </View>
      </SafeAreaView>
    );
  }

  const status = STATUS_STYLE[data.status];
  const locked = data.status === "pending" || data.status === "verified" || data.status === "suspended";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <Header t={t} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: status.bg, borderRadius: 14, padding: 12, marginBottom: 14 }}>
          <Ionicons name={status.icon} size={20} color={status.fg} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: status.fg, fontWeight: "800" }}>{t(`ride.onboarding.status_${data.status}`)}</Text>
            {data.rejection_reason ? <Text style={{ color: status.fg, marginTop: 2 }}>{data.rejection_reason}</Text> : null}
          </View>
        </View>

        {data.steps.filter(s => s.required).map((step, index) => (
          <View key={step.key} style={{ backgroundColor: C.white, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: C.border, overflow: "hidden" }}>
            <TouchableOpacity
              onPress={() => {
                if (step.key === "vehicle") return router.push("/driver/vehicles");
                if (step.key === "rates") return router.push("/driver/rates");
                setOpen(open === step.key ? null : step.key);
              }}
              accessibilityLabel={t(`ride.onboarding.step_${step.key}`)}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: step.done ? C.green : C.bg, borderWidth: step.done ? 0 : 1.5, borderColor: C.border }}>
                {step.done ? <Ionicons name="checkmark" size={16} color={C.white} /> : <Text style={{ color: C.mid, fontWeight: "800" }}>{index + 1}</Text>}
              </View>
              <Text style={{ flex: 1, fontWeight: "800", color: C.dark, fontSize: 15 }}>{t(`ride.onboarding.step_${step.key}`)}</Text>
              <Ionicons name={step.key === "vehicle" || step.key === "rates" ? "chevron-forward" : open === step.key ? "chevron-up" : "chevron-down"} size={18} color={C.muted} />
            </TouchableOpacity>

            {open === step.key && step.key === "services" ? (
              <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 8 }}>
                {SERVICES.map(s => {
                  const on = data.services.includes(s);
                  return (
                    <TouchableOpacity key={s} onPress={() => toggleService(s)} disabled={busy === "services" || locked}
                      accessibilityLabel={t(`ride.onboarding.svc_${s}`)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, backgroundColor: on ? C.tealLt : C.bg, borderWidth: 1.5, borderColor: on ? C.teal : C.border }}>
                      <Ionicons name={on ? "checkbox" : "square-outline"} size={20} color={on ? C.teal : C.muted} />
                      <Text style={{ color: C.dark, fontWeight: "600", flex: 1 }}>{t(`ride.onboarding.svc_${s}`)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}

            {open === step.key && step.key === "profile" && !step.done ? (
              <Text style={{ paddingHorizontal: 14, paddingBottom: 14, color: C.mid }}>{t("ride.onboarding.phoneMissing")}</Text>
            ) : null}

            {open === step.key && step.key === "licence" ? (
              <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                <Field label={t("ride.onboarding.licenceNo")} value={licence.licence_no} error={errors.licence_no}
                  onChange={v => setLicence({ ...licence, licence_no: v })} editable={!locked} />
                <Text style={labelStyle}>{t("ride.onboarding.licenceCategories")}</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                  {CATEGORIES.map(c => {
                    const on = licence.licence_categories.includes(c);
                    return (
                      <TouchableOpacity key={c} disabled={locked} accessibilityLabel={`Category ${c}`}
                        onPress={() => setLicence({ ...licence, licence_categories: on ? licence.licence_categories.filter(x => x !== c) : [...licence.licence_categories, c] })}
                        style={{ minWidth: 40, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 10, alignItems: "center", backgroundColor: on ? C.teal : C.bg, borderWidth: 1.5, borderColor: on ? C.teal : C.border }}>
                        <Text style={{ color: on ? C.white : C.mid, fontWeight: "800" }}>{c}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {errors.licence_categories ? <ErrorText text={errors.licence_categories} /> : null}
                <Field label={t("ride.onboarding.licenceExpiry")} value={licence.licence_expiry} error={errors.licence_expiry} placeholder="2028-05-31"
                  onChange={v => setLicence({ ...licence, licence_expiry: v })} editable={!locked} />
                <Field label={t("ride.onboarding.nationalId")} value={licence.national_id_no} error={errors.national_id_no}
                  onChange={v => setLicence({ ...licence, national_id_no: v })} editable={!locked} />
                {!locked ? (
                  <PrimaryButton label={t("ride.onboarding.save")} loading={busy === "licence"}
                    onPress={() => run("licence", () => api.put("/driver/onboarding/licence", { ...licence, national_id_no: licence.national_id_no || null }))} />
                ) : null}
              </View>
            ) : null}

            {open === step.key && step.key === "documents" ? (
              <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 8 }}>
                {data.documents.filter(d => d.required || d.status !== "missing").map(doc => (
                  <View key={doc.type} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 12, backgroundColor: C.bg }}>
                    {doc.file_url && token ? (
                      <Image source={{ uri: doc.file_url, headers: { Authorization: `Bearer ${token}` } }}
                        style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: C.border }} />
                    ) : (
                      <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: C.white, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="document-outline" size={20} color={C.muted} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: "700", color: C.dark }}>{t(`ride.onboarding.doc_${doc.type}`)}</Text>
                      <Text style={{ fontSize: 12, color: doc.status === "rejected" ? C.orange : doc.status === "approved" ? C.green : C.muted }}>
                        {t(`ride.onboarding.doc_${doc.status}`)}{doc.rejection_reason ? ` — ${doc.rejection_reason}` : ""}
                      </Text>
                    </View>
                    {doc.status !== "approved" && !locked ? (
                      <TouchableOpacity onPress={() => uploadDoc(doc.type)} disabled={!!busy} accessibilityLabel={t("ride.onboarding.upload")}
                        style={{ backgroundColor: C.teal, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
                        {busy === `doc-${doc.type}` ? <ActivityIndicator color={C.white} size="small" />
                          : <Text style={{ color: C.white, fontWeight: "800", fontSize: 12 }}>{doc.status === "missing" ? t("ride.onboarding.upload") : t("ride.onboarding.replace")}</Text>}
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ))}

        {!locked ? (
          <PrimaryButton label={t("ride.onboarding.submit")} loading={busy === "submit"} disabled={!data.can_submit} onPress={submit} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const labelStyle = { color: C.mid, fontSize: 12, fontWeight: "700" as const, marginBottom: 4 };

function Header({ t }: { t: (k: string) => string }) {
  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />
      <View style={{ backgroundColor: C.teal, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, flexDirection: "row", alignItems: "center", gap: 14 }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={C.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.white, fontWeight: "900", fontSize: 20 }}>{t("ride.onboarding.title")}</Text>
          <Text style={{ color: C.tealLt, fontSize: 12 }}>{t("ride.onboarding.subtitle")}</Text>
        </View>
      </View>
    </>
  );
}

function Field({ label, value, onChange, error, placeholder, editable = true }: {
  label: string; value: string; onChange: (v: string) => void; error?: string; placeholder?: string; editable?: boolean;
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={labelStyle}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={C.muted}
        editable={editable} accessibilityLabel={label}
        style={{ backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: C.dark, borderWidth: 1.5, borderColor: error ? C.orange : C.border }} />
      {error ? <ErrorText text={error} /> : null}
    </View>
  );
}

function ErrorText({ text }: { text: string }) {
  return <Text style={{ color: C.orange, fontSize: 12, marginTop: 3 }}>{text}</Text>;
}

function PrimaryButton({ label, onPress, loading, disabled }: { label: string; onPress: () => void; loading?: boolean; disabled?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={loading || disabled} accessibilityLabel={label}
      style={{ backgroundColor: disabled ? C.muted : C.teal, borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 8 }}>
      {loading ? <ActivityIndicator color={C.white} /> : <Text style={{ color: C.white, fontWeight: "900", fontSize: 15 }}>{label}</Text>}
    </TouchableOpacity>
  );
}
