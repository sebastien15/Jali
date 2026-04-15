import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import { StationPicker, StationObj } from "@/components/StationPicker";
import { DateTimePickerModal } from "@/components/DateTimePickerModal";

interface Props {
  from: StationObj | null;
  to: StationObj | null;
  onFromChange: (v: StationObj) => void;
  onToChange: (v: StationObj) => void;
  onSwap: () => void;
  selectedDate: Date;
  onDateChange: (d: Date) => void;
}

function isQuickDate(d: Date): boolean {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  return (
    d.toDateString() === today.toDateString() ||
    d.toDateString() === tomorrow.toDateString()
  );
}

function hasTimeSet(d: Date): boolean {
  return d.getHours() !== 0 || d.getMinutes() !== 0;
}

export function SearchHeader({ from, to, onFromChange, onToChange, onSwap, selectedDate, onDateChange }: Props) {
  const { t } = useTranslation();
  const [showPicker, setShowPicker] = useState(false);
  const [pickerTimeOnly, setPickerTimeOnly] = useState(false);

  const quickDate = isQuickDate(selectedDate);
  const timeSet = hasTimeSet(selectedDate);

  const today = new Date();
  today.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
  const tomorrow = new Date();
  tomorrow.setDate(new Date().getDate() + 1);
  tomorrow.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);

  const quickDates = [
    { label: "Today",    date: today },
    { label: "Tomorrow", date: tomorrow },
  ];

  const timeChipLabel = timeSet
    ? selectedDate.toLocaleTimeString("en-RW", { hour: "2-digit", minute: "2-digit" })
    : "Time";

  const customDateActive = !quickDate;
  const customDateLabel = customDateActive
    ? selectedDate.toLocaleDateString("en-RW", { month: "short", day: "numeric" })
    : "Date";

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

      {/* Date + Time chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: 8, paddingBottom: 16 }}>
          {/* Today / Tomorrow */}
          {quickDates.map(qd => {
            const active = qd.date.toDateString() === selectedDate.toDateString();
            return (
              <TouchableOpacity
                key={qd.label}
                onPress={() => {
                  const d = new Date(qd.date);
                  d.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
                  onDateChange(d);
                }}
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

          {/* Pick time chip — only when Today or Tomorrow is active */}
          {quickDate && (
            <TouchableOpacity
              onPress={() => { setPickerTimeOnly(true); setShowPicker(true); }}
              style={{
                flexDirection: "row", alignItems: "center", gap: 5,
                backgroundColor: timeSet ? C.yellow : "rgba(255,255,255,0.15)",
                borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7,
              }}
            >
              <Ionicons name="time-outline" size={13} color={timeSet ? C.dark : C.white} />
              <Text style={{ color: timeSet ? C.dark : C.white, fontWeight: "800", fontSize: 12 }}>
                {timeChipLabel}
              </Text>
              {timeSet && (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    const d = new Date(selectedDate);
                    d.setHours(0, 0, 0, 0);
                    onDateChange(d);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                >
                  <Ionicons name="close-circle" size={14} color={C.dark} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )}

          {/* Pick date chip — full calendar picker */}
          <TouchableOpacity
            onPress={() => { setPickerTimeOnly(false); setShowPicker(true); }}
            style={{
              flexDirection: "row", alignItems: "center", gap: 5,
              backgroundColor: customDateActive ? C.yellow : "rgba(255,255,255,0.15)",
              borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7,
            }}
          >
            <Ionicons name="calendar-outline" size={13} color={customDateActive ? C.dark : C.white} />
            <Text style={{ color: customDateActive ? C.dark : C.white, fontWeight: "800", fontSize: 12 }}>
              {customDateLabel}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <DateTimePickerModal
        visible={showPicker}
        date={selectedDate}
        timeOnly={pickerTimeOnly}
        onConfirm={(date) => { onDateChange(date); setShowPicker(false); }}
        onCancel={() => setShowPicker(false)}
      />
    </View>
  );
}
