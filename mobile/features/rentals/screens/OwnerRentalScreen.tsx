import { useState } from "react";
import { View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator, Alert, Linking, Modal, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { formatRwf } from "@/lib/fare";
import { LABELS, OWNER_CANCEL_REASONS, OWNER_STATUS_LABEL, PickedFile, RentalBooking, STATUS_META, apiError, appendFile, formatWhen, fuelLabel, pickPhotos } from "../rentals";
import { Badge, Field, Header, NumberField, PrimaryButton, Row, Section, SecondaryButton } from "../components/ui";
import { RentalRecordView } from "../components/RentalRecordView";

type RecordMode = "handover" | "return" | null;

/** Owner: one rental — accept/decline, contact, handover and return records, rate (S24.4–S24.7) */
export default function OwnerRentalScreen() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<RecordMode>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [stars, setStars] = useState(0);

  const { data: b, isLoading, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.driver.rental(id),
    queryFn: () => api.get<RentalBooking>(`/driver/rentals/${id}`).then(r => r.data),
  });

  function done(updated: RentalBooking) {
    queryClient.setQueryData(queryKeys.driver.rental(id), updated);
    queryClient.invalidateQueries({ queryKey: ["driver", "rentals"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.driver.rentalSummary() });
    queryClient.invalidateQueries({ queryKey: queryKeys.driver.cars() });
  }

  async function act(path: string, body?: object) {
    setBusy(true);
    try {
      done(await api.post<RentalBooking>(`/driver/rentals/${id}/${path}`, body ?? {}).then(r => r.data));
    } catch (e) {
      Alert.alert(t("rental.owner.actionFailed", "Something went wrong"), apiError(e, t("rental.request.tryAgain", "Please try again.")));
    } finally {
      setBusy(false);
    }
  }

  function decline() {
    Alert.alert(t("rental.owner.declineTitle", "Decline this request?"), t("rental.owner.declineText", "The customer will look for another car."), [
      { text: t("profile.cancel", "Cancel"), style: "cancel" },
      { text: t("rental.owner.decline", "Decline"), style: "destructive", onPress: () => act("decline", { reason: null }) },
    ]);
  }

  if (isLoading || !b) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}><Header title={t("rental.owner.rental", "Rental")} /><ActivityIndicator color={C.teal} style={{ marginTop: 40 }} /></SafeAreaView>;
  }
  const meta = STATUS_META[b.status];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title={b.car?.name ?? t("rental.owner.rental", "Rental")} subtitle={`#${b.id} · ${b.car?.plate ?? ""}`} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}>
        <Section>
          <Badge label={OWNER_STATUS_LABEL[b.status] ?? meta.label} color={meta.color} bg={meta.bg} />
          <View style={{ marginTop: 10 }}>
            <Row label={t("rental.dates.pickup", "Pickup")} value={formatWhen(b.start_at, i18n.language)} />
            <Row label={t("rental.dates.return", "Return")} value={formatWhen(b.end_at, i18n.language)} />
            <Row label={t("rental.days2", "Days")} value={String(b.days)} />
            <Row label={b.pickup_method === "delivery" ? t("rental.deliverTo", "Deliver to") : t("rental.pickupPlace", "Pickup place")}
              value={(b.pickup_method === "delivery" ? b.delivery_address : b.car?.pickup_address) ?? "—"} />
            {b.status === "requested" && b.expires_at && <Row label={t("rental.owner.answerBy", "Answer by")} value={formatWhen(b.expires_at, i18n.language)} color={C.orange} />}
          </View>
          {!!b.note && <View style={{ backgroundColor: C.bg, borderRadius: 10, padding: 10, marginTop: 8 }}><Text style={{ color: C.dark }}>“{b.note}”</Text></View>}
        </Section>

        {b.customer && (
          <Section title={t("rental.owner.customer", "Customer")}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Ionicons name="person-circle-outline" size={36} color={C.mid} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "800", color: C.dark }}>{b.customer.name}</Text>
                <Text style={{ color: C.mid, fontSize: 12 }}>
                  {b.customer.completed_rentals} {t("rental.owner.pastRentals", "past rentals")}{b.customer.rating ? ` · ${b.customer.rating}★` : ""}
                </Text>
                <Text style={{ color: C.mid, fontSize: 12 }}>{b.customer.phone ?? t("rental.owner.phoneAfter", "Phone shared when you accept")}</Text>
              </View>
              {!!b.customer.phone && (
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${b.customer!.phone}`)} accessibilityLabel={t("rental.owner.call", "Call the customer")}
                  style={{ backgroundColor: C.green, borderRadius: 20, width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="call" size={18} color={C.white} />
                </TouchableOpacity>
              )}
            </View>
          </Section>
        )}

        <Section title={t("rental.price", "Price")}>
          <Row label={`${formatRwf(b.quote.price_per_day)} × ${b.quote.days}`} value={formatRwf(b.quote.base)} />
          {b.quote.discount > 0 && <Row label={t("rental.discount2", "Discount")} value={`−${formatRwf(b.quote.discount)}`} />}
          {b.quote.delivery_fee > 0 && <Row label={t("rental.deliveryFee", "Delivery")} value={formatRwf(b.quote.delivery_fee)} />}
          <Row label={t("rental.owner.youGet", "You receive")} value={formatRwf(b.total)} bold />
          {b.extra_charges.map((c, i) => <Row key={i} label={c.label} value={formatRwf(c.amount)} />)}
          {b.final_total != null && <Row label={t("rental.finalTotal", "Final total")} value={formatRwf(b.final_total)} bold />}
          {b.deposit > 0 && <Row label={t("rental.owner.collectDeposit", "Deposit to collect")} value={formatRwf(b.deposit)} />}
          <Row label={t("rental.owner.paidBy", "Paid by")} value={b.payment_method === "momo" ? "MoMo" : t("rental.cash", "Cash")} />
          {b.cancel_fee > 0 && <Row label={t("rental.owner.cancelFeeOwed", "Cancellation fee owed to you")} value={formatRwf(b.cancel_fee)} color={C.green} />}
        </Section>

        {b.handover && <RentalRecordView title={t("rental.handover", "Handover")} record={b.handover} />}
        {b.return_record && <RentalRecordView title={t("rental.returned", "Return")} record={b.return_record} />}

        {b.can_accept && (
          <View style={{ gap: 10 }}>
            <PrimaryButton label={t("rental.owner.accept", "Accept request")} icon="checkmark-circle-outline" busy={busy} onPress={() => act("accept")} color={C.green} />
            <SecondaryButton label={t("rental.owner.decline", "Decline")} icon="close-circle-outline" color={C.orange} onPress={decline} />
          </View>
        )}
        {b.status === "accepted" && (
          <View style={{ gap: 10 }}>
            {b.can_handover
              ? <PrimaryButton label={t("rental.owner.handover", "Hand over the car")} icon="key-outline" onPress={() => setMode("handover")} />
              : <Text style={{ color: C.mid, textAlign: "center" }}>{t("rental.owner.handoverLater", "You can record the handover from 24 h before pickup.")}</Text>}
            <SecondaryButton label={t("rental.owner.cancel", "Cancel this rental")} icon="close-circle-outline" color={C.orange} onPress={() => setCancelOpen(true)} />
          </View>
        )}
        {b.can_return && <PrimaryButton label={t("rental.owner.return", "Car returned — check it in")} icon="flag-outline" onPress={() => setMode("return")} />}

        {b.status === "completed" && b.my_rating == null && (
          <Section title={t("rental.owner.rateCustomer", "Rate the customer")}>
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 10 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <TouchableOpacity key={n} onPress={() => setStars(n)} accessibilityLabel={`${n} stars`}>
                  <Ionicons name={n <= stars ? "star" : "star-outline"} size={32} color={C.orange} />
                </TouchableOpacity>
              ))}
            </View>
            <PrimaryButton label={t("rental.rateSend", "Send rating")} disabled={!stars} busy={busy} onPress={() => act("rate", { stars })} />
          </Section>
        )}
      </ScrollView>

      <RecordModal mode={mode} booking={b} onClose={() => setMode(null)} onDone={updated => { setMode(null); done(updated); }} />

      <Modal visible={cancelOpen} transparent animationType="fade" onRequestClose={() => setCancelOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: C.white, borderRadius: 20, padding: 18 }}>
            <Text style={{ fontWeight: "900", fontSize: 17, color: C.dark, marginBottom: 4 }}>{t("rental.owner.cancelWhy", "Why are you cancelling?")}</Text>
            <Text style={{ color: C.orange, marginBottom: 8 }}>{t("rental.owner.cancelWarn", "The customer is told right away. Cancelling confirmed rentals often hurts your listing.")}</Text>
            {OWNER_CANCEL_REASONS.map(r => (
              <TouchableOpacity key={r} onPress={() => { setCancelOpen(false); act("cancel", { reason: r }); }} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
                <Text style={{ color: C.dark, fontWeight: "600" }}>{LABELS.ownerCancel[r]}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setCancelOpen(false)} style={{ paddingTop: 14, alignItems: "center" }}>
              <Text style={{ color: C.mid, fontWeight: "800" }}>{t("rental.owner.keep", "Keep the rental")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/** Odometer, fuel, notes, photos (and extra charges at return) */
function RecordModal({ mode, booking, onClose, onDone }: { mode: RecordMode; booking: RentalBooking; onClose: () => void; onDone: (b: RentalBooking) => void }) {
  const { t } = useTranslation();
  const [odometer, setOdometer] = useState<number | null>(null);
  const [fuel, setFuel] = useState(8);
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<PickedFile[]>([]);
  const [charges, setCharges] = useState<{ label: string; amount: number | null }[]>([]);
  const [sending, setSending] = useState(false);
  const startKm = booking.handover?.odometer_km ?? null;

  async function addPhotos(camera: boolean) {
    const more = await pickPhotos({ camera, max: 8 - photos.length });
    setPhotos(p => [...p, ...more].slice(0, 8));
  }

  async function submit() {
    if (odometer === null) return Alert.alert(t("rental.record.odometerTitle", "Odometer"), t("rental.record.odometerText", "Enter the kilometres on the dashboard."));
    setSending(true);
    try {
      const form = new FormData();
      form.append("odometer_km", String(odometer));
      form.append("fuel_level", String(fuel));
      if (notes.trim()) form.append("notes", notes.trim());
      for (const p of photos) await appendFile(form, "photos[]", p);
      charges.filter(c => c.label.trim() && c.amount).forEach((c, i) => {
        form.append(`other_charges[${i}][label]`, c.label.trim());
        form.append(`other_charges[${i}][amount]`, String(c.amount));
      });
      const updated = await api.post<RentalBooking>(`/driver/rentals/${booking.id}/${mode}`, form, { headers: { "Content-Type": "multipart/form-data" }, timeout: 90_000 }).then(r => r.data);
      setOdometer(null); setNotes(""); setPhotos([]); setCharges([]);
      onDone(updated);
    } catch (e) {
      Alert.alert(t("rental.record.failed", "Could not save"), apiError(e, t("rental.request.tryAgain", "Please try again.")));
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible={!!mode} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ flexDirection: "row", alignItems: "center", padding: 16, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <Text style={{ flex: 1, fontWeight: "900", fontSize: 18, color: C.dark }}>
            {mode === "handover" ? t("rental.record.handoverTitle", "Hand over the car") : t("rental.record.returnTitle", "Check the car in")}
          </Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel={t("common.close", "Close")}><Ionicons name="close" size={26} color={C.dark} /></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Section hint={mode === "handover"
            ? t("rental.record.handoverHint", "Walk around the car with the customer. Photograph every side and any scratch. Check their driving licence and ID.")
            : t("rental.record.returnHint", "Check the car together. Late return and extra kilometres are added automatically.")}>
            <NumberField label={t("rental.odometer", "Odometer")} suffix="km" value={odometer} onChange={setOdometer}
              hint={startKm != null ? t("rental.record.atHandover", { km: startKm, defaultValue: `At handover: ${startKm} km` }) : undefined} />
            <Text style={{ color: C.mid, fontSize: 12, fontWeight: "700", marginBottom: 6 }}>{t("rental.fuelLevel", "Fuel")} · {fuelLabel(fuel)}</Text>
            <View style={{ flexDirection: "row", gap: 4, marginBottom: 12 }}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                <TouchableOpacity key={n} onPress={() => setFuel(n)} accessibilityLabel={fuelLabel(n)}
                  style={{ flex: 1, height: 30, borderRadius: 6, backgroundColor: n <= fuel ? C.teal : C.border }} />
              ))}
            </View>
            <Field label={t("rental.record.notes", "Notes (scratches, cleanliness…)")} value={notes} onChangeText={setNotes} multiline maxLength={1000} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {photos.map((p, i) => (
                <TouchableOpacity key={p.uri} onPress={() => setPhotos(ps => ps.filter((_, j) => j !== i))} accessibilityLabel={`Remove photo ${i + 1}`}>
                  <Image source={{ uri: p.uri }} style={{ width: 80, height: 60, borderRadius: 8 }} />
                </TouchableOpacity>
              ))}
              {photos.length < 8 && (
                <>
                  <TouchableOpacity onPress={() => addPhotos(true)} style={{ width: 80, height: 60, borderRadius: 8, backgroundColor: C.tealLt, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="camera-outline" size={22} color={C.teal} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => addPhotos(false)} style={{ width: 80, height: 60, borderRadius: 8, backgroundColor: C.tealLt, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="images-outline" size={22} color={C.teal} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </Section>
          {mode === "return" && (
            <Section title={t("rental.record.otherCharges", "Other charges")} hint={t("rental.record.otherHint", "Fuel, cleaning or damage agreed with the customer.")}>
              {charges.map((c, i) => (
                <View key={i} style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 2 }}><Field label={t("rental.record.what", "What")} value={c.label} onChangeText={v => setCharges(cs => cs.map((x, j) => (j === i ? { ...x, label: v } : x)))} maxLength={80} /></View>
                  <View style={{ flex: 1 }}><NumberField label="RWF" value={c.amount} onChange={v => setCharges(cs => cs.map((x, j) => (j === i ? { ...x, amount: v } : x)))} /></View>
                </View>
              ))}
              {charges.length < 5 && <SecondaryButton icon="add" label={t("rental.record.addCharge", "Add a charge")} onPress={() => setCharges(cs => [...cs, { label: "", amount: null }])} />}
            </Section>
          )}
          <PrimaryButton label={mode === "handover" ? t("rental.record.confirmHandover", "Confirm handover") : t("rental.record.confirmReturn", "Confirm return")} busy={sending} onPress={submit} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
