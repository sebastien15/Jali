import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { C } from "@/constants/theme";
import { PAY_METHODS, PayMethod } from "@/constants/data";
import { tripServiceFee } from "@/lib/serviceFee";
import api from "@/lib/api";
import { getApiToken } from "@/lib/api";

type TripData = {
  id: number;
  agency_name: string;
  agency_rating: number;
  agency_ratings_count: number;
  from: { city: string };
  to: { city: string };
  departure_time: string;
  estimated_arrival_time: string;
  price: number;
};

const DATE_OPTS = ["Today", "Tomorrow"];

interface Props {
  trip: TripData;
  onClose: () => void;
  onConfirm: () => void;
}

export function TripBookingSheet({ trip, onClose, onConfirm }: Props) {
  const { t } = useTranslation();
  const [payMethod, setPayMethod] = useState<PayMethod | null>(null);
  const [selectedDate, setSelectedDate] = useState("Today");
  const [loading, setLoading] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [showRating, setShowRating] = useState(false);

  const fee = tripServiceFee(trip.price);
  const total = trip.price + fee;

  async function handleBook() {
    if (!payMethod) return;

    // Check if logged in
    const token = getApiToken();
    if (!token) {
      Alert.alert(t("booking.loginRequired"));
      return;
    }

    setLoading(true);
    try {
      await api.post("/bookings", {
        type: "trip",
        reference_id: trip.id,
        price: trip.price,
        service_fee: fee,
        payment_method: payMethod,
        travel_date: selectedDate,
      });
      Alert.alert(
        t("booking.bookingSuccess"),
        t("booking.bookingSuccessMsg"),
        [
          {
            text: t("common.ok"),
            onPress: () => {
              setShowRating(true);
              onConfirm();
            },
          },
        ],
      );
    } catch (e: any) {
      Alert.alert(
        t("components.bookingSheet.bookingFailed"),
        e?.response?.data?.message ?? t("components.bookingSheet.tryAgain"),
      );
    } finally {
      setLoading(false);
    }
  }

  async function submitRating() {
    if (rating === 0) return;
    try {
      await api.post(`/agencies/${trip.id}/rate`, {
        stars: rating,
        comment: comment || null,
      });
      Alert.alert(t("rating.success"));
    } catch {
      // Ignore rating errors — it's optional
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
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: C.white,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          maxHeight: "90%",
        }}
      >
        {/* Handle */}
        <View style={{ alignItems: "center", paddingTop: 14, paddingBottom: 4 }}>
          <View
            style={{
              width: 40,
              height: 4,
              backgroundColor: C.border,
              borderRadius: 2,
            }}
          />
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 12,
            paddingBottom: 48,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Agency + Rating */}
          <View
            style={{
              backgroundColor: C.blue,
              borderRadius: 16,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <Text style={{ color: C.white, fontWeight: "900", fontSize: 18 }}>
              {trip.agency_name}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
              <Ionicons name="star" size={14} color={C.yellow} />
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>
                {trip.agency_rating > 0
                  ? trip.agency_rating.toFixed(1)
                  : "New"}
                {trip.agency_ratings_count > 0
                  ? ` (${trip.agency_ratings_count})`
                  : ""}
              </Text>
            </View>
          </View>

          {/* Route */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Text style={{ color: C.dark, fontWeight: "800", fontSize: 15 }}>
              {trip.from.city}
            </Text>
            <Ionicons name="arrow-forward" size={18} color={C.blue} />
            <Text style={{ color: C.dark, fontWeight: "800", fontSize: 15 }}>
              {trip.to.city}
            </Text>
          </View>

          {/* Departure */}
          <Text style={{ color: C.dark, fontWeight: "900", fontSize: 28 }}>
            {trip.departure_time}
          </Text>
          <Text style={{ color: C.muted, fontSize: 13, marginBottom: 4 }}>
            ~{trip.estimated_arrival_time}
          </Text>
          <Text style={{ color: C.muted, fontSize: 11, marginBottom: 16, fontStyle: "italic" }}>
            {t("booking.arrivalNote")}
          </Text>

          {/* Divider */}
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: C.border,
              marginVertical: 8,
            }}
          />

          {/* Price breakdown */}
          <Text
            style={{
              fontWeight: "700",
              fontSize: 13,
              color: C.muted,
              marginBottom: 10,
              letterSpacing: 0.5,
            }}
          >
            {t("booking.priceSummary")}
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={{ color: C.mid, fontSize: 14, fontWeight: "600" }}>
              {t("booking.tripPrice")}
            </Text>
            <Text style={{ color: C.dark, fontSize: 14, fontWeight: "700" }}>
              {trip.price.toLocaleString()} RWF
            </Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={{ color: C.mid, fontSize: 14, fontWeight: "600" }}>
              {t("booking.serviceFee")}
            </Text>
            <Text style={{ color: C.dark, fontSize: 14, fontWeight: "700" }}>
              {fee.toLocaleString()} RWF
            </Text>
          </View>
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: C.border,
              marginVertical: 8,
            }}
          />
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <Text style={{ fontWeight: "900", fontSize: 16, color: C.dark }}>
              {t("booking.totalAmount")}
            </Text>
            <Text style={{ fontWeight: "900", fontSize: 24, color: C.blue }}>
              {total.toLocaleString()} RWF
            </Text>
          </View>

          {/* Date selector */}
          <Text
            style={{
              fontWeight: "700",
              fontSize: 13,
              color: C.muted,
              marginBottom: 10,
              letterSpacing: 0.5,
            }}
          >
            TRAVEL DATE
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
            {DATE_OPTS.map((d) => (
              <TouchableOpacity
                key={d}
                onPress={() => setSelectedDate(d)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 10,
                  backgroundColor: selectedDate === d ? C.blue : C.bg,
                }}
              >
                <Text
                  style={{
                    color: selectedDate === d ? C.white : C.dark,
                    fontWeight: "800",
                    fontSize: 13,
                  }}
                >
                  {d}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Payment method */}
          <Text
            style={{
              fontWeight: "700",
              fontSize: 13,
              color: C.muted,
              marginBottom: 10,
              letterSpacing: 0.5,
            }}
          >
            {t("booking.selectPayment")}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {PAY_METHODS.map((m) => {
              const selected = payMethod === m;
              return (
                <TouchableOpacity
                  key={m}
                  onPress={() => setPayMethod(m)}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    backgroundColor: selected ? C.blue : C.bg,
                    borderWidth: selected ? 0 : 2,
                    borderColor: C.border,
                    borderRadius: 10,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: selected ? C.white : C.mid,
                      fontWeight: "800",
                      fontSize: 13,
                    }}
                  >
                    {m}
                  </Text>
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
              borderRadius: 16,
              paddingVertical: 18,
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={{ color: C.white, fontWeight: "900", fontSize: 17 }}>
                {t("booking.bookNow")} →
              </Text>
            )}
          </TouchableOpacity>

          {/* Cancel */}
          <TouchableOpacity
            onPress={onClose}
            style={{ paddingVertical: 14, alignItems: "center" }}
          >
            <Text style={{ color: C.muted, fontWeight: "700", fontSize: 14 }}>
              {t("common.close")}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Rating modal (after booking) */}
        <Modal visible={showRating} animationType="slide" transparent>
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.5)",
              justifyContent: "flex-end",
            }}
          >
            <View
              style={{
                backgroundColor: C.white,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 24,
                paddingBottom: 40,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 4,
                  backgroundColor: C.border,
                  borderRadius: 2,
                  alignSelf: "center",
                  marginBottom: 20,
                }}
              />
              <Text
                style={{
                  fontWeight: "900",
                  fontSize: 18,
                  color: C.dark,
                  marginBottom: 16,
                  textAlign: "center",
                }}
              >
                {t("rating.rateAgency")}
              </Text>

              {/* Stars */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                {[1, 2, 3, 4, 5].map((s) => (
                  <TouchableOpacity key={s} onPress={() => setRating(s)}>
                    <Ionicons
                      name={s <= rating ? "star" : "star-outline"}
                      size={32}
                      color={C.yellow}
                    />
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
                  backgroundColor: C.bg,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 13,
                  fontSize: 14,
                  color: C.dark,
                  borderWidth: 1.5,
                  borderColor: C.border,
                  marginBottom: 16,
                  minHeight: 60,
                }}
              />

              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  onPress={() => setShowRating(false)}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: 12,
                    backgroundColor: C.bg,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: C.mid, fontWeight: "700" }}>
                    {t("common.close")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={submitRating}
                  disabled={rating === 0}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: 12,
                    backgroundColor: rating === 0 ? C.border : C.blue,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: C.white, fontWeight: "800" }}>
                    {t("rating.submit")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}
