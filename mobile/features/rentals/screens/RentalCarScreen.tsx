import { useState } from "react";
import { View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator, Alert, Linking, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { formatRwf } from "@/lib/fare";
import { ALLOWED_KEYS, LABELS, RentalBooking, RentalCarDetail, apiError, carTitle, formatDate } from "../rentals";
import { RentalDatesPicker, RentalDates, datesToIso, defaultDates } from "../components/RentalDatesPicker";
import { Chip, Field, Header, PrimaryButton, Row, Section } from "../components/ui";

/** Isostring in Kigali → picker value */
function toDates(start?: string, end?: string): RentalDates {
  if (!start || !end) return defaultDates();
  const k = (iso: string) => new Date(new Date(iso).getTime() + 120 * 60_000).toISOString();
  const s = k(start), e = k(end);
  return { startDate: s.slice(0, 10), startTime: s.slice(11, 16), endDate: e.slice(0, 10), endTime: e.slice(11, 16) };
}

/** Car detail, owner rules and the rental request (stories S24.1, S24.3, S24.4) */
export default function RentalCarScreen() {
  const { t, i18n } = useTranslation();
  const { width } = useWindowDimensions();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ id: string; start_at?: string; end_at?: string }>();
  const id = Number(params.id);
  const [dates, setDates] = useState<RentalDates>(() => toDates(params.start_at, params.end_at));
  const [delivery, setDelivery] = useState(false);
  const [address, setAddress] = useState("");
  const [payment, setPayment] = useState<"cash" | "momo">("momo");
  const [note, setNote] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [driverOk, setDriverOk] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [sending, setSending] = useState(false);

  const range = datesToIso(dates);
  const query = { ...range, pickup_method: delivery ? "delivery" : "pickup" };
  const { data: car, isLoading, error } = useQuery({
    queryKey: queryKeys.rentals.car(id, query),
    queryFn: () => api.get<RentalCarDetail>(`/rentals/cars/${id}`, { params: query }).then(r => r.data),
    placeholderData: prev => prev,
  });

  async function request() {
    if (!car) return;
    if (!acceptTerms || !driverOk) {
      Alert.alert(t("rental.request.confirmTitle", "Please confirm"), t("rental.request.confirmText", "Tick both boxes to agree to the owner's rules and the driver requirements."));
      return;
    }
    if (delivery && address.trim().length < 5) {
      Alert.alert(t("rental.request.addressTitle", "Delivery address"), t("rental.request.addressText", "Tell the owner where to bring the car."));
      return;
    }
    setSending(true);
    try {
      const booking = await api.post<RentalBooking>("/rentals/bookings", {
        car_id: car.id, ...range, pickup_method: delivery ? "delivery" : "pickup",
        delivery_address: delivery ? address.trim() : null, payment_method: payment, note: note.trim() || null,
        accept_terms: true, driver_confirmed: true,
      }).then(r => r.data);
      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      router.replace({ pathname: "/rental/[id]", params: { id: String(booking.id) } } as any);
    } catch (e) {
      Alert.alert(t("rental.request.failed", "Could not send the request"), apiError(e, t("rental.request.tryAgain", "Please try again.")));
    } finally {
      setSending(false);
    }
  }

  if (isLoading && !car) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}><Header title={t("rental.car", "Car")} /><ActivityIndicator color={C.teal} style={{ marginTop: 40 }} /></SafeAreaView>;
  }
  if (!car) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <Header title={t("rental.car", "Car")} />
        <Text style={{ color: C.orange, textAlign: "center", marginTop: 40, paddingHorizontal: 24 }}>{apiError(error, t("rental.carMissing", "This car is no longer available."))}</Text>
      </SafeAreaView>
    );
  }

  const q = car.quote;
  const terms = car.terms;
  const photos = car.photos;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top", "bottom"]}>
      <Header title={carTitle(car)} subtitle={car.pickup_address ?? car.city ?? undefined} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Photos */}
        {photos.length > 0 ? (
          <View>
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={e => setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / width))}>
              {photos.map((uri, i) => (
                <Image key={uri + i} source={{ uri }} style={{ width, height: 240, backgroundColor: C.border }} resizeMode="cover"
                  accessibilityLabel={`${car.name} photo ${i + 1}`} />
              ))}
            </ScrollView>
            <View style={{ position: "absolute", bottom: 10, alignSelf: "center", flexDirection: "row", gap: 5 }}>
              {photos.map((_, i) => (
                <View key={i} style={{ width: i === photoIndex ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: i === photoIndex ? C.white : "rgba(255,255,255,0.6)" }} />
              ))}
            </View>
          </View>
        ) : (
          <View style={{ height: 160, backgroundColor: C.tealLt, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="car-sport" size={64} color={C.teal} />
          </View>
        )}

        <View style={{ padding: 16, gap: 12 }}>
          {/* Title & owner */}
          <View>
            <Text style={{ fontSize: 22, fontWeight: "900", color: C.dark }}>{carTitle(car)}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
              {car.trips_count > 0 ? (
                <>
                  <Ionicons name="star" size={14} color={C.orange} />
                  <Text style={{ color: C.dark, fontWeight: "700" }}>{car.rating.toFixed(1)}</Text>
                  <Text style={{ color: C.mid }}>· {t("rental.trips", { count: car.trips_count, defaultValue: `${car.trips_count} trips` })}</Text>
                </>
              ) : <Text style={{ color: C.mid }}>{t("rental.newCar", "New on Jali")}</Text>}
              {car.owner && <Text style={{ color: C.mid }}>· {t("rental.hostedBy", { name: car.owner.first_name, defaultValue: `Owner: ${car.owner.first_name}` })}</Text>}
            </View>
          </View>

          {/* Specs */}
          <Section title={t("rental.details", "Car details")}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              <Spec icon="car-outline" label={car.type} />
              <Spec icon="people-outline" label={t("rental.seats", { count: car.seats, defaultValue: `${car.seats} seats` })} />
              {car.transmission && <Spec icon="cog-outline" label={LABELS.transmission[car.transmission]} />}
              {car.fuel_type && <Spec icon="water-outline" label={LABELS.fuel[car.fuel_type]} />}
              {car.doors != null && <Spec icon="exit-outline" label={t("rental.doors", { count: car.doors, defaultValue: `${car.doors} doors` })} />}
              {car.luggage != null && <Spec icon="briefcase-outline" label={t("rental.bags", { count: car.luggage, defaultValue: `${car.luggage} bags` })} />}
              {car.color && <Spec icon="color-palette-outline" label={car.color} />}
            </View>
            {!!car.description && <Text style={{ color: C.dark, marginTop: 12, lineHeight: 20 }}>{car.description}</Text>}
            {car.amenities.length > 0 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                {car.amenities.map(a => (
                  <View key={a} style={{ backgroundColor: C.tealLt, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Ionicons name="checkmark" size={12} color={C.teal} />
                    <Text style={{ color: C.teal, fontSize: 12, fontWeight: "700" }}>{a}</Text>
                  </View>
                ))}
              </View>
            )}
          </Section>

          {/* Dates & price */}
          <Section title={t("rental.yourTrip", "Your trip")}>
            <RentalDatesPicker value={dates} onChange={setDates} />
            {car.available === false && (
              <Text style={{ color: C.orange, fontWeight: "700", marginTop: 8 }}>{t("rental.notFree", "This car is not free on these dates. Pick other dates.")}</Text>
            )}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <Chip icon="location-outline" label={t("rental.pickupAtOwner", "I pick it up")} on={!delivery} onPress={() => setDelivery(false)} />
              {car.delivery_available && (
                <Chip icon="navigate-outline" label={t("rental.delivery", { fee: formatRwf(car.delivery_fee), defaultValue: `Deliver to me (+${formatRwf(car.delivery_fee)})` })}
                  on={delivery} onPress={() => setDelivery(true)} />
              )}
            </View>
            {delivery && <View style={{ marginTop: 10 }}><Field label={t("rental.deliveryAddress", "Delivery address")} value={address} onChangeText={setAddress} placeholder="Hotel, street, landmark" maxLength={255} /></View>}
            {q && (
              <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 }}>
                <Row label={`${formatRwf(q.price_per_day)} × ${q.days} ${q.days > 1 ? "days" : "day"}`} value={formatRwf(q.base)} />
                {q.discount > 0 && <Row label={t("rental.discount", { pct: q.discount_pct, defaultValue: `Long rental discount (${q.discount_pct}%)` })} value={`−${formatRwf(q.discount)}`} color={C.green} />}
                {q.delivery_fee > 0 && <Row label={t("rental.deliveryFee", "Delivery")} value={formatRwf(q.delivery_fee)} />}
                <Row label={t("rental.jaliFee", "Jali fee")} value={formatRwf(0)} color={C.green} />
                <Row label={t("rental.total", "Total")} value={formatRwf(q.total)} bold />
                {q.deposit > 0 && <Text style={{ color: C.mid, fontSize: 12, marginTop: 6 }}>
                  {t("rental.depositNote", { amount: formatRwf(q.deposit), defaultValue: `Refundable deposit of ${formatRwf(q.deposit)} paid to the owner at pickup and returned when the car comes back in good condition.` })}
                </Text>}
              </View>
            )}
          </Section>

          {/* Rules */}
          <Section title={t("rental.rules", "Rules & policies")}>
            {terms.rules.map((rule, i) => (
              <View key={i} style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
                <Ionicons name="alert-circle-outline" size={16} color={C.orange} style={{ marginTop: 2 }} />
                <Text style={{ flex: 1, color: C.dark }}>{rule}</Text>
              </View>
            ))}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 6 }}>
              {ALLOWED_KEYS.map(k => (
                <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Ionicons name={terms.allowed[k] ? "checkmark-circle" : "close-circle"} size={14} color={terms.allowed[k] ? C.green : C.orange} />
                  <Text style={{ color: C.dark, fontSize: 12 }}>{LABELS.allowed[k]}</Text>
                </View>
              ))}
            </View>
            <Row label={t("rental.mileage", "Mileage")} value={terms.mileage_limit_km ? `${terms.mileage_limit_km} km/day` : t("rental.unlimited", "Unlimited")} />
            {!!terms.mileage_limit_km && terms.extra_km_fee > 0 && <Row label={t("rental.extraKm", "Extra km")} value={`${formatRwf(terms.extra_km_fee)}/km`} />}
            {terms.fuel_policy && <Row label={t("rental.fuel", "Fuel")} value={LABELS.fuelPolicy[terms.fuel_policy]} />}
            <Row label={t("rental.driver", "Driver")} value={t("rental.driverReq", { age: terms.min_driver_age, years: terms.min_licence_years, defaultValue: `${terms.min_driver_age}+ years, licence ${terms.min_licence_years}+ years` })} />
            <Row label={t("rental.rentalLength", "Rental length")} value={car.max_days ? `${car.min_days}–${car.max_days} days` : `${car.min_days}+ days`} />
            {car.notice_hours > 0 && <Row label={t("rental.notice", "Book at least")} value={t("rental.noticeValue", { count: car.notice_hours, defaultValue: `${car.notice_hours} h ahead` })} />}
            {terms.cancellation_policy && <Text style={{ color: C.mid, fontSize: 12, marginTop: 8 }}>{LABELS.cancellation[terms.cancellation_policy]}</Text>}
          </Section>

          {/* Pickup */}
          {(car.pickup_address || car.pickup_lat) && (
            <Section title={t("rental.pickupPlace", "Pickup place")}>
              <Text style={{ color: C.dark }}>{car.pickup_address}</Text>
              <Text style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{t("rental.exactAfter", "The exact spot and the owner's phone are shared once the owner confirms.")}</Text>
              {car.pickup_lat != null && car.pickup_lng != null && (
                <TouchableOpacity onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${car.pickup_lat},${car.pickup_lng}`)}
                  style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="map-outline" size={16} color={C.blue} />
                  <Text style={{ color: C.blue, fontWeight: "700" }}>{t("rental.seeArea", "See the area on the map")}</Text>
                </TouchableOpacity>
              )}
            </Section>
          )}

          {/* Busy calendar */}
          {car.busy.length > 0 && (
            <Section title={t("rental.booked", "Already booked")}>
              {car.busy.slice(0, 8).map((b, i) => (
                <Text key={i} style={{ color: C.mid, marginBottom: 4 }}>
                  {formatDate(b.start, i18n.language)} → {formatDate(b.end, i18n.language)}
                </Text>
              ))}
            </Section>
          )}

          {/* Request */}
          <Section title={t("rental.request.title", "Request this car")}>
            <Text style={{ color: C.mid, fontSize: 12, marginBottom: 8 }}>{t("rental.request.payHint", "You pay the owner at pickup. How?")}</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              <Chip icon="phone-portrait-outline" label="MoMo" on={payment === "momo"} onPress={() => setPayment("momo")} />
              <Chip icon="cash-outline" label={t("rental.cash", "Cash")} on={payment === "cash"} onPress={() => setPayment("cash")} />
            </View>
            <Field label={t("rental.request.note", "Message to the owner (optional)")} value={note} onChangeText={setNote} multiline maxLength={500}
              placeholder={t("rental.request.notePlaceholder", "Where are you going? Flight number?")} />
            <Check on={acceptTerms} onPress={() => setAcceptTerms(!acceptTerms)} label={t("rental.request.acceptRules", "I accept the owner's rules and policies above")} />
            <Check on={driverOk} onPress={() => setDriverOk(!driverOk)}
              label={t("rental.request.driverOk", { age: terms.min_driver_age, years: terms.min_licence_years, defaultValue: `The driver is at least ${terms.min_driver_age} and has had a licence for ${terms.min_licence_years}+ years` })} />
            <View style={{ marginTop: 8 }}>
              <PrimaryButton label={q ? t("rental.request.send", { total: formatRwf(q.total), defaultValue: `Send request · ${formatRwf(q.total)}` }) : t("rental.request.sendNoPrice", "Send request")}
                busy={sending} disabled={car.available === false} onPress={request} icon="paper-plane-outline" />
            </View>
            <Text style={{ color: C.muted, fontSize: 11, marginTop: 8, textAlign: "center" }}>
              {t("rental.request.ownerAnswers", "The owner answers within 12 hours. Nothing is charged by Jali.")}
            </Text>
          </Section>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Spec({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.bg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
      <Ionicons name={icon} size={15} color={C.mid} />
      <Text style={{ color: C.dark, fontWeight: "600", fontSize: 13 }}>{label}</Text>
    </View>
  );
}

function Check({ on, onPress, label }: { on: boolean; onPress: () => void; label: string }) {
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
      style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 6 }}>
      <Ionicons name={on ? "checkbox" : "square-outline"} size={22} color={on ? C.teal : C.muted} />
      <Text style={{ flex: 1, color: C.dark }}>{label}</Text>
    </TouchableOpacity>
  );
}
