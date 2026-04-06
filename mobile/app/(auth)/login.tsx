import { useState, useRef } from "react";
import { router } from "expo-router";
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from "react-native";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { auth } from "@/lib/firebase";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { isDev } from "@/lib/env";

GoogleSignin.configure({
  webClientId: "563763864352-oi6rut9aru8t4q7q922f2lpim4usfj0m.apps.googleusercontent.com",
});

export default function LoginScreen() {
  const [step, setStep]           = useState<"phone" | "otp">("phone");
  const [phone, setPhone]         = useState("");
  const [otp, setOtp]             = useState(["", "", "", "", "", ""]);
  const [loading, setLoading]     = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [confirmation, setConfirmation]   = useState<any>(null);

  const otpRef0 = useRef<TextInput>(null);
  const otpRef1 = useRef<TextInput>(null);
  const otpRef2 = useRef<TextInput>(null);
  const otpRef3 = useRef<TextInput>(null);
  const otpRef4 = useRef<TextInput>(null);
  const otpRef5 = useRef<TextInput>(null);
  const otpRefs = [otpRef0, otpRef1, otpRef2, otpRef3, otpRef4, otpRef5];

  async function signInWithGoogle() {
    // In dev mode skip Firebase — native libs don't work in Expo Go
    if (isDev) {
      router.replace("/(tabs)");
      return;
    }
    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const { data } = await GoogleSignin.signIn();
      const credential = GoogleAuthProvider.credential(data?.idToken ?? null);
      await signInWithCredential(auth, credential);
      // Register/sync user with Laravel backend
      try {
        await api.post("/auth/login");
      } catch (err: any) {
        // Still redirect to tabs — Firebase auth succeeded
        // Backend will be retried on next API call
        console.warn("Backend sync failed, but Firebase auth succeeded:", err?.response?.data?.message);
      }
      router.replace("/(tabs)");
    } catch (e: any) {
      Alert.alert("Google sign-in failed", e.message);
    } finally {
      setGoogleLoading(false);
    }
  }

  async function sendCode() {
    if (phone.length < 9) {
      Alert.alert("Enter a valid Rwandan number");
      return;
    }
    // Phone OTP will be wired to the Laravel backend.
    Alert.alert(
      "Coming soon",
      "Phone sign-in is not yet available. Use Google sign-in for now.",
    );
  }

  async function verifyCode() {
    const code = otp.join("");
    if (code.length < 6) return;
    setLoading(true);
    try {
      await confirmation.confirm(code);
      // onAuthStateChanged in index.tsx redirects to tabs
    } catch (e: any) {
      Alert.alert("Wrong code", e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleOtpChange(val: string, idx: number) {
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    if (val && idx < 5) otpRefs[idx + 1].current?.focus();
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={{
        backgroundColor: C.blue, paddingTop: 72, paddingBottom: 36,
        paddingHorizontal: 28,
      }}>
        <Text style={{ color: C.yellow, fontWeight: "900", fontSize: 36, letterSpacing: -1 }}>
          Jali
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 15, marginTop: 4, fontWeight: "600" }}>
          {step === "phone" ? "Enter your Rwandan number" : "Enter the 6-digit code we sent"}
        </Text>
      </View>

      {/* Body */}
      <View style={{ flex: 1, padding: 28, gap: 16 }}>
        {step === "phone" ? (
          <>
            {/* Phone input */}
            <View style={{
              backgroundColor: C.white, borderRadius: 16, flexDirection: "row",
              alignItems: "center", borderWidth: 2.5, borderColor: C.blue, overflow: "hidden",
            }}>
              <View style={{
                paddingHorizontal: 14, borderRightWidth: 2, borderRightColor: C.border,
                paddingVertical: 18,
              }}>
                <Text style={{ fontWeight: "700", color: C.mid, fontSize: 15 }}>🇷🇼 +250</Text>
              </View>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="7XX XXX XXX"
                keyboardType="phone-pad"
                maxLength={12}
                style={{
                  flex: 1, fontSize: 18, fontWeight: "800", color: C.dark,
                  paddingHorizontal: 16, paddingVertical: 18,
                }}
              />
            </View>
            <PrimaryBtn label="Send Code →" color={C.blue} onPress={sendCode} loading={loading} />

            {/* Divider */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 4 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
              <Text style={{ color: C.muted, fontSize: 13 }}>or</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
            </View>

            {/* Google sign-in */}
            <TouchableOpacity
              onPress={signInWithGoogle}
              disabled={googleLoading}
              style={{
                backgroundColor: C.white, borderRadius: 16, paddingVertical: 16,
                alignItems: "center", flexDirection: "row", justifyContent: "center",
                gap: 10, borderWidth: 2, borderColor: C.border,
              }}
            >
              {googleLoading
                ? <ActivityIndicator color={C.mid} />
                : <>
                    <Text style={{ fontSize: 20 }}>🌐</Text>
                    <Text style={{ fontWeight: "700", color: C.dark, fontSize: 15 }}>
                      Continue with Google
                    </Text>
                  </>
              }
            </TouchableOpacity>

            <Text style={{ textAlign: "center", color: C.muted, fontSize: 12 }}>
              Google sign-in is available for international travelers
            </Text>
          </>
        ) : (
          <>
            {/* 6-digit OTP */}
            <View style={{ flexDirection: "row", gap: 8, justifyContent: "center" }}>
              {otp.map((val, i) => (
                <TextInput
                  key={i}
                  ref={otpRefs[i]}
                  value={val}
                  onChangeText={(v) => handleOtpChange(v.slice(-1), i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  style={{
                    width: 48, height: 60, textAlign: "center", fontSize: 26,
                    fontWeight: "900", borderWidth: 3, borderColor: C.blue,
                    borderRadius: 14, color: C.blue, backgroundColor: C.white,
                  }}
                />
              ))}
            </View>
            <PrimaryBtn label="✓ Verify & Enter" color={C.green} onPress={verifyCode} loading={loading} />
            <TouchableOpacity onPress={() => { setStep("phone"); setOtp(["","","","","",""]); }}>
              <Text style={{ textAlign: "center", color: C.muted, fontSize: 13 }}>
                ← Change number
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function PrimaryBtn({ label, color, onPress, loading }: {
  label: string; color: string; onPress: () => void; loading?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      style={{ backgroundColor: color, borderRadius: 16, paddingVertical: 18, alignItems: "center" }}
    >
      {loading
        ? <ActivityIndicator color="#fff" />
        : <Text style={{ color: color === C.blue ? C.yellow : C.white, fontWeight: "900", fontSize: 17 }}>
            {label}
          </Text>
      }
    </TouchableOpacity>
  );
}
