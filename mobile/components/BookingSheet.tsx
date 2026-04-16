import { useState } from "react";
import {
  View, Text, TouchableOpacity, Modal, ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import { PAY_METHODS, PayMethod } from "@/constants/data";
import { useServiceFee } from "@/lib/useServiceFee";
import api from "@/lib/api";

interface SheetData {
  type: "bus" | "private" | "rental";
  item: any;
  days?: number;
  travelDate?: string;
}

interface Props {
  data: SheetData;
  onClose: () => void;
  onConfirm: () => void;
  userCoords?: { lat: number; lng: number } | null;
}

export function BookingSheet({ data, onClose, onConfirm, userCoords }: Props) {
  const { t } = useTranslation();
  const { type, item, days = 1, travelDate } = data;
  const [payMethod, setPayMethod] = useState<PayMethod>("MTN MoMo");
  const [loading, setLoading] = useState(false);

  const isBus     = type === "bus";
  const isPrivate = type === "private";
  const isRental  = type === "rental";

  const color = isBus ? C.blue : isPrivate ? C.orange : C.green;

  // Service fee: distance-based for bus/private, flat 300 for rental
  const departureCity = isRental ? "" : (item.from ?? "Kigali");
  const {
    fee,
    distanceKm,
    loading: feeLoading,
    permissionDenied,
  } = useServiceFee(isRental ? "Kigali" : departureCity, isRental ? null : userCoords);

  const effectiveFee = isRental ? 300 : fee;
  const total = isBus
    ? item.price + effectiveFee
    : isPrivate
    ? item.price + effectiveFee
    : item.price * days + 300;

  async function handleConfirm() {
    setLoading(true);
    try {
      await api.post("/bookings", {
        type,
        reference_id: item.id,
        price: isBus ? item.price : isPrivate ? item.price : item.price * days,
        service_fee: effectiveFee,
        payment_method: payMethod,
        ...(travelDate ? { travel_date: travelDate } : {}),
        ...(isBus || isPrivate ? {
          title: isBus ? `${item.agency} · ${item.from} → ${item.to}` : `${item.driver} · ${item.from} → ${item.to}`,
          sub: isBus ? `Departs ${item.dep} · ${item.seats} seats` : `Departs ${item.dep}`,
        } : {
          title: item.name,
          sub: `${item.type} · ${days} day${days > 1 ? "s" : ""}`,
        }),
      });
      Alert.alert(
        t('components.bookingSheet.bookingSent'),
        t('components.bookingSheet.bookingSentDesc'),
        [{ text: t('common.ok'), onPress: onConfirm }],
      );
    } catch (e: any) {
      Alert.alert(t('components.bookingSheet.bookingFailed'), e?.response?.data?.message ?? e.message ?? t('components.bookingSheet.tryAgain'));
    } finally {
      setLoading(false);
    }
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
      <View style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        maxHeight: "90%",
      }}>
        {/* Handle */}
        <View style={{ alignItems: "center", paddingTop: 14, paddingBottom: 4 }}>
          <View style={{ width: 40, height: 4, backgroundColor: C.border, borderRadius: 2 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title strip */}
          <View style={{
            backgroundColor: color, borderRadius: 16, padding: 16, marginBottom: 16,
          }}>
            <Text style={{ color: C.white, fontWeight: "900", fontSize: 18 }}>
              {isBus ? `🚌 ${item.agency}` : isPrivate ? `💺 ${item.driver}` : `🚗 ${item.name}`}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: "600", marginTop: 2 }}>
              {isBus
                ? `${item.from} → ${item.to} · Departs ${item.dep}`
                : isPrivate
                ? `${item.from} → ${item.to} · ${item.dep}`
                : `${item.type} · ${item.seats} seats · ${days} day${days > 1 ? "s" : ""}`}
            </Text>
          </View>

          {/* Price breakdown */}
          <View style={{ marginBottom: 20 }}>
            {isPrivate && (
              <View style={{
                backgroundColor: C.orangeLt, borderRadius: 10, padding: 12, marginBottom: 12,
                flexDirection: "row", gap: 8, alignItems: "center",
              }}>
                <Text style={{ color: C.orange, fontWeight: "700", fontSize: 13 }}>
                  ⚠️ {t('components.bookingSheet.noRefundWarning')}
                </Text>
              </View>
            )}

            {isBus && <PriceLine label={t('components.bookingSheet.ticket')} value={item.price} />}
            {isPrivate && <PriceLine label={t('components.bookingSheet.seatFee')} value={item.price} />}
            {isRental && (
              <PriceLine label={`${item.price.toLocaleString()} RWF/day × ${days}`} value={item.price * days} />
            )}

            {(isBus || isPrivate) && (
              <FeeLine
                fee={effectiveFee}
                loading={feeLoading}
                distanceKm={distanceKm}
                permissionDenied={permissionDenied}
                stationCity={departureCity}
              />
            )}

            <View style={{ borderTopWidth: 1, borderTopColor: C.border, marginVertical: 12 }} />

            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontWeight: "900", fontSize: 16, color: C.dark }}>{t('components.bookingSheet.total')}</Text>
              <Text style={{ fontWeight: "900", fontSize: 24, color }}>
                {total.toLocaleString()} RWF
              </Text>
            </View>
          </View>

          {/* Payment method */}
          <Text style={{ fontWeight: "700", fontSize: 13, color: C.muted, marginBottom: 10, letterSpacing: 0.5 }}>
            PAY WITH
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
                    backgroundColor: selected ? color : C.bg,
                    borderWidth: selected ? 0 : 2, borderColor: C.border,
                    borderRadius: 10, alignItems: "center",
                  }}
                >
                  <Text style={{
                    color: selected ? C.white : C.mid,
                    fontWeight: "800", fontSize: 13,
                  }}>
                    {m}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Confirm button */}
          <TouchableOpacity
            onPress={handleConfirm}
            disabled={loading}
            style={{
              backgroundColor: color, borderRadius: 16,
              paddingVertical: 18, alignItems: "center",
            }}
          >
            <Text style={{ color: isBus ? C.yellow : C.white, fontWeight: "900", fontSize: 17 }}>
              {loading
                ? "Sending request..."
                : `Request Booking via ${payMethod} →`}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

function PriceLine({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
      <Text style={{ color: C.mid, fontSize: 14, fontWeight: "600" }}>{label}</Text>
      <Text style={{ color: C.dark, fontSize: 14, fontWeight: "700" }}>{value.toLocaleString()} RWF</Text>
    </View>
  );
}

function FeeLine({ fee, loading, distanceKm, permissionDenied, stationCity }: {
  fee: number;
  loading: boolean;
  distanceKm: number | null;
  permissionDenied: boolean;
  stationCity: string;
}) {
  const hint = permissionDenied
    ? "📍 Enable location for accurate fee"
    : distanceKm !== null
    ? `📍 ${distanceKm} km from ${stationCity} station`
    : "📍 Detecting your location...";

  return (
    <View style={{ marginBottom: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: C.mid, fontSize: 14, fontWeight: "600" }}>Service fee</Text>
        {loading
          ? <ActivityIndicator size="small" color={C.blue} />
          : <Text style={{ color: C.dark, fontSize: 14, fontWeight: "700" }}>{fee.toLocaleString()} RWF</Text>
        }
      </View>
      <Text style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{hint}</Text>
    </View>
  );
}
