import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, TextInput, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api, { getApiToken } from "@/lib/api";
import AdminHeader from "@/components/admin/AdminHeader";
import { queryKeys } from "@/lib/queryKeys";
import type { components } from "@/lib/apiSchema";

type Application = components["schemas"]["DriverApplication"];
type Doc = Application["documents"][number];

const DOC_LABEL: Record<string, string> = {
  licence_front: "Licence — front", licence_back: "Licence — back", national_id: "National ID / passport",
  selfie: "Selfie", insurance: "Insurance",
};
const STATUS_COLOR: Record<string, string> = {
  pending: C.blue, verified: C.green, rejected: C.orange, suspended: C.orange,
};

export default function DriverApplicationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [viewer, setViewer] = useState<Doc | null>(null);
  const [action, setAction] = useState<"reject" | "suspend" | null>(null);
  const [reason, setReason] = useState("");
  const [docReasons, setDocReasons] = useState<Record<string, string>>({});

  useEffect(() => { getApiToken().then(setToken); }, []);

  const { data, isLoading } = useQuery<Application>({
    queryKey: queryKeys.admin.driver(Number(id)),
    queryFn: () => api.get(`/admin/drivers/${id}`).then(r => r.data),
  });

  const act = useMutation({
    mutationFn: (body: { kind: "verify" | "reject" | "suspend"; payload?: object }) =>
      api.post<Application>(`/admin/drivers/${id}/${body.kind}`, body.payload ?? {}).then(r => r.data),
    onSuccess: updated => {
      queryClient.setQueryData(queryKeys.admin.driver(Number(id)), updated);
      queryClient.invalidateQueries({ queryKey: ["admin", "drivers"] });
      setAction(null); setReason(""); setDocReasons({});
    },
    onError: (err: any) => Alert.alert("Error", err?.response?.data?.message ?? "Action failed."),
  });

  if (isLoading || !data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <AdminHeader title="Application" showBack />
        <ActivityIndicator style={{ marginTop: 40 }} color={C.teal} />
      </SafeAreaView>
    );
  }

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <AdminHeader title={data.user.name ?? "Application"} showBack />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontWeight: "900", fontSize: 17, color: C.dark }}>{data.user.name}</Text>
            <View style={{ backgroundColor: STATUS_COLOR[data.status], borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ color: C.white, fontWeight: "800", fontSize: 11, textTransform: "uppercase" }}>{data.status}</Text>
            </View>
          </View>
          <Row label="Phone" value={data.user.phone} />
          <Row label="Email" value={data.user.email} />
          <Row label="Services" value={data.services.join(", ")} />
          <Row label="Licence" value={`${data.licence.licence_no ?? "—"} · ${data.licence.licence_categories.join(", ")} · exp. ${data.licence.licence_expiry ?? "—"}`} />
          <Row label="National ID" value={data.licence.national_id_no} />
          {data.rejection_reason ? <Row label="Reason" value={data.rejection_reason} /> : null}
        </Card>

        <Title text="Checklist" />
        <Card>
          {data.checklist.filter(s => s.required).map(s => (
            <View key={s.key} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}>
              <Ionicons name={s.done ? "checkmark-circle" : "close-circle"} size={18} color={s.done ? C.green : C.orange} />
              <Text style={{ color: C.dark, textTransform: "capitalize" }}>{s.key}</Text>
            </View>
          ))}
        </Card>

        <Title text="Documents" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {data.documents.filter(d => d.status !== "missing").map(doc => (
            <TouchableOpacity key={doc.type} onPress={() => setViewer(doc)} accessibilityLabel={`View ${DOC_LABEL[doc.type]}`}
              style={{ width: "48%", backgroundColor: C.white, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: doc.status === "rejected" ? C.orange : C.border }}>
              {doc.file_url ? <Image source={{ uri: doc.file_url, headers: authHeaders }} style={{ width: "100%", height: 110, backgroundColor: C.border }} resizeMode="cover" /> : null}
              <View style={{ padding: 8 }}>
                <Text style={{ fontWeight: "700", fontSize: 12, color: C.dark }}>{DOC_LABEL[doc.type]}</Text>
                <Text style={{ fontSize: 11, color: doc.status === "rejected" ? C.orange : C.muted }}>{doc.status}{doc.rejection_reason ? ` — ${doc.rejection_reason}` : ""}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <Title text="Vehicles" />
        {data.vehicles.length === 0 ? <Text style={{ color: C.muted }}>No vehicle (hire-a-driver only)</Text> : data.vehicles.map(v => {
          const photos = v.photos && !Array.isArray(v.photos) ? v.photos : {};
          return (
            <Card key={v.id}>
              <Text style={{ fontWeight: "800", color: C.dark }}>{[v.make, v.model].filter(Boolean).join(" ")} · {v.plate}</Text>
              <Text style={{ color: C.mid, fontSize: 12 }}>{v.class} · {v.color ?? "—"} · {v.seats} seats · insurance {v.insurance_expiry ?? "—"}</Text>
              <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                {Object.values(photos).filter(Boolean).map(url => (
                  <Image key={url} source={{ uri: url as string }} style={{ width: 64, height: 48, borderRadius: 6, backgroundColor: C.border }} />
                ))}
              </View>
            </Card>
          );
        })}

        {data.rates.length ? (
          <>
            <Title text="Prices" />
            <Card>
              {data.rates.map((r, i) => (
                <Text key={i} style={{ color: C.dark }}>Base {r.base_fare} · {r.per_km}/km · min {r.min_fare} RWF</Text>
              ))}
            </Card>
          </>
        ) : null}

        <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
          {data.status === "pending" ? (
            <>
              <ActionButton label="Approve" color={C.green} loading={act.isPending}
                onPress={() => Alert.alert("Approve driver?", data.user.name ?? "", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Approve", onPress: () => act.mutate({ kind: "verify" }) },
                ])} />
              <ActionButton label="Reject" color={C.orange} onPress={() => setAction("reject")} />
            </>
          ) : null}
          {data.status === "verified" ? <ActionButton label="Suspend" color={C.orange} onPress={() => setAction("suspend")} /> : null}
        </View>
      </ScrollView>

      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setViewer(null)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center" }}>
          {viewer?.file_url ? <Image source={{ uri: viewer.file_url, headers: authHeaders }} style={{ width: "100%", height: "80%" }} resizeMode="contain" /> : null}
          <Text style={{ color: C.white, textAlign: "center", marginTop: 8 }}>{viewer ? DOC_LABEL[viewer.type] : ""}</Text>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!action} transparent animationType="slide" onRequestClose={() => setAction(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 }}>
            <Text style={{ fontWeight: "900", fontSize: 17, color: C.dark, marginBottom: 10 }}>
              {action === "reject" ? "Reject application" : "Suspend driver"}
            </Text>
            <TextInput value={reason} onChangeText={setReason} placeholder="Reason shown to the driver" placeholderTextColor={C.muted} multiline accessibilityLabel="Reason"
              style={{ backgroundColor: C.bg, borderRadius: 12, padding: 12, minHeight: 70, color: C.dark, borderWidth: 1.5, borderColor: C.border }} />
            {action === "reject" ? (
              <>
                <Text style={{ color: C.mid, fontWeight: "700", fontSize: 12, marginTop: 12, marginBottom: 6 }}>Documents to redo (optional)</Text>
                {data.documents.filter(d => d.status !== "missing").map(d => (
                  <TextInput key={d.type} value={docReasons[d.type] ?? ""} onChangeText={v => setDocReasons({ ...docReasons, [d.type]: v })}
                    placeholder={`${DOC_LABEL[d.type]}: what's wrong?`} placeholderTextColor={C.muted} accessibilityLabel={`${DOC_LABEL[d.type]} reason`}
                    style={{ backgroundColor: C.bg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 6, color: C.dark }} />
                ))}
              </>
            ) : null}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <ActionButton label="Cancel" color={C.muted} onPress={() => setAction(null)} />
              <ActionButton label={action === "reject" ? "Reject" : "Suspend"} color={C.orange} loading={act.isPending}
                onPress={() => {
                  if (!reason.trim()) return Alert.alert("A reason is required");
                  const documents = Object.fromEntries(Object.entries(docReasons).filter(([, v]) => v.trim()));
                  act.mutate({ kind: action!, payload: action === "reject" ? { reason, documents } : { reason } });
                }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={{ backgroundColor: C.white, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border, gap: 4 }}>{children}</View>;
}

function Title({ text }: { text: string }) {
  return <Text style={{ fontWeight: "800", fontSize: 13, color: C.teal, textTransform: "uppercase", marginTop: 16, marginBottom: 8 }}>{text}</Text>;
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      <Text style={{ color: C.muted, width: 90, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: C.dark, flex: 1, fontSize: 13 }}>{value || "—"}</Text>
    </View>
  );
}

function ActionButton({ label, color, onPress, loading }: { label: string; color: string; onPress: () => void; loading?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={loading} accessibilityLabel={label}
      style={{ flex: 1, backgroundColor: color, borderRadius: 14, paddingVertical: 14, alignItems: "center" }}>
      {loading ? <ActivityIndicator color={C.white} /> : <Text style={{ color: C.white, fontWeight: "900" }}>{label}</Text>}
    </TouchableOpacity>
  );
}
