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

export default function AdminProfileScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { handleLogout } = useAdminNav();
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [saving, setSaving] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [contractLoading, setContractLoading] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.adminProfile(),
    queryFn: () => api.get("/admin/profile").then(r => r.data),
    staleTime: Infinity,
  });

  // Sync form fields when profile loads
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
    const localUri = asset.uri;
    setImageLoading(true);

    try {
      const compressed = await ImageManipulator.manipulateAsync(
        localUri,
        [{ resize: { width: 400, height: 400 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      const formData = new FormData();
      if (typeof window !== "undefined" && compressed.uri.startsWith("blob:")) {
        const response = await fetch(compressed.uri);
        const blob = await response.blob();
        formData.append("image", blob, "profile.jpg");
      } else {
        formData.append("image", {
          uri: compressed.uri,
          name: "profile.jpg",
          type: "image/jpeg",
        } as any);
      }

      await api.post("/admin/profile/image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminProfile() });
    } catch (e: any) {
      console.log("[Profile] image upload error:", e?.response?.status, e?.response?.data);
    } finally {
      setImageLoading(false);
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
    } catch (e: any) {
      console.log("[Contract] upload error:", e?.response?.status, e?.response?.data);
    } finally {
      setContractLoading(false);
    }
  }

  if (isLoading || !profile) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: C.bg,
        }}
      >
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
            {profile.profile_image_url ? (
              <Image
                source={{ uri: profile.profile_image_url }}
                style={{ width: 100, height: 100, borderRadius: 50 }}
              />
            ) : (
              <View
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: 50,
                  backgroundColor: C.tealLt,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 2,
                  borderColor: C.teal,
                  borderStyle: "dashed",
                }}
              >
                <Ionicons name="camera-outline" size={32} color={C.teal} />
              </View>
            )}
            {imageLoading && (
              <View
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundColor: "rgba(0,0,0,0.4)",
                  borderRadius: 50,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ActivityIndicator color={C.white} />
              </View>
            )}
          </TouchableOpacity>
          <Text
            style={{
              color: C.dark,
              fontWeight: "800",
              fontSize: 18,
              marginTop: 12,
            }}
          >
            {profile.name}
          </Text>
          <Text style={{ color: C.muted, fontSize: 13 }}>{profile.email}</Text>
          {profile.location && (
            <Text
              style={{
                color: C.teal,
                fontSize: 12,
                fontWeight: "600",
                marginTop: 4,
              }}
            >
              📍 {profile.location.name}, {profile.location.city}
            </Text>
          )}
        </View>

        {/* Contact Info */}
        <Section title="Contact Details" />
        <Field label="Phone Number">
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="+250 7XX XXX XXX"
            keyboardType="phone-pad"
            style={inputStyle}
          />
        </Field>
        <Field label="WhatsApp Number">
          <TextInput
            value={whatsapp}
            onChangeText={setWhatsapp}
            placeholder="+250 7XX XXX XXX"
            keyboardType="phone-pad"
            style={inputStyle}
          />
        </Field>

        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={{
            backgroundColor: C.teal,
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          {saving ? (
            <ActivityIndicator color={C.white} />
          ) : (
            <Text style={{ color: C.white, fontWeight: "800", fontSize: 15 }}>
              Save Changes
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleLogout}
          style={{
            backgroundColor: "rgba(220,38,38,0.08)",
            borderRadius: 14,
            paddingVertical: 16,
            paddingHorizontal: 16,
            marginBottom: 24,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            borderWidth: 1,
            borderColor: "rgba(220,38,38,0.2)",
          }}
        >
          <Ionicons name="log-out-outline" size={18} color="#DC2626" />
          <Text style={{ color: "#DC2626", fontWeight: "800", fontSize: 15 }}>
            Log Out
          </Text>
        </TouchableOpacity>

        {/* Contract */}
        <Section title="Contract Document" />
        <View
          style={{
            backgroundColor: C.white,
            borderRadius: 16,
            padding: 16,
            marginBottom: 24,
          }}
        >
          {profile.contract_doc_url ? (
            <>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 8,
                }}
              >
                <Ionicons name="document-text" size={24} color={C.teal} />
                <Text
                  style={{
                    color: C.dark,
                    fontWeight: "700",
                    fontSize: 14,
                    flex: 1,
                  }}
                >
                  Contract Uploaded
                </Text>
                <View
                  style={{
                    backgroundColor: profile.contract_verified
                      ? C.greenLt
                      : C.orangeLt,
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}
                >
                  <Text
                    style={{
                      color: profile.contract_verified ? C.green : C.orange,
                      fontWeight: "700",
                      fontSize: 11,
                    }}
                  >
                    {profile.contract_verified ? "Verified" : "Pending Review"}
                  </Text>
                </View>
              </View>
              <Text style={{ color: C.muted, fontSize: 12 }} numberOfLines={1}>
                {profile.contract_doc_url}
              </Text>
            </>
          ) : (
            <Text style={{ color: C.muted, fontSize: 13, marginBottom: 12 }}>
              No contract uploaded yet.
            </Text>
          )}
          <TouchableOpacity
            onPress={pickContract}
            disabled={contractLoading}
            style={{
              backgroundColor: C.bg,
              borderRadius: 12,
              paddingVertical: 12,
              alignItems: "center",
              marginTop: 12,
            }}
          >
            {contractLoading ? (
              <ActivityIndicator color={C.teal} />
            ) : (
              <Text style={{ color: C.teal, fontWeight: "700", fontSize: 13 }}>
                📄{" "}
                {profile.contract_doc_url
                  ? "Replace Contract"
                  : "Upload Contract (PDF)"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title }: { title: string }) {
  return (
    <Text
      style={{
        color: C.muted,
        fontSize: 11,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 10,
      }}
    >
      {title}
    </Text>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text
        style={{
          fontWeight: "700",
          fontSize: 13,
          color: C.mid,
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

const inputStyle = {
  backgroundColor: C.white,
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 13,
  fontSize: 15,
  color: C.dark,
  borderWidth: 1.5,
  borderColor: C.border,
};
