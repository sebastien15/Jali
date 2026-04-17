import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Modal, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import { StationPicker, StationObj } from "@/components/StationPicker";

interface Props {
  from: StationObj | null;
  to: StationObj | null;
  onFromChange: (v: StationObj) => void;
  onToChange: (v: StationObj) => void;
  onSwap: () => void;
  selectedDate: Date;
  onDateChange: (d: Date) => void;
}

export function SearchHeader({ from, to, onFromChange, onToChange, onSwap, selectedDate, onDateChange }: Props) {
  const { t } = useTranslation();
  const [showPicker, setShowPicker] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date();
  tomorrow.setDate(new Date().getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const quickDates = [
    { label: "Today",    date: today },
    { label: "Tomorrow", date: tomorrow },
  ];

  const isCustomDate =
    selectedDate.toDateString() !== today.toDateString() &&
    selectedDate.toDateString() !== tomorrow.toDateString();

  const customLabel = isCustomDate
    ? selectedDate.toLocaleDateString("en-RW", { month: "short", day: "numeric" })
    : null;

  return (
    <View style={{ backgroundColor: C.blue, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 0 }}>
      {/* Title row */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <View>
          <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: "600" }}>{t('home.greeting')}</Text>
          <Text style={{ color: C.white, fontWeight: "900", fontSize: 22 }}>{t('home.whereTo')}</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/profile")}
          style={{
            backgroundColor: C.yellow, borderRadius: 50, width: 42, height: 42,
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Ionicons name="person" size={20} color={C.dark} />
        </TouchableOpacity>
      </View>

      {/* From / To pickers */}
      <View style={{
        backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 18,
        padding: 14, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12,
      }}>
        <StationPicker value={from} onChange={onFromChange} placeholder="From" exclude={to} />
        <TouchableOpacity
          onPress={onSwap}
          style={{
            backgroundColor: C.yellow, borderRadius: 10, width: 34, height: 34,
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 16 }}>⇄</Text>
        </TouchableOpacity>
        <StationPicker value={to} onChange={onToChange} placeholder={t('home.toAny')} exclude={from} />
      </View>

      {/* Date chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: 8, paddingBottom: 16 }}>
          {quickDates.map(qd => {
            const active = qd.date.toDateString() === selectedDate.toDateString();
            return (
              <TouchableOpacity
                key={qd.label}
                onPress={() => onDateChange(new Date(qd.date))}
                style={{
                  backgroundColor: active ? C.yellow : "rgba(255,255,255,0.15)",
                  borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7,
                }}
              >
                <Text style={{ color: active ? C.dark : C.white, fontWeight: "800", fontSize: 12 }}>
                  {qd.label}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* Custom date chip */}
          <TouchableOpacity
            onPress={() => setShowPicker(true)}
            style={{
              backgroundColor: isCustomDate ? C.yellow : "rgba(255,255,255,0.15)",
              borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7,
              flexDirection: "row", alignItems: "center", gap: 5,
            }}
          >
            <Ionicons name="calendar-outline" size={13} color={isCustomDate ? C.dark : C.white} />
            <Text style={{ color: isCustomDate ? C.dark : C.white, fontWeight: "800", fontSize: 12 }}>
              {customLabel ?? "Pick date"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Android date picker — renders as native dialog */}
      {showPicker && Platform.OS === "android" && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          minimumDate={today}
          onChange={(_, date) => {
            setShowPicker(false);
            if (date) onDateChange(date);
          }}
        />
      )}

      {/* iOS date picker — bottom sheet modal */}
      {Platform.OS === "ios" && (
        <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowPicker(false)}
            style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}
          >
            <TouchableOpacity activeOpacity={1} style={{
              backgroundColor: C.white,
              borderTopLeftRadius: 20, borderTopRightRadius: 20,
              paddingHorizontal: 20, paddingBottom: 32, paddingTop: 16,
            }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <Text style={{ fontWeight: "800", fontSize: 16, color: C.dark }}>Select date</Text>
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Text style={{ color: C.blue, fontWeight: "700", fontSize: 15 }}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="inline"
                minimumDate={today}
                onChange={(_, date) => { if (date) onDateChange(date); }}
                style={{ alignSelf: "center" }}
              />
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}
