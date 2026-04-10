import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { router } from "expo-router";
import { auth } from "@/lib/firebase";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { ROLES, isAdminRole } from "@/constants/roles";
import { useTranslation } from "react-i18next";

export default function AdminLoginScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      // Firebase JS SDK — works in Expo Go, no rebuild needed
      await signInWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password,
      );

      // Call backend to verify roles (don't rely on index.tsx routing in test mode)
      const res = await api.post("/auth/login");
      const roles: string[] = res.data.user?.roles ?? [];

      if (roles.some(isAdminRole)) {
        router.replace("/(admin)/dashboard");
      } else {
        setError(t("authErrors.noAdminAccess"));
        await signOut(auth);
      }
    } catch (e: any) {
      const code = e?.code ?? "";
      const authCodes = [
        "auth/user-not-found",
        "auth/wrong-password",
        "auth/invalid-credential",
      ];
      if (authCodes.includes(code)) {
        setError(t("authErrors.invalidCredentials"));
      } else if (code === "auth/too-many-requests") {
        setError(t("authErrors.tooManyAttempts"));
      } else if (code === "auth/network-request-failed") {
        setError(t("authErrors.noInternet"));
      } else {
        setError(t("authErrors.unknown"));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />

      {/* Header */}
      <View
        style={{
          backgroundColor: C.teal,
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 28,
        }}
      >
        <TouchableOpacity
          onPress={() => router.replace("/(auth)/login")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            marginBottom: 16,
          }}
        >
          <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.7)" />
          <Text
            style={{
              color: "rgba(255,255,255,0.7)",
              fontSize: 13,
              fontWeight: "600",
            }}
          >
            Passenger login
          </Text>
        </TouchableOpacity>
        <Text style={{ color: C.white, fontWeight: "900", fontSize: 28 }}>
          Admin Portal
        </Text>
        <Text
          style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, marginTop: 4 }}
        >
          Sign in with your admin email
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, padding: 20 }}
      >
        {error && (
          <View
            style={{
              backgroundColor: C.orangeLt,
              borderRadius: 12,
              padding: 12,
              marginBottom: 16,
            }}
          >
            <Text style={{ color: C.orange, fontWeight: "600", fontSize: 13 }}>
              {error}
            </Text>
          </View>
        )}

        <View
          style={{
            backgroundColor: C.white,
            borderRadius: 20,
            padding: 20,
            shadowColor: "#000",
            shadowOpacity: 0.07,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 2 },
            elevation: 3,
          }}
        >
          <Text
            style={{
              fontWeight: "700",
              fontSize: 13,
              color: C.mid,
              marginBottom: 6,
            }}
          >
            Email
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="admin@jali.rw"
            placeholderTextColor={C.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            style={{
              backgroundColor: C.bg,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 13,
              fontSize: 15,
              color: C.dark,
              borderWidth: 1.5,
              borderColor: C.border,
              marginBottom: 16,
            }}
          />

          <Text
            style={{
              fontWeight: "700",
              fontSize: 13,
              color: C.mid,
              marginBottom: 6,
            }}
          >
            Password
          </Text>
          <View style={{ position: "relative", marginBottom: 24 }}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={C.muted}
              secureTextEntry={!showPass}
              style={{
                backgroundColor: C.bg,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 13,
                fontSize: 15,
                color: C.dark,
                borderWidth: 1.5,
                borderColor: C.border,
                paddingRight: 48,
              }}
            />
            <TouchableOpacity
              onPress={() => setShowPass((v) => !v)}
              style={{ position: "absolute", right: 14, top: 14 }}
            >
              <Ionicons
                name={showPass ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={C.muted}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            style={{
              backgroundColor: C.teal,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: "center",
            }}
          >
            {loading ? (
              <ActivityIndicator color={C.white} />
            ) : (
              <Text style={{ color: C.white, fontWeight: "900", fontSize: 16 }}>
                Sign In
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
