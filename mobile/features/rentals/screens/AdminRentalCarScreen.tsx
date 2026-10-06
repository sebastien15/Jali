import { useEffect, useState } from "react";
import { View, Text, ScrollView, Image, ActivityIndicator, Alert, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api, { getApiToken } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { formatRwf } from "@/lib/fare";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { ALLOWED_KEYS, AdminRentalCar, LABELS, apiError } from "../rentals";
import { Badge, PrimaryButton, Row, Section, SecondaryButton } from "../components/ui";

/** Admin: check a rental car's photos, details and papers, then approve or reject (S24.8) */
export default function AdminRentalCarScreen() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { getApiToken().then(setToken); }, []);

  const { data: car, isLoading } = useQuery({
    queryKey: queryKeys.admin.rentalCar(id),
    queryFn: () => api.get<AdminRentalCar>(`/admin/rental-cars/${id}`).then(r => r.data),
  });

  async function review(decision: "approve" | "reject") {
    if (decision === "reject" && note.trim().length < 3) return Alert.alert("Add a note", "Tell the owner what to change.");
    setBusy(true);
    try {
      const updated = await api.post<AdminRentalCar>(`/admin/rental-cars/${id}/review`, { decision, note: note.trim() || null }).then(r => r.data);
      queryClient.setQueryData(queryKeys.admin.rentalCar(id), updated);
      queryClient.invalidateQueries({ queryKey: ["admin", "rentalCars"] });
      router.back();
    } catch (e) {
      Alert.alert("Could not save", apiError(e, "Try again."));
    } finally {
      setBusy(false);
    }
  }

  if (isLoading || !car) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}><AdminHeader title="Rental car" showBack /><ActivityIndicator color={C.teal} style={{ marginTop: 40 }} /></SafeAreaView>;
  }
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  const docUrl = (type: string) => `${api.defaults.baseURL}/admin/rental-cars/${car.id}/documents/${type}`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <AdminHeader title={`${car.name} · ${car.plate}`} showBack />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        <Section>
          <Badge label={car.verification_status} color={car.verification_status === "verified" ? C.green : C.orange} bg={car.verification_status === "verified" ? C.greenLt : C.orangeLt} />
          <Text style={{ marginTop: 8, fontWeight: "800", color: C.dark }}>{car.owner?.name}</Text>
          <Text style={{ color: C.mid }}>{car.owner?.phone ?? "—"}</Text>
          {car.missing.length > 0 && <Text style={{ color: C.orange, marginTop: 6 }}>Missing: {car.missing.map(m => LABELS.missing[m] ?? m).join(", ")}</Text>}
          {!!car.verification_note && <Text style={{ color: C.mid, marginTop: 6 }}>Last note: {car.verification_note}</Text>}
        </Section>

        <Section title={`Photos (${car.photos.length})`}>
          <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
            {car.photos.map((uri, i) => <Image key={uri + i} source={{ uri }} style={{ width: 200, height: 150, borderRadius: 10, backgroundColor: C.bg }} />)}
          </ScrollView>
        </Section>

        <Section title="Papers">
          {(["registration", "insurance"] as const).map(type => (
            <View key={type} style={{ marginBottom: 12 }}>
              <Text style={{ fontWeight: "700", color: C.dark, marginBottom: 6 }}>{LABELS.missing[type]} {car.documents[type] ? "" : "— not uploaded"}</Text>
              {car.documents[type] && (
                <View>
                  <Image source={{ uri: docUrl(type), headers }} style={{ width: "100%", height: 200, borderRadius: 10, backgroundColor: C.bg }} resizeMode="contain" />
                  <Text style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>A blank box means the file is a PDF — ask the owner for a photo if you can't open it.</Text>
                </View>
              )}
            </View>
          ))}
          <Row label="Insurance valid until" value={car.insurance_expiry ?? "—"} />
        </Section>

        <Section title="Details">
          <Row label="Type" value={`${car.type} · ${car.seats} seats`} />
          <Row label="Make / model / year" value={[car.make, car.model, car.year].filter(Boolean).join(" ")} />
          <Row label="Transmission / fuel" value={`${car.transmission ?? "—"} / ${car.fuel_type ?? "—"}`} />
          <Row label="Price per day" value={formatRwf(car.priceDay)} />
          <Row label="Deposit" value={formatRwf(car.caution)} />
          <Row label="Pickup" value={car.pickup_address ?? "—"} />
          {!!car.description && <Text style={{ color: C.dark, marginTop: 8 }}>{car.description}</Text>}
        </Section>

        <Section title="Owner rules">
          {car.rules.map((r, i) => <Text key={i} style={{ color: C.dark }}>• {r}</Text>)}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
            {ALLOWED_KEYS.map(k => (
              <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name={car.allowed[k] ? "checkmark-circle" : "close-circle"} size={14} color={car.allowed[k] ? C.green : C.orange} />
                <Text style={{ color: C.dark, fontSize: 12 }}>{LABELS.allowed[k]}</Text>
              </View>
            ))}
          </View>
        </Section>

        <Section title="Decision">
          <TextInput value={note} onChangeText={setNote} multiline maxLength={500} placeholder="Note to the owner (required to reject)" placeholderTextColor={C.muted}
            style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10, minHeight: 70, textAlignVertical: "top", color: C.dark, marginBottom: 10 }} />
          <View style={{ gap: 10 }}>
            <PrimaryButton label="Approve — make it live" color={C.green} busy={busy} disabled={car.missing.length > 0} onPress={() => review("approve")} />
            <SecondaryButton label="Reject with note" color={C.orange} onPress={() => review("reject")} />
          </View>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}
