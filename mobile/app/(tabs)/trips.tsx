import { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StatusBar, Image, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "@/constants/theme";
import { TRIPS, TripStatus, TripType } from "@/constants/data";

const TYPE_COLOR: Record<TripType, string> = {
  bus: C.blue, rental: C.green, private: C.orange,
};
const TYPE_ICON: Record<TripType, string> = {
  bus: "🚌", rental: "🚗", private: "💺",
};
const STATUS_COLOR: Record<TripStatus, string> = {
  pending: C.orange, confirmed: C.green, completed: C.muted,
};

export default function TripsScreen() {
  const [filter, setFilter] = useState<"all" | TripStatus>("all");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const list = filter === "all" ? TRIPS : TRIPS.filter(t => t.status === filter);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.blue} />

      {/* Header */}
      <View style={{ backgroundColor: C.blue, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 0 }}>
        <Text style={{ color: C.yellow, fontWeight: "900", fontSize: 26, marginBottom: 12 }}>
          My Trips 🗓️
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 8, paddingBottom: 16 }}>
            {(["all", "pending", "confirmed", "completed"] as const).map(f => (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f)}
                style={{
                  backgroundColor: filter === f ? C.yellow : "rgba(255,255,255,0.15)",
                  borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8,
                }}
              >
                <Text style={{
                  color: filter === f ? C.dark : C.white,
                  fontWeight: "800", fontSize: 13, textTransform: "capitalize",
                }}>
                  {f}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {list.length === 0 && (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <Text style={{ fontSize: 40 }}>🗓️</Text>
            <Text style={{ color: C.muted, fontWeight: "700", fontSize: 14, marginTop: 8 }}>
              No trips here yet
            </Text>
          </View>
        )}

        {list.map(trip => (
          <View
            key={trip.id}
            style={{
              backgroundColor: C.white, borderRadius: 20, padding: 16,
              marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.07,
              shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 3,
            }}
          >
            <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
              <View style={{
                backgroundColor: TYPE_COLOR[trip.type], borderRadius: 14,
                width: 46, height: 46, alignItems: "center", justifyContent: "center",
              }}>
                <Text style={{ fontSize: 22 }}>{TYPE_ICON[trip.type]}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "800", fontSize: 15, color: C.dark }}>{trip.title}</Text>
                <Text style={{ color: C.mid, fontSize: 12, marginTop: 2 }}>{trip.sub}</Text>
              </View>

              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontWeight: "800", fontSize: 14, color: C.dark }}>
                  {trip.price.toLocaleString()} RWF
                </Text>
                <View style={{
                  backgroundColor: STATUS_COLOR[trip.status],
                  borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4,
                }}>
                  <Text style={{
                    color: C.white, fontSize: 11, fontWeight: "700", textTransform: "capitalize",
                  }}>
                    {trip.status}
                  </Text>
                </View>
              </View>
            </View>

            {/* Ticket photo — shown when admin uploads it */}
            {trip.ticketPhotoUrl ? (
              <TouchableOpacity
                onPress={() => setPhotoUrl(trip.ticketPhotoUrl!)}
                style={{
                  marginTop: 12, backgroundColor: C.blueLt, borderRadius: 12,
                  padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center",
                }}
              >
                <View>
                  <Text style={{ color: C.blue, fontWeight: "700", fontSize: 13 }}>
                    📸 Ticket Photo Ready
                  </Text>
                  <Text style={{ color: C.mid, fontSize: 12 }}>Tap to view · Show at station</Text>
                </View>
                <View style={{
                  backgroundColor: C.blue, borderRadius: 10,
                  paddingHorizontal: 14, paddingVertical: 8,
                }}>
                  <Text style={{ color: C.white, fontWeight: "700", fontSize: 13 }}>View</Text>
                </View>
              </TouchableOpacity>
            ) : trip.status === "pending" ? (
              <View style={{
                marginTop: 12, backgroundColor: C.orangeLt, borderRadius: 12, padding: 12,
              }}>
                <Text style={{ color: C.orange, fontWeight: "700", fontSize: 13 }}>
                  ⏳ Awaiting confirmation — admin is arranging your ticket
                </Text>
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>

      {/* Full-screen ticket photo viewer */}
      <Modal visible={!!photoUrl} animationType="fade" transparent>
        <View style={{
          flex: 1, backgroundColor: "rgba(0,0,0,0.92)",
          justifyContent: "center", alignItems: "center",
        }}>
          {photoUrl && (
            <Image
              source={{ uri: photoUrl }}
              style={{ width: "90%", height: "70%", borderRadius: 16 }}
              resizeMode="contain"
            />
          )}
          <TouchableOpacity
            onPress={() => setPhotoUrl(null)}
            style={{
              marginTop: 24, backgroundColor: C.white,
              borderRadius: 12, paddingHorizontal: 32, paddingVertical: 12,
            }}
          >
            <Text style={{ fontWeight: "800", color: C.dark, fontSize: 15 }}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
