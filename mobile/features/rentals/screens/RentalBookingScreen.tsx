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
import { CUSTOMER_CANCEL_REASONS, LABELS, RentalBooking, STATUS_META, apiError, formatWhen } from "../rentals";
import { Badge, Field, Header, PrimaryButton, Row, Section, SecondaryButton } from "../components/ui";
import { RentalRecordView } from "../components/RentalRecordView";
import { HelpTopicsCard } from "@/features/support";

/** One of my rentals: status, owner contact, price, records, cancel and rate (S24.4–S24.6) */
export default function RentalBookingScreen() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");

  const { data: b, isLoading, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.rentals.booking(id),
    queryFn: () => api.get<RentalBooking>(`/rentals/bookings/${id}`).then(r => r.data),
    refetchInterval: q => ((q.state.data as RentalBooking | undefined)?.status === "requested" ? 20_000 : false),
  });

  function done(updated: RentalBooking) {
    queryClient.setQueryData(queryKeys.rentals.booking(id), updated);
    queryClient.invalidateQueries({ queryKey: ["rentals", "bookings"] });
  }

  async function cancel(reason: string) {
    setCancelOpen(false);
    setBusy(true);
    try {
      done(await api.post<RentalBooking>(`/rentals/bookings/${id}/cancel`, { reason }).then(r => r.data));
    } catch (e) {
      Alert.alert(t("rental.cancelFailed", "Could not cancel"), apiError(e, t("rental.request.tryAgain", "Please try again.")));
    } finally {
      setBusy(false);
    }
  }

  async function rate() {
    if (!stars) return;
    setBusy(true);
    try {
      done(await api.post<RentalBooking>(`/rentals/bookings/${id}/rate`, { stars, comment: comment.trim() || null }).then(r => r.data));
    } catch (e) {
      Alert.alert(t("rental.rateFailed", "Could not save your rating"), apiError(e, ""));
    } finally {
      setBusy(false);
    }
  }

  if (isLoading || !b) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}><Header title={t("rental.myRental", "My rental")} /><ActivityIndicator color={C.teal} style={{ marginTop: 40 }} /></SafeAreaView>;
  }

  const meta = STATUS_META[b.status];
  const confirmed = b.status === "accepted" || b.status === "active" || b.status === "completed";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title={b.car?.name ?? t("rental.myRental", "My rental")} subtitle={`#${b.id}`} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}>
        <Section>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            {b.car?.photo ? <Image source={{ uri: b.car.photo }} style={{ width: 84, height: 64, borderRadius: 10, backgroundColor: C.bg }} />
              : <View style={{ width: 84, height: 64, borderRadius: 10, backgroundColor: C.tealLt, alignItems: "center", justifyContent: "center" }}><Ionicons name="car-sport" size={30} color={C.teal} /></View>}
            <View style={{ flex: 1, gap: 4 }}>
              <Badge label={meta.label} color={meta.color} bg={meta.bg} />
              <Text style={{ fontWeight: "900", fontSize: 16, color: C.dark }}>{b.car?.name}</Text>
              {!!b.car?.plate && <Text style={{ color: C.mid, fontWeight: "700" }}>{b.car.plate}</Text>}
            </View>
          </View>
          <StatusHint b={b} />
        </Section>

        <Section title={t("rental.dates.title2", "Dates")}>
          <Row label={t("rental.dates.pickup", "Pickup")} value={formatWhen(b.start_at, i18n.language)} />
          <Row label={t("rental.dates.return", "Return")} value={formatWhen(b.end_at, i18n.language)} />
          <Row label={b.pickup_method === "delivery" ? t("rental.deliveredTo", "Delivered to") : t("rental.pickupPlace", "Pickup place")}
            value={(b.pickup_method === "delivery" ? b.delivery_address : b.car?.pickup_address) ?? "—"} />
          {confirmed && b.car?.pickup_lat != null && b.pickup_method === "pickup" && (
            <TouchableOpacity onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${b.car!.pickup_lat},${b.car!.pickup_lng}`)}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
              <Ionicons name="navigate-outline" size={16} color={C.blue} />
              <Text style={{ color: C.blue, fontWeight: "700" }}>{t("rental.directions", "Directions to the car")}</Text>
            </TouchableOpacity>
          )}
        </Section>

        {b.owner && (
          <Section title={t("rental.owner", "Owner")}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Ionicons name="person-circle-outline" size={36} color={C.mid} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "800", color: C.dark }}>{b.owner.name}</Text>
                <Text style={{ color: C.mid, fontSize: 12 }}>{b.owner.phone ?? t("rental.phoneAfter", "Phone shared once the owner confirms")}</Text>
              </View>
              {!!b.owner.phone && (
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${b.owner!.phone}`)} accessibilityLabel={t("rental.callOwner", "Call the owner")}
                  style={{ backgroundColor: C.green, borderRadius: 20, width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="call" size={18} color={C.white} />
                </TouchableOpacity>
              )}
            </View>
          </Section>
        )}

        <Section title={t("rental.price", "Price")}>
          <Row label={`${formatRwf(b.quote.price_per_day)} × ${b.quote.days}`} value={formatRwf(b.quote.base)} />
          {b.quote.discount > 0 && <Row label={t("rental.discount2", "Discount")} value={`−${formatRwf(b.quote.discount)}`} color={C.green} />}
          {b.quote.delivery_fee > 0 && <Row label={t("rental.deliveryFee", "Delivery")} value={formatRwf(b.quote.delivery_fee)} />}
          <Row label={t("rental.jaliFee", "Jali fee")} value={formatRwf(0)} color={C.green} />
          <Row label={t("rental.total", "Total")} value={formatRwf(b.total)} bold />
          {b.extra_charges.map((c, i) => <Row key={i} label={c.label} value={formatRwf(c.amount)} color={C.orange} />)}
          {b.final_total != null && <Row label={t("rental.finalTotal", "Final total")} value={formatRwf(b.final_total)} bold />}
          {b.deposit > 0 && <Row label={t("rental.deposit", "Refundable deposit")} value={formatRwf(b.deposit)} />}
          <Row label={t("rental.payment", "Payment to owner")} value={b.payment_method === "momo" ? "MoMo" : t("rental.cash", "Cash")} />
          {b.cancel_fee > 0 && <Row label={t("rental.cancelFee", "Cancellation fee (to owner)")} value={formatRwf(b.cancel_fee)} color={C.orange} />}
        </Section>

        <Section title={t("rental.rules", "Rules & policies")}>
          {b.terms.rules.map((r, i) => <Text key={i} style={{ color: C.dark, marginBottom: 4 }}>• {r}</Text>)}
          <Text style={{ color: C.mid, fontSize: 12, marginTop: 4 }}>
            {b.terms.mileage_limit_km ? `${b.terms.mileage_limit_km} km/day · ` : ""}{b.terms.fuel_policy ? LABELS.fuelPolicy[b.terms.fuel_policy] : ""}
          </Text>
          {b.terms.cancellation_policy && <Text style={{ color: C.mid, fontSize: 12, marginTop: 4 }}>{LABELS.cancellation[b.terms.cancellation_policy]}</Text>}
        </Section>

        {b.handover && <RentalRecordView title={t("rental.handover", "Handover")} record={b.handover} />}
        {b.return_record && <RentalRecordView title={t("rental.returned", "Return")} record={b.return_record} />}

        {b.status === "completed" && b.my_rating == null && (
          <Section title={t("rental.rateTitle", "How was the car?")}>
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 10 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <TouchableOpacity key={n} onPress={() => setStars(n)} accessibilityLabel={`${n} stars`}>
                  <Ionicons name={n <= stars ? "star" : "star-outline"} size={34} color={C.orange} />
                </TouchableOpacity>
              ))}
            </View>
            <Field label={t("rental.comment", "Comment (optional)")} value={comment} onChangeText={setComment} maxLength={500} />
            <PrimaryButton label={t("rental.rateSend", "Send rating")} disabled={!stars} busy={busy} onPress={rate} />
          </Section>
        )}
        {b.my_rating != null && <Text style={{ textAlign: "center", color: C.mid }}>{t("rental.youRated", { stars: b.my_rating, defaultValue: `You rated ${b.my_rating}★` })}</Text>}

        {b.can_cancel && (
          <SecondaryButton icon="close-circle-outline" color={C.orange} onPress={() => setCancelOpen(true)}
            label={b.cancel_fee_now ? t("rental.cancelWithFee", { fee: formatRwf(b.cancel_fee_now), defaultValue: `Cancel (fee ${formatRwf(b.cancel_fee_now)})` }) : t("rental.cancelFree", "Cancel for free")} />
        )}
        <HelpTopicsCard service="rental" />
      </ScrollView>

      <Modal visible={cancelOpen} transparent animationType="fade" onRequestClose={() => setCancelOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: C.white, borderRadius: 20, padding: 18 }}>
            <Text style={{ fontWeight: "900", fontSize: 17, color: C.dark, marginBottom: 4 }}>{t("rental.cancelWhy", "Why are you cancelling?")}</Text>
            {!!b.cancel_fee_now && <Text style={{ color: C.orange, marginBottom: 10 }}>
              {t("rental.cancelFeeWarn", { fee: formatRwf(b.cancel_fee_now), defaultValue: `By the owner's policy you will owe the owner ${formatRwf(b.cancel_fee_now)}.` })}
            </Text>}
            {CUSTOMER_CANCEL_REASONS.map(r => (
              <TouchableOpacity key={r} onPress={() => cancel(r)} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
                <Text style={{ color: C.dark, fontWeight: "600" }}>{LABELS.customerCancel[r]}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setCancelOpen(false)} style={{ paddingTop: 14, alignItems: "center" }}>
              <Text style={{ color: C.mid, fontWeight: "800" }}>{t("rental.keep", "Keep my rental")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatusHint({ b }: { b: RentalBooking }) {
  const { t, i18n } = useTranslation();
  const text = (() => {
    switch (b.status) {
      case "requested":
        return t("rental.hint.requested", { time: b.expires_at ? formatWhen(b.expires_at, i18n.language) : "", defaultValue: `The owner has until ${b.expires_at ? formatWhen(b.expires_at, i18n.language) : "soon"} to answer. We'll notify you.` });
      case "accepted":
        return t("rental.hint.accepted", "Confirmed! Call the owner to agree the handover. Bring your driving licence and ID.");
      case "active":
        return t("rental.hint.active", "Enjoy your trip. Return the car on time with the agreed fuel level.");
      case "completed":
        return t("rental.hint.completed", "Thanks for renting with Jali.");
      case "declined":
        return t("rental.hint.declined", "The owner can't rent the car on these dates. Try another car.") + (b.decline_reason ? ` (${b.decline_reason})` : "");
      case "expired":
        return t("rental.hint.expired", "The owner didn't answer in time. Try another car.");
      case "cancelled":
        return b.cancelled_by === "owner" ? t("rental.hint.ownerCancelled", "The owner cancelled. Nothing is owed.") : t("rental.hint.cancelled", "You cancelled this rental.");
    }
  })();
  return <Text style={{ color: C.mid, marginTop: 12 }}>{text}</Text>;
}
