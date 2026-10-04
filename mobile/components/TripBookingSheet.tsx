import { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import { PAY_METHODS, PayMethod } from "@/constants/data";
import { tripServiceFee } from "@/lib/serviceFee";
import api from "@/lib/api";
import { getApiToken } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { Toast, ToastHandle } from "@/components/Toast";

type TripData = {
  id: number; // trip_departure_id — used as reference_id when booking
  agency_id?: number;
  agency_name: string;
  agency_rating: number;
  agency_ratings_count: number;
  from: { name: string; city: string };
  to: { name: string; city: string };
  departure_time: string;
  estimated_arrival_time: string;
  price: number;
};

const BASE_DATE_OPTS = ["Today", "Tomorrow"];

interface Props {
  trip: TripData;
  onClose: () => void;
  onConfirm: () => void;
  travelDate?: string;
}

export function TripBookingSheet({ trip, onClose, onConfirm, travelDate }: Props) {
  const { t } = useTranslation();
  const toastRef = useRef<ToastHandle>(null);

  // Pre-fill passenger 1 with the user's profile name (cached from /me)
  const queryClient = useQueryClient();
  const cachedMe = queryClient.getQueryData<{ name?: string }>(queryKeys.me());
  const { data: me } = useQuery({
    queryKey: queryKeys.me(),
    queryFn: () => api.get("/me").then(r => r.data),
    staleTime: Infinity,
  });
  const userName = me?.name ?? cachedMe?.name ?? "";

  const [payMethod, setPayMethod] = useState<PayMethod | null>(null);
  const [loading, setLoading] = useState(false);
  const [ticketCount, setTicketCount] = useState(1);
  const [passengerNames, setPassengerNames] = useState<string[]>(() => [userName]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // If /me wasn't cached on mount, fill in passenger 0 once it loads (only if still empty)
  useEffect(() => {
    if (me?.name) {
      setPassengerNames(prev => {
        if (prev[0]) return prev; // user already typed something — don't overwrite
        const next = [...prev];
        next[0] = me.name;
        return next;
      });
    }
  }, [me?.name]);
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const price = Number(trip.price); // API may return string — force numeric
  const fee = tripServiceFee(price);
  const totalPrice = price * ticketCount;
  const total = totalPrice + fee;

  // Normalise "Today · 07:00" → "Today" so it matches dateOpts without duplication
  const normalizedDate = travelDate?.startsWith("Today")
    ? "Today"
    : travelDate?.startsWith("Tomorrow")
      ? "Tomorrow"
      : (travelDate ?? "Today");
  const [selectedDate, setSelectedDate] = useState(normalizedDate);
  const dateOpts = BASE_DATE_OPTS.includes(normalizedDate)
    ? BASE_DATE_OPTS
    : [normalizedDate, ...BASE_DATE_OPTS].filter(Boolean) as string[];

  function updatePassengerName(index: number, name: string) {
    setPassengerNames(prev => {
      const next = [...prev];
      next[index] = name;
      return next;
    });
  }

  function setCount(n: number) {
    const clamped = Math.min(10, Math.max(1, n));
    setTicketCount(clamped);
    setPassengerNames(prev => {
      const next = [...prev];
      while (next.length < clamped) next.push("");
      return next.slice(0, clamped);
    });
  }

  async function handleBook() {
    if (!payMethod) return;

    const token = await getApiToken();
    if (!token) {
      toastRef.current?.show({ message: t("booking.loginRequired"), type: "error" });
      return;
    }

    setLoading(true);
    try {
      await api.post("/bookings", {
        type: "trip",
        reference_id: trip.id,
        payment_method: payMethod,
        travel_date: selectedDate,
        quantity: ticketCount,
        passenger_names: passengerNames.map(n => n.trim()).filter(Boolean),
      });
      toastRef.current?.show({ message: t("booking.bookingSentToast"), type: "success" });
      setTimeout(() => {
        setShowRating(true);
        onConfirm();
      }, 2600);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? t("components.bookingSheet.tryAgain");
      toastRef.current?.show({ message: msg, type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function submitRating() {
    if (rating === 0) return;
    try {
      await api.post(`/agencies/${trip.agency_id}/rate`, {
        stars: rating,
        comment: comment || null,
      });
      toastRef.current?.show({ message: t("rating.success"), type: "success" });
    } catch {
      // rating is optional
    }
    setShowRating(false);
  }

  return (
    <Modal visible animationType="slide" transparent>
      {/* Backdrop */}
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Sheet */}
      <KeyboardAvoidingView
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight: "92%",
        }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <View
        style={{
          backgroundColor: C.white,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          maxHeight: "100%",
        }}
      >
        {/* Handle */}
        <View style={{ alignItems: "center", paddingTop: 14, paddingBottom: 4 }}>
          <View style={{ width: 40, height: 4, backgroundColor: C.border, borderRadius: 2 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 56 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Agency header */}
          <View style={{ backgroundColor: C.blue, borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <Text style={{ color: C.white, fontWeight: "900", fontSize: 18 }}>{trip.agency_name}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
              <Ionicons name="star" size={14} color={C.yellow} />
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>
                {trip.agency_rating > 0 ? trip.agency_rating.toFixed(1) : t("booking.agencyNew")}
                {trip.agency_ratings_count > 0 ? ` (${trip.agency_ratings_count})` : ""}
              </Text>
            </View>
          </View>

          {/* Route */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <Text style={{ color: C.dark, fontWeight: "800", fontSize: 15 }}>{trip.from.name ?? trip.from.city}</Text>
            <Ionicons name="arrow-forward" size={18} color={C.blue} />
            <Text style={{ color: C.dark, fontWeight: "800", fontSize: 15 }}>{trip.to.name ?? trip.to.city}</Text>
          </View>

          {/* Times */}
          <Text style={{ color: C.dark, fontWeight: "900", fontSize: 28 }}>{trip.departure_time}</Text>
          <Text style={{ color: C.muted, fontSize: 13, marginBottom: 4 }}>~{trip.estimated_arrival_time}</Text>
          <Text style={{ color: C.muted, fontSize: 11, marginBottom: 16, fontStyle: "italic" }}>
            {t("booking.arrivalNote")}
          </Text>

          <View style={{ borderTopWidth: 1, borderTopColor: C.border, marginVertical: 8 }} />

          {/* Ticket count */}
          <Text style={{ fontWeight: "700", fontSize: 13, color: C.muted, marginBottom: 10, letterSpacing: 0.5 }}>
            {t("booking.tickets")}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 20 }}>
            <TouchableOpacity
              onPress={() => setCount(ticketCount - 1)}
              style={{
                width: 36, height: 36, borderRadius: 10,
                backgroundColor: ticketCount <= 1 ? C.bg : C.blue,
                alignItems: "center", justifyContent: "center",
              }}
            >
              <Text style={{ color: ticketCount <= 1 ? C.muted : C.white, fontWeight: "900", fontSize: 20 }}>−</Text>
            </TouchableOpacity>
            <Text style={{ fontWeight: "900", fontSize: 22, color: C.dark, minWidth: 28, textAlign: "center" }}>
              {ticketCount}
            </Text>
            <TouchableOpacity
              onPress={() => setCount(ticketCount + 1)}
              style={{
                width: 36, height: 36, borderRadius: 10,
                backgroundColor: ticketCount >= 10 ? C.bg : C.blue,
                alignItems: "center", justifyContent: "center",
              }}
            >
              <Text style={{ color: ticketCount >= 10 ? C.muted : C.white, fontWeight: "900", fontSize: 20 }}>+</Text>
            </TouchableOpacity>
            <Text style={{ color: C.muted, fontSize: 13, flex: 1 }}>
              {ticketCount} × {price.toLocaleString()} RWF
            </Text>
          </View>

          {/* Passengers */}
          <Text style={{ fontWeight: "700", fontSize: 13, color: C.muted, marginBottom: 10, letterSpacing: 0.5 }}>
            {t("booking.passengers")}
          </Text>

          {Array.from({ length: ticketCount }).map((_, i) => {
            const name = passengerNames[i] ?? "";
            const isEditing = editingIndex === i;
            return (
              <View
                key={i}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 12,
                  backgroundColor: C.bg, borderRadius: 12,
                  paddingHorizontal: 14, paddingVertical: 10,
                  marginBottom: 8,
                  borderWidth: 1.5,
                  borderColor: isEditing ? C.blue : C.border,
                }}
              >
                {/* Number badge */}
                <View style={{
                  width: 28, height: 28, borderRadius: 14,
                  backgroundColor: C.blueLt, alignItems: "center", justifyContent: "center",
                }}>
                  <Text style={{ color: C.blue, fontWeight: "900", fontSize: 13 }}>{i + 1}</Text>
                </View>

                {/* Name / input */}
                {isEditing ? (
                  <TextInput
                    value={name}
                    onChangeText={n => updatePassengerName(i, n)}
                    autoFocus
                    onBlur={() => setEditingIndex(null)}
                    onSubmitEditing={() => setEditingIndex(null)}
                    placeholder={i === 0 ? t("booking.yourFullName") : t("booking.passengerName", { n: i + 1 })}
                    placeholderTextColor={C.muted}
                    style={{ flex: 1, fontSize: 14, color: C.dark, paddingVertical: 0 }}
                  />
                ) : (
                  <Text style={{ flex: 1, fontSize: 14, color: name ? C.dark : C.muted, fontWeight: name ? "600" : "400" }}>
                    {name || (i === 0 ? t("booking.yourFullName") : t("booking.passengerName", { n: i + 1 }))}
                  </Text>
                )}

                {/* Change / Add button */}
                <TouchableOpacity onPress={() => setEditingIndex(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ color: C.blue, fontWeight: "700", fontSize: 13 }}>
                    {name ? t("common.change") : t("common.add")}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
          <View style={{ height: 4 }} />

          {/* Price breakdown */}
          <Text style={{ fontWeight: "700", fontSize: 13, color: C.muted, marginBottom: 10, letterSpacing: 0.5 }}>
            {t("booking.priceSummary")}
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={{ color: C.mid, fontSize: 14, fontWeight: "600" }}>
              {t("booking.tripPrice")} {ticketCount > 1 ? `× ${ticketCount}` : ""}
            </Text>
            <Text style={{ color: C.dark, fontSize: 14, fontWeight: "700" }}>
              {totalPrice.toLocaleString()} RWF
            </Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={{ color: C.mid, fontSize: 14, fontWeight: "600" }}>{t("booking.serviceFee")}</Text>
            <Text style={{ color: C.dark, fontSize: 14, fontWeight: "700" }}>{fee.toLocaleString()} RWF</Text>
          </View>
          <View style={{ borderTopWidth: 1, borderTopColor: C.border, marginVertical: 8 }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <Text style={{ fontWeight: "900", fontSize: 16, color: C.dark }}>{t("booking.totalAmount")}</Text>
            <Text style={{ fontWeight: "900", fontSize: 24, color: C.blue }}>{total.toLocaleString()} RWF</Text>
          </View>

          {/* Date selector */}
          <Text style={{ fontWeight: "700", fontSize: 13, color: C.muted, marginBottom: 10, letterSpacing: 0.5 }}>
            {t("booking.travelDate")}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
            {dateOpts.map(d => (
              <TouchableOpacity
                key={d}
                onPress={() => setSelectedDate(d)}
                style={{
                  paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
                  backgroundColor: selectedDate === d ? C.blue : C.bg,
                }}
              >
                <Text style={{ color: selectedDate === d ? C.white : C.dark, fontWeight: "800", fontSize: 13 }}>
                  {d}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Payment method */}
          <Text style={{ fontWeight: "700", fontSize: 13, color: C.muted, marginBottom: 10, letterSpacing: 0.5 }}>
            {t("booking.selectPayment")}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {PAY_METHODS.map(m => {
              const selected = payMethod === m;
              return (
                <TouchableOpacity
                  key={m}
                  onPress={() => setPayMethod(m)}
                  style={{
                    paddingVertical: 10, paddingHorizontal: 16,
                    backgroundColor: selected ? C.blue : C.bg,
                    borderWidth: selected ? 0 : 2, borderColor: C.border,
                    borderRadius: 10, alignItems: "center",
                  }}
                >
                  <Text style={{ color: selected ? C.white : C.mid, fontWeight: "800", fontSize: 13 }}>{m}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Book Now */}
          <TouchableOpacity
            onPress={handleBook}
            disabled={loading || !payMethod}
            style={{
              backgroundColor: loading || !payMethod ? C.border : C.blue,
              borderRadius: 16, paddingVertical: 18, alignItems: "center", marginBottom: 12,
            }}
          >
            {loading ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={{ color: C.white, fontWeight: "900", fontSize: 17 }}>{t("booking.bookingInProgress")}</Text>
              </View>
            ) : (
              <Text style={{ color: C.white, fontWeight: "900", fontSize: 17 }}>
                {t("booking.bookNow")} →
              </Text>
            )}
          </TouchableOpacity>

          {/* Cancel */}
          <TouchableOpacity onPress={onClose} style={{ paddingVertical: 14, alignItems: "center" }}>
            <Text style={{ color: C.muted, fontWeight: "700", fontSize: 14 }}>{t("common.close")}</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Rating modal */}
        <Modal visible={showRating} animationType="slide" transparent>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
              <View style={{ width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginBottom: 20 }} />
              <Text style={{ fontWeight: "900", fontSize: 18, color: C.dark, marginBottom: 16, textAlign: "center" }}>
                {t("rating.rateAgency")}
              </Text>
              <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 16 }}>
                {[1, 2, 3, 4, 5].map(s => (
                  <TouchableOpacity key={s} onPress={() => setRating(s)}>
                    <Ionicons name={s <= rating ? "star" : "star-outline"} size={32} color={C.yellow} />
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                value={comment}
                onChangeText={setComment}
                placeholder={t("rating.comment")}
                placeholderTextColor={C.muted}
                multiline
                style={{
                  backgroundColor: C.bg, borderRadius: 12,
                  paddingHorizontal: 14, paddingVertical: 13,
                  fontSize: 14, color: C.dark,
                  borderWidth: 1.5, borderColor: C.border,
                  marginBottom: 16, minHeight: 60,
                }}
              />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  onPress={() => setShowRating(false)}
                  style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: C.bg, alignItems: "center" }}
                >
                  <Text style={{ color: C.mid, fontWeight: "700" }}>{t("common.close")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={submitRating}
                  disabled={rating === 0}
                  style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: rating === 0 ? C.border : C.blue, alignItems: "center" }}
                >
                  <Text style={{ color: C.white, fontWeight: "800" }}>{t("rating.submit")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Toast */}
        <Toast ref={toastRef} />
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
