import { ReactNode } from "react";
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Switch, TextInputProps, StatusBar } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { C } from "@/constants/theme";

/** Small building blocks shared by the rental screens */

export function Header({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={{ backgroundColor: C.white, paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />
      <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)" as any))} accessibilityLabel="Back" hitSlop={12}>
        <Ionicons name="arrow-back" size={24} color={C.dark} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "900", fontSize: 18, color: C.dark }} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={{ color: C.mid, fontSize: 12 }} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

export function Section({ title, hint, children, right }: { title?: string; hint?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ backgroundColor: C.white, borderRadius: 16, padding: 14 }}>
      {(!!title || right) && (
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: hint ? 2 : 10 }}>
          {!!title && <Text style={{ flex: 1, fontWeight: "800", fontSize: 15, color: C.dark }}>{title}</Text>}
          {right}
        </View>
      )}
      {!!hint && <Text style={{ color: C.mid, fontSize: 12, marginBottom: 10 }}>{hint}</Text>}
      {children}
    </View>
  );
}

export function Chip({ label, on, onPress, icon }: { label: string; on: boolean; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
        backgroundColor: on ? C.dark : C.white, borderWidth: 1, borderColor: on ? C.dark : C.border }}>
      {icon && <Ionicons name={icon} size={14} color={on ? C.white : C.mid} />}
      <Text style={{ color: on ? C.white : C.dark, fontWeight: "700", fontSize: 13 }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Field({ label, hint, suffix, ...input }: TextInputProps & { label: string; hint?: string; suffix?: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: C.mid, fontSize: 12, fontWeight: "700", marginBottom: 4 }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: C.border, borderRadius: 10, backgroundColor: C.white }}>
        <TextInput placeholderTextColor={C.muted} accessibilityLabel={label} {...input}
          style={[{ flex: 1, padding: 10, color: C.dark, fontSize: 15, minHeight: input.multiline ? 90 : undefined, textAlignVertical: input.multiline ? "top" : "center" }, input.style]} />
        {!!suffix && <Text style={{ color: C.muted, paddingRight: 10, fontWeight: "700" }}>{suffix}</Text>}
      </View>
      {!!hint && <Text style={{ color: C.muted, fontSize: 11, marginTop: 3 }}>{hint}</Text>}
    </View>
  );
}

/** Integer field that keeps "" while typing; `value` null means empty */
export function NumberField({ value, onChange, ...rest }: Omit<TextInputProps, "value" | "onChangeText" | "onChange"> & {
  label: string; hint?: string; suffix?: string; value: number | null | undefined; onChange: (v: number | null) => void;
}) {
  return (
    <Field {...rest} keyboardType="number-pad" value={value === null || value === undefined ? "" : String(value)}
      onChangeText={txt => {
        const digits = txt.replace(/[^0-9]/g, "");
        onChange(digits === "" ? null : Number(digits));
      }} />
  );
}

export function ToggleRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.dark, fontWeight: "600" }}>{label}</Text>
        {!!hint && <Text style={{ color: C.muted, fontSize: 11 }}>{hint}</Text>}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: C.teal, false: C.border }} thumbColor={C.white} accessibilityLabel={label} />
    </View>
  );
}

export function Stepper({ label, value, min = 0, max = 99, onChange }: { label: string; value: number; min?: number; max?: number; onChange: (v: number) => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6 }}>
      <Text style={{ flex: 1, color: C.dark, fontWeight: "600" }}>{label}</Text>
      <TouchableOpacity onPress={() => onChange(Math.max(min, value - 1))} accessibilityLabel={`${label} minus`}
        style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="remove" size={18} color={C.dark} />
      </TouchableOpacity>
      <Text style={{ width: 40, textAlign: "center", fontWeight: "800", fontSize: 16, color: C.dark }}>{value}</Text>
      <TouchableOpacity onPress={() => onChange(Math.min(max, value + 1))} accessibilityLabel={`${label} plus`}
        style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="add" size={18} color={C.dark} />
      </TouchableOpacity>
    </View>
  );
}

export function PrimaryButton({ label, onPress, busy, disabled, color = C.teal, icon }: {
  label: string; onPress: () => void; busy?: boolean; disabled?: boolean; color?: string; icon?: keyof typeof Ionicons.glyphMap;
}) {
  const off = disabled || busy;
  return (
    <TouchableOpacity onPress={onPress} disabled={off} accessibilityRole="button" accessibilityState={{ disabled: !!off }}
      style={{ backgroundColor: off ? C.muted : color, borderRadius: 14, paddingVertical: 15, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}>
      {busy ? <ActivityIndicator color={C.white} /> : (
        <>
          {icon && <Ionicons name={icon} size={18} color={C.white} />}
          <Text style={{ color: C.white, fontWeight: "900", fontSize: 15 }}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export function SecondaryButton({ label, onPress, color = C.dark, icon }: { label: string; onPress: () => void; color?: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="button"
      style={{ borderRadius: 14, paddingVertical: 13, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, borderWidth: 1.5, borderColor: color, backgroundColor: C.white }}>
      {icon && <Ionicons name={icon} size={18} color={color} />}
      <Text style={{ color, fontWeight: "800", fontSize: 14 }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Row({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, gap: 12 }}>
      <Text style={{ color: bold ? C.dark : C.mid, fontWeight: bold ? "800" : "500", flexShrink: 1 }}>{label}</Text>
      <Text style={{ color: color ?? C.dark, fontWeight: bold ? "900" : "700" }}>{value}</Text>
    </View>
  );
}

export function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" }}>
      <Text style={{ color, fontWeight: "800", fontSize: 11 }}>{label}</Text>
    </View>
  );
}

export function Empty({ icon, title, text }: { icon: keyof typeof Ionicons.glyphMap; title: string; text?: string }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 40, paddingHorizontal: 24 }}>
      <Ionicons name={icon} size={40} color={C.muted} />
      <Text style={{ color: C.dark, fontWeight: "800", fontSize: 15, marginTop: 10, textAlign: "center" }}>{title}</Text>
      {!!text && <Text style={{ color: C.mid, fontSize: 13, marginTop: 4, textAlign: "center" }}>{text}</Text>}
    </View>
  );
}
