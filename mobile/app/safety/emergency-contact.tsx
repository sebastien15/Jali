import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { C } from "@/constants/theme";

/** Emergency contact used by SOS (story S8.2) */
export default function EmergencyContactScreen() {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<{ name: string | null; phone: string | null }>("/me/emergency-contact")
      .then(r => { setName(r.data.name ?? ""); setPhone(r.data.phone ?? ""); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      await api.put("/me/emergency-contact", { name: name.trim(), phone: phone.trim() });
      Alert.alert(t("safety.saved"));
      router.back();
    } catch (err: any) {
      const errors = err?.response?.data?.errors;
      Alert.alert(errors ? (Object.values(errors)[0] as string[])[0] : err?.response?.data?.message ?? "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />
      <View style={{ backgroundColor: C.white, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel={t("common.back")}>
          <Ionicons name="arrow-back" size={24} color={C.dark} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontWeight: "900", fontSize: 18, color: C.dark }}>{t("safety.contactTitle")}</Text>
      </View>
      {loading ? <ActivityIndicator color={C.teal} style={{ marginTop: 32 }} /> : (
        <View style={{ padding: 16, gap: 12 }}>
          <Text style={{ color: C.mid }}>{t("safety.contactSub")}</Text>
          <TextInput value={name} onChangeText={setName} placeholder={t("safety.contactName")} placeholderTextColor={C.muted} accessibilityLabel={t("safety.contactName")}
            style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, color: C.dark }} />
          <TextInput value={phone} onChangeText={setPhone} placeholder="+250 7xx xxx xxx" keyboardType="phone-pad" placeholderTextColor={C.muted} accessibilityLabel={t("safety.contactPhone")}
            style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, color: C.dark }} />
          <TouchableOpacity onPress={save} disabled={saving || !name.trim() || !phone.trim()} accessibilityLabel={t("hire.settings.save")}
            style={{ backgroundColor: !name.trim() || !phone.trim() ? C.muted : C.dark, borderRadius: 14, paddingVertical: 15, alignItems: "center" }}>
            {saving ? <ActivityIndicator color={C.white} /> : <Text style={{ color: C.white, fontWeight: "900" }}>{t("hire.settings.save")}</Text>}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
