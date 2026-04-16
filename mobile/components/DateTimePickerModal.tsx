import { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { C } from "@/constants/theme";

interface Props {
  visible: boolean;
  date: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
  timeOnly?: boolean;
}

export function DateTimePickerModal({ visible, date, onConfirm, onCancel, timeOnly = false }: Props) {
  const [selectedDate, setSelectedDate] = useState<Date>(date);
  const [showDatePicker, setShowDatePicker] = useState(!timeOnly);

  // Reset when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedDate(date);
      setShowDatePicker(!timeOnly);
    }
  }, [visible, date, timeOnly]);

  function handleDateChange(_: any, d?: Date) {
    if (d) {
      setSelectedDate(d);
    }
  }

  function handleTimeChange(_: any, d?: Date) {
    if (d) {
      setSelectedDate(d);
    }
  }

  function handleDone() {
    onConfirm(selectedDate);
  }

  const title = timeOnly ? "Pick Departure Time" : "Pick Date & Time";

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onCancel}
      >
        <TouchableOpacity
          style={[
            styles.sheet,
            Platform.OS === "web" ? {
              borderRadius: 20,
              marginHorizontal: "auto",
              marginTop: "auto",
              marginBottom: "auto",
              maxWidth: 400,
              width: "90%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            } : null,
          ]}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={handleDone}>
              <Text style={styles.confirmText}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Preview */}
          <View style={styles.preview}>
            {!timeOnly && (
              <Text style={styles.previewDate}>
                {selectedDate.toLocaleDateString("en-RW", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </Text>
            )}
            <Text style={[styles.previewTime, timeOnly && { fontSize: 32, marginTop: 0 }]}>
              {selectedDate.toLocaleTimeString("en-RW", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
            {timeOnly && (
              <Text style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>
                Only trips departing at or after this time will be shown
              </Text>
            )}
          </View>

          {/* Mobile: native DateTimePicker */}
          {Platform.OS !== "web" && (
            <View style={styles.mobilePickers}>
              {!timeOnly && showDatePicker ? (
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  minimumDate={new Date()}
                  display="spinner"
                  onChange={handleDateChange}
                  style={styles.pickerNative}
                />
              ) : (
                <DateTimePicker
                  value={selectedDate}
                  mode="time"
                  display="spinner"
                  onChange={handleTimeChange}
                  style={styles.pickerNative}
                />
              )}
              {Platform.OS === "ios" && !timeOnly && (
                <View style={styles.iosSwitchRow}>
                  <TouchableOpacity
                    onPress={() => setShowDatePicker(true)}
                    style={[
                      styles.iosSwitchBtn,
                      showDatePicker && styles.iosSwitchBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.iosSwitchText,
                        showDatePicker && styles.iosSwitchTextActive,
                      ]}
                    >
                      Date
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowDatePicker(false)}
                    style={[
                      styles.iosSwitchBtn,
                      !showDatePicker && styles.iosSwitchBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.iosSwitchText,
                        !showDatePicker && styles.iosSwitchTextActive,
                      ]}
                    >
                      Time
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Web: native HTML inputs */}
          {Platform.OS === "web" && (
            <WebDateTimeInputs date={selectedDate} onChange={setSelectedDate} timeOnly={timeOnly} />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function WebDateTimeInputs({
  date,
  onChange,
  timeOnly,
}: {
  date: Date;
  onChange: (d: Date) => void;
  timeOnly: boolean;
}) {
  function toInputDate(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function toInputTime(d: Date) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function handleDateChange(dateStr: string) {
    const parts = dateStr.split("-");
    const newDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), date.getHours(), date.getMinutes());
    onChange(newDate);
  }

  function handleTimeChange(timeStr: string) {
    const parts = timeStr.split(":");
    const newDate = new Date(date);
    newDate.setHours(Number(parts[0]), Number(parts[1]));
    onChange(newDate);
  }

  return (
    <View style={styles.webInputs}>
      {!timeOnly && (
        <View style={styles.webInputCol}>
          <Text style={styles.colLabel}>Date</Text>
          <input
            type="date"
            value={toInputDate(date)}
            min={toInputDate(new Date())}
            onChange={(e) => handleDateChange(e.target.value)}
            style={webInputStyles}
          />
        </View>
      )}
      <View style={styles.webInputCol}>
        <Text style={styles.colLabel}>Time</Text>
        <input
          type="time"
          value={toInputTime(date)}
          onChange={(e) => handleTimeChange(e.target.value)}
          style={webInputStyles}
        />
      </View>
    </View>
  );
}

const webInputStyles: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  fontSize: 16,
  fontFamily: "inherit",
  border: "1.5px solid #DDE2EC",
  borderRadius: 12,
  backgroundColor: "#F2F4F8",
  color: "#0D1117",
  outline: "none",
  boxSizing: "border-box",
  cursor: "pointer",
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === "ios" ? 32 : 16,
    paddingTop: 16,
    paddingHorizontal: 20,
    ...Platform.select({
      web: {
        borderRadius: 20,
        marginHorizontal: "auto",
        marginTop: "auto",
        marginBottom: "auto",
        maxWidth: 400,
        width: "90%",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      },
    }),
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    color: C.dark,
    fontWeight: "800",
    fontSize: 16,
  },
  cancelText: {
    color: C.muted,
    fontWeight: "600",
    fontSize: 14,
  },
  confirmText: {
    color: C.blue,
    fontWeight: "800",
    fontSize: 14,
  },
  preview: {
    backgroundColor: C.bg,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  previewDate: {
    color: C.dark,
    fontWeight: "800",
    fontSize: 16,
  },
  previewTime: {
    color: C.blue,
    fontWeight: "700",
    fontSize: 22,
    marginTop: 2,
  },
  mobilePickers: {
    alignItems: "center",
  },
  pickerNative: {
    alignSelf: "center",
  },
  iosSwitchRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  iosSwitchBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: C.bg,
  },
  iosSwitchBtnActive: {
    backgroundColor: C.blueLt,
  },
  iosSwitchText: {
    color: C.muted,
    fontWeight: "700",
    fontSize: 13,
  },
  iosSwitchTextActive: {
    color: C.blue,
    fontWeight: "800",
  },
  webInputs: {
    gap: 12,
  },
  webInputCol: {
    gap: 6,
  },
  colLabel: {
    color: C.muted,
    fontWeight: "700",
    fontSize: 12,
    textTransform: "uppercase",
  },
});
