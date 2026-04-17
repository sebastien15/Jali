import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as DocumentPicker from "expo-document-picker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { useTranslation } from "react-i18next";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminNav } from "@/components/admin/AdminNavContext";
import { queryKeys } from "@/lib/queryKeys";
import { setLanguage, getLanguage } from "@/lib/i18n";

export default function AdminProfileScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { handleLogout, isSuperAdmin } = useAdminNav();
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [saving, setSaving] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [contractLoading, setContractLoading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [cashoutMethodModal, setCashoutMethodModal] = useState(false);
  const [cashoutForm, setCashoutForm] = useState({ method: "mobile" as "bank" | "mobile", account_number: "", account_name: "", bank_name: "" });
  const [savingCashout, setSavingCashout] = useState(false);
  const [requestingCashout, setRequestingCashout] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.adminProfile(),
    queryFn: () => api.get("/admin/profile").then(r => r.data),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (profile) {
      setPhone(profile.phone ?? "");
      setWhatsapp(profile.whatsapp_number ?? "");
    }
  }, [profile]);

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch("/admin/profile", { phone, whatsapp_number: whatsapp });
      Alert.alert("Saved", "Profile updated.");
      queryClient.invalidateQueries({ queryKey: queryKeys.adminProfile() });
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setImageLoading(true);

    try {
      const compressed = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 200, height: 200 } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      const dataUri = `data:image/jpeg;base64,${compressed.base64}`;
      setLocalPreview(dataUri);

      await api.post("/admin/profile/image", { image_base64: dataUri });

      // Invalidate both caches so header also updates immediately
      queryClient.invalidateQueries({ queryKey: queryKeys.adminProfile() });
      queryClient.invalidateQueries({ queryKey: queryKeys.me() });
      setLocalPreview(null);
    } catch (e: any) {
      setLocalPreview(null);
      const msg = e?.response?.data?.message ?? "Failed to upload photo. Please try again.";
      Alert.alert("Upload failed", msg);
    } finally {
      setImageLoading(false);
    }
  }

  const LANGUAGES = [
    { code: "en", label: "English" },
    { code: "fr", label: "Français" },
    { code: "rw", label: "Kinyarwanda" },
    { code: "sw", label: "Kiswahili" },
  ];

  function pickLanguage() {
    const current = getLanguage();
    Alert.alert(
      "Language",
      "Choose your preferred language",
      [
        ...LANGUAGES.map(lang => ({
          text: current === lang.code ? `✓ ${lang.label}` : lang.label,
          onPress: () => setLanguage(lang.code),
        })),
        { text: "Cancel", style: "cancel" as const },
      ]
    );
  }

  const SUPPORT_WHATSAPP = "https://wa.me/250788451691?text=Hi%20Jali%20Support%2C%20I%20need%20help.";
  const PLAY_STORE_URL = "market://details?id=com.jali.app";
  const APP_STORE_URL = "https://apps.apple.com/app/jali/id0000000000";

  const SETTINGS_MENU = [
    { icon: "language-outline" as const, label: "Language", sub: "Kinyarwanda / English / Français", onPress: pickLanguage },
    { icon: "help-circle-outline" as const, label: "Help & Support", sub: "WhatsApp · Mon–Sat 8am–6pm", onPress: () => Linking.openURL(SUPPORT_WHATSAPP) },
    { icon: "star-outline" as const, label: "Rate Jali", sub: "Share your feedback", onPress: () => Linking.openURL(Platform.OS === "ios" ? APP_STORE_URL : PLAY_STORE_URL) },
    { icon: "shield-checkmark-outline" as const, label: "Privacy Policy", sub: "How we handle your data", onPress: () => {} },
    { icon: "reader-outline" as const, label: "Terms & Conditions", sub: "Usage terms", onPress: () => {} },
  ];

  async function saveCashoutPreference() {
    if (!cashoutForm.account_number.trim()) {
      Alert.alert("Required", "Please enter an account number.");
      return;
    }
    if (cashoutForm.method === "bank" && !cashoutForm.bank_name.trim()) {
      Alert.alert("Required", "Please enter the bank name.");
      return;
    }
    setSavingCashout(true);
    try {
      await api.post("/admin/cashout/preference", {
        cashout_method: cashoutForm.method,
        cashout_account_number: cashoutForm.account_number.trim(),
        cashout_account_name: cashoutForm.account_name.trim() || undefined,
        cashout_bank_name: cashoutForm.method === "bank" ? cashoutForm.bank_name.trim() : undefined,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminProfile() });
      setCashoutMethodModal(false);
      Alert.alert("Saved", "Cashout method saved.");
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.message ?? "Failed to save.");
    } finally {
      setSavingCashout(false);
    }
  }

  async function requestCashout() {
    const available = profile.total_earnings ?? 0;
    if (available <= 0) {
      Alert.alert("No earnings", "You have no available earnings to cash out.");
      return;
    }
    Alert.alert(
      "Request Cashout",
      `Request cashout of ${available.toLocaleString()} RWF to ${profile.cashout_method === "bank" ? `${profile.cashout_bank_name} (${profile.cashout_account_number})` : `Mobile (${profile.cashout_account_number})`}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Request",
          onPress: async () => {
            setRequestingCashout(true);
            try {
              await api.post("/admin/cashout/requests", { amount: available });
              Alert.alert("Submitted", "Your cashout request has been submitted and will be processed soon.");
            } catch (e: any) {
              Alert.alert("Error", e?.response?.data?.message ?? "Failed to submit request.");
            } finally {
              setRequestingCashout(false);
            }
          },
        },
      ]
    );
  }

  async function downloadTemplate() {
    try {
      const res = await api.get("/admin/profile/contract-template", { maxRedirects: 0 });
      const url = res.headers?.location ?? res.data?.url;
      if (url) await Linking.openURL(url);
    } catch (e: any) {
      const redirectUrl = e?.response?.headers?.location;
      if (redirectUrl) {
        await Linking.openURL(redirectUrl);
      } else {
        Alert.alert("Not available", "Contract template is not configured yet. Contact the administrator.");
      }
    }
  }

  async function pickContract() {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setContractLoading(true);
    try {
      const formData = new FormData();
      if (typeof window !== "undefined" && asset.uri.startsWith("blob:")) {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        formData.append("contract", blob, asset.name ?? "contract.pdf");
      } else {
        formData.append("contract", {
          uri: asset.uri,
          name: asset.name ?? "contract.pdf",
          type: "application/pdf",
        } as any);
      }
      await api.post("/admin/profile/contract", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminProfile() });
      Alert.alert("Uploaded", "Contract submitted for review.");
    } catch (e: any) {
      Alert.alert("Upload failed", e?.response?.data?.message ?? "Failed to upload contract.");
    } finally {
      setContractLoading(false);
    }
  }

  if (isLoading || !profile) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: C.bg }}>
        <ActivityIndicator size="large" color={C.teal} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />
      <AdminHeader title="Profile" />

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Profile Image */}
        <View style={{ alignItems: "center", marginBottom: 24 }}>
          <TouchableOpacity onPress={pickImage} disabled={imageLoading}>
            {(localPreview ?? profile.profile_image_url) ? (
              <Image
                source={{ uri: localPreview ?? profile.profile_image_url }}
                style={{ width: 100, height: 100, borderRadius: 50 }}
              />
            ) : (
              <View style={{
                width: 100, height: 100, borderRadius: 50,
                backgroundColor: C.tealLt, alignItems: "center", justifyContent: "center",
                borderWidth: 2, borderColor: C.teal, borderStyle: "dashed",
              }}>
                <Ionicons name="camera-outline" size={32} color={C.teal} />
              </View>
            )}
            {imageLoading && (
              <View style={{
                position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.4)",
                borderRadius: 50, alignItems: "center", justifyContent: "center",
              }}>
                <ActivityIndicator color={C.white} />
              </View>
            )}
          </TouchableOpacity>
          <Text style={{ color: C.dark, fontWeight: "800", fontSize: 18, marginTop: 12 }}>
            {profile.name}
          </Text>
          <Text style={{ color: C.muted, fontSize: 13 }}>{profile.email}</Text>
          {profile.location && (
            <Text style={{ color: C.teal, fontSize: 12, fontWeight: "600", marginTop: 4 }}>
              📍 {profile.location.name}, {profile.location.city}
            </Text>
          )}
        </View>

        {/* Contact Info */}
        <Section title="Contact Details" />
        <Field label="Phone Number">
          <TextInput
            value={phone} onChangeText={setPhone}
            placeholder="+250 7XX XXX XXX" keyboardType="phone-pad"
            style={inputStyle}
          />
        </Field>
        <Field label="WhatsApp Number">
          <TextInput
            value={whatsapp} onChangeText={setWhatsapp}
            placeholder="+250 7XX XXX XXX" keyboardType="phone-pad"
            style={inputStyle}
          />
        </Field>

        <TouchableOpacity
          onPress={handleSave} disabled={saving}
          style={{ backgroundColor: C.teal, borderRadius: 14, paddingVertical: 16, alignItems: "center", marginBottom: 24 }}
        >
          {saving ? <ActivityIndicator color={C.white} /> : (
            <Text style={{ color: C.white, fontWeight: "800", fontSize: 15 }}>Save Changes</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleLogout}
          style={{
            backgroundColor: "rgba(220,38,38,0.08)", borderRadius: 14,
            paddingVertical: 16, paddingHorizontal: 16, marginBottom: 24,
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
            borderWidth: 1, borderColor: "rgba(220,38,38,0.2)",
          }}
        >
          <Ionicons name="log-out-outline" size={18} color="#DC2626" />
          <Text style={{ color: "#DC2626", fontWeight: "800", fontSize: 15 }}>Log Out</Text>
        </TouchableOpacity>

        {/* Assigned Station — non-superadmin */}
        {!isSuperAdmin && profile.assigned_station && (
          <>
            <Section title="My Station" />
            <View style={{ backgroundColor: C.tealLt, borderRadius: 14, padding: 14, marginBottom: 24, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Ionicons name="location" size={24} color={C.teal} />
              <View>
                <Text style={{ color: C.teal, fontWeight: "900", fontSize: 16 }}>{profile.assigned_station.city}</Text>
                {profile.assigned_station.district ? (
                  <Text style={{ color: C.teal, fontSize: 12 }}>{profile.assigned_station.district}</Text>
                ) : null}
              </View>
            </View>
          </>
        )}

        {/* Cashout */}
        <Section title="Earnings & Cashout" />
        <View style={{ backgroundColor: C.white, borderRadius: 16, padding: 16, marginBottom: 24 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase" }}>Available</Text>
              <Text style={{ color: C.teal, fontWeight: "900", fontSize: 24 }}>
                {(profile.total_earnings ?? 0).toLocaleString()}
                <Text style={{ fontSize: 13, fontWeight: "600", color: C.muted }}> RWF</Text>
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setCashoutForm({
                  method: profile.cashout_method ?? "mobile",
                  account_number: profile.cashout_account_number ?? "",
                  account_name: profile.cashout_account_name ?? "",
                  bank_name: profile.cashout_bank_name ?? "",
                });
                setCashoutMethodModal(true);
              }}
              style={{ padding: 8, backgroundColor: C.bg, borderRadius: 10 }}
            >
              <Ionicons name="settings-outline" size={20} color={C.mid} />
            </TouchableOpacity>
          </View>

          {profile.cashout_method ? (
            <View style={{ backgroundColor: C.bg, borderRadius: 10, padding: 10, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name={profile.cashout_method === "bank" ? "card-outline" : "phone-portrait-outline"} size={16} color={C.teal} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.dark, fontWeight: "700", fontSize: 13 }}>
                  {profile.cashout_method === "bank" ? profile.cashout_bank_name ?? "Bank" : "Mobile Money"}
                </Text>
                <Text style={{ color: C.muted, fontSize: 12 }}>{profile.cashout_account_number}</Text>
              </View>
            </View>
          ) : (
            <Text style={{ color: C.muted, fontSize: 13, marginBottom: 12 }}>
              No cashout method set. Tap the settings icon to add one.
            </Text>
          )}

          <TouchableOpacity
            onPress={requestCashout}
            disabled={requestingCashout || !profile.cashout_method}
            style={{
              backgroundColor: profile.cashout_method ? C.teal : C.border,
              borderRadius: 12, paddingVertical: 13, alignItems: "center",
            }}
          >
            {requestingCashout ? <ActivityIndicator color={C.white} /> : (
              <Text style={{ color: C.white, fontWeight: "800", fontSize: 14 }}>
                Request Cashout
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Cashout method modal */}
        <Modal visible={cashoutMethodModal} animationType="slide" transparent>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
              <View style={{ width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginBottom: 20 }} />
              <Text style={{ fontWeight: "900", fontSize: 18, color: C.dark, marginBottom: 16 }}>Cashout Method</Text>

              {/* Method toggle */}
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
                {(["mobile", "bank"] as const).map(m => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setCashoutForm(f => ({ ...f, method: m }))}
                    style={{
                      flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center",
                      backgroundColor: cashoutForm.method === m ? C.teal : C.bg,
                      flexDirection: "row", justifyContent: "center", gap: 6,
                    }}
                  >
                    <Ionicons name={m === "bank" ? "card-outline" : "phone-portrait-outline"} size={16} color={cashoutForm.method === m ? C.white : C.mid} />
                    <Text style={{ color: cashoutForm.method === m ? C.white : C.dark, fontWeight: "700" }}>
                      {m === "bank" ? "Bank" : "Mobile Money"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {cashoutForm.method === "bank" && (
                <>
                  <Text style={{ color: C.muted, fontSize: 12, fontWeight: "700", marginBottom: 6 }}>BANK NAME</Text>
                  <TextInput
                    value={cashoutForm.bank_name}
                    onChangeText={v => setCashoutForm(f => ({ ...f, bank_name: v }))}
                    placeholder="e.g. Equity Bank Rwanda"
                    placeholderTextColor={C.muted}
                    style={{ backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.dark, borderWidth: 1.5, borderColor: C.border, marginBottom: 12 }}
                  />
                  <Text style={{ color: C.muted, fontSize: 12, fontWeight: "700", marginBottom: 6 }}>ACCOUNT NAME</Text>
                  <TextInput
                    value={cashoutForm.account_name}
                    onChangeText={v => setCashoutForm(f => ({ ...f, account_name: v }))}
                    placeholder="Account holder name"
                    placeholderTextColor={C.muted}
                    style={{ backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.dark, borderWidth: 1.5, borderColor: C.border, marginBottom: 12 }}
                  />
                </>
              )}

              <Text style={{ color: C.muted, fontSize: 12, fontWeight: "700", marginBottom: 6 }}>
                {cashoutForm.method === "bank" ? "ACCOUNT NUMBER" : "PHONE NUMBER"}
              </Text>
              <TextInput
                value={cashoutForm.account_number}
                onChangeText={v => setCashoutForm(f => ({ ...f, account_number: v }))}
                placeholder={cashoutForm.method === "bank" ? "Bank account number" : "+250 7XX XXX XXX"}
                placeholderTextColor={C.muted}
                keyboardType="phone-pad"
                style={{ backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.dark, borderWidth: 1.5, borderColor: C.border, marginBottom: 20 }}
              />

              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity onPress={() => setCashoutMethodModal(false)}
                  style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: C.bg, alignItems: "center" }}>
                  <Text style={{ color: C.mid, fontWeight: "700" }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveCashoutPreference} disabled={savingCashout}
                  style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: C.teal, alignItems: "center" }}>
                  {savingCashout ? <ActivityIndicator color={C.white} /> : (
                    <Text style={{ color: C.white, fontWeight: "800" }}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Settings & Info */}
        <Section title="Settings & Info" />
        {SETTINGS_MENU.map((item, i) => (
          <TouchableOpacity
            key={i}
            onPress={item.onPress}
            style={{
              backgroundColor: C.white, borderRadius: 14, padding: 14,
              marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 14,
              shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4,
              shadowOffset: { width: 0, height: 1 }, elevation: 1,
            }}
          >
            <View style={{ backgroundColor: C.bg, borderRadius: 10, width: 38, height: 38, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={item.icon} size={20} color={C.mid} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.dark, fontWeight: "700", fontSize: 14 }}>{item.label}</Text>
              <Text style={{ color: C.muted, fontSize: 12 }}>{item.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.muted} />
          </TouchableOpacity>
        ))}

        <View style={{ height: 8 }} />

        {/* Contract — hidden for superadmin */}
        {!isSuperAdmin && (
          <>
            <Section title="Contract Document" />

            {/* Instructions */}
            <View style={{
              backgroundColor: C.blueLt, borderRadius: 12, padding: 14, marginBottom: 12,
              borderLeftWidth: 3, borderLeftColor: C.blue,
            }}>
              <Text style={{ color: C.blue, fontWeight: "800", fontSize: 13, marginBottom: 6 }}>
                How to submit your contract
              </Text>
              <Text style={{ color: C.blue, fontSize: 12, lineHeight: 18 }}>
                1. Download the official contract template using the button below.{"\n"}
                2. Print, sign, and scan the document as a PDF.{"\n"}
                3. Upload the signed PDF using the "Upload Contract" button.{"\n"}
                4. Your contract will be reviewed by the team and verified shortly.
              </Text>
            </View>

            <View style={{ backgroundColor: C.white, borderRadius: 16, padding: 16, marginBottom: 24 }}>
              {/* Download template */}
              <TouchableOpacity
                onPress={downloadTemplate}
                style={{
                  flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                  backgroundColor: C.tealLt, borderRadius: 12, paddingVertical: 12, marginBottom: 12,
                }}
              >
                <Ionicons name="download-outline" size={16} color={C.teal} />
                <Text style={{ color: C.teal, fontWeight: "700", fontSize: 13 }}>
                  Download Contract Template
                </Text>
              </TouchableOpacity>

              {/* Upload status */}
              {profile.contract_doc_url ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <Ionicons name="document-text" size={24} color={C.teal} />
                  <Text style={{ color: C.dark, fontWeight: "700", fontSize: 14, flex: 1 }}>
                    Contract Uploaded
                  </Text>
                  <View style={{
                    backgroundColor: profile.contract_verified ? C.greenLt : C.orangeLt,
                    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
                  }}>
                    <Text style={{ color: profile.contract_verified ? C.green : C.orange, fontWeight: "700", fontSize: 11 }}>
                      {profile.contract_verified ? "Verified" : "Pending Review"}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={{ color: C.muted, fontSize: 13, marginBottom: 8 }}>
                  No contract uploaded yet.
                </Text>
              )}

              {/* Upload button */}
              <TouchableOpacity
                onPress={pickContract} disabled={contractLoading}
                style={{ backgroundColor: C.bg, borderRadius: 12, paddingVertical: 12, alignItems: "center", marginTop: 4 }}
              >
                {contractLoading ? <ActivityIndicator color={C.teal} /> : (
                  <Text style={{ color: C.teal, fontWeight: "700", fontSize: 13 }}>
                    📄 {profile.contract_doc_url ? "Replace Contract" : "Upload Signed Contract (PDF)"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title }: { title: string }) {
  return (
    <Text style={{
      color: C.muted, fontSize: 11, fontWeight: "700",
      textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10,
    }}>
      {title}
    </Text>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontWeight: "700", fontSize: 13, color: C.mid, marginBottom: 6 }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

const inputStyle = {
  backgroundColor: C.white, borderRadius: 12,
  paddingHorizontal: 14, paddingVertical: 13,
  fontSize: 15, color: C.dark,
  borderWidth: 1.5, borderColor: C.border,
};
