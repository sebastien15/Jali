import { Modal, View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { C } from "@/constants/theme";

/** Bottom sheet to pick a cancellation reason. */
export function ReasonSheet({ visible, title, note, reasons, labelFor, onPick, onClose, keepLabel, busy }: {
  visible: boolean; title: string; note?: string; reasons: readonly string[]; labelFor: (r: string) => string;
  onPick: (r: string) => void; onClose: () => void; keepLabel: string; busy?: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 34 }}>
          <Text style={{ fontWeight: "900", fontSize: 18, color: C.dark, marginBottom: 6 }}>{title}</Text>
          {note ? <Text style={{ color: C.mid, marginBottom: 10 }}>{note}</Text> : null}
          {busy ? <ActivityIndicator color={C.teal} style={{ marginVertical: 20 }} /> : reasons.map(r => (
            <TouchableOpacity key={r} onPress={() => onPick(r)} accessibilityLabel={labelFor(r)}
              style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border }}>
              <Text style={{ color: C.dark, fontSize: 15 }}>{labelFor(r)}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={onClose} accessibilityLabel={keepLabel}
            style={{ marginTop: 14, backgroundColor: C.dark, borderRadius: 14, paddingVertical: 14, alignItems: "center" }}>
            <Text style={{ color: C.white, fontWeight: "800" }}>{keepLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
