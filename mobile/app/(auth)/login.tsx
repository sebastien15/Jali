import { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from "react-native";
import { auth } from "@/lib/firebase";
import { signInAnonymously } from "firebase/auth";
import { C } from "@/constants/theme";

export default function LoginScreen() {
  const [step, setStep]         = useState<"phone" | "otp">("phone");
  const [phone, setPhone]       = useState("");
  const [otp, setOtp]           = useState(["", "", "", ""]);
  const [loading, setLoading]   = useState(false);
  const [verificationId, setVerificationId] = useState("");
  const otpRefs = [
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
  ];

  async function sendCode() {
    if (phone.length < 9) {
      Alert.alert("Enter a valid Rwandan number");
      return;
    }
    setLoading(true);
    try {
      // Firebase phone auth via REST (works in Expo Go with test numbers)
      // For production: use @firebase/auth with reCAPTCHA or expo-firebase-recaptcha
      const fullPhone = `+250${phone.replace(/\s/g, "")}`;
      // Placeholder — wires up once firebase-recaptcha is configured
      Alert.alert("Code sent to " + fullPhone, "Use 123456 in dev mode");
      setVerificationId("dev-placeholder");
      setStep("otp");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    const code = otp.join("");
    if (code.length < 4) return;
    setLoading(true);
    try {
      // DEV: sign in anonymously so auth guard redirects to tabs.
      // Replace with real Firebase phone auth before production.
      await signInAnonymously(auth);
    } catch (e: any) {
      Alert.alert("Sign-in error", e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleOtpChange(val: string, idx: number) {
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    if (val && idx < 3) otpRefs[idx + 1].current?.focus();
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
        <Text style={{
          color: C.yellow, fontWeight: "900", fontSize: 36, letterSpacing: -1,
        }}>Jali</Text>
        <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 15, marginTop: 4, fontWeight: "600" }}>
          {step === "phone" ? "Enter your Rwandan number" : "Type the code we sent you"}
        </Text>
      </View>

      {/* Body */}
      <View style={{ flex: 1, padding: 28, gap: 16 }}>
        {step === "phone" ? (
          <>
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
            <PrimaryBtn
              label="Send Code →"
              color={C.blue}
              onPress={sendCode}
              loading={loading}
            />
          </>
        ) : (
          <>
            <View style={{ flexDirection: "row", gap: 12, justifyContent: "center" }}>
              {otp.map((val, i) => (
                <TextInput
                  key={i}
                  ref={otpRefs[i]}
                  value={val}
                  onChangeText={(v) => handleOtpChange(v.slice(-1), i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  style={{
                    width: 64, height: 64, textAlign: "center", fontSize: 30,
                    fontWeight: "900", borderWidth: 3, borderColor: C.blue,
                    borderRadius: 16, color: C.blue, backgroundColor: C.white,
                  }}
                />
              ))}
            </View>
            <PrimaryBtn
              label="✓ Verify & Enter"
              color={C.green}
              onPress={verifyCode}
              loading={loading}
            />
            <TouchableOpacity onPress={() => setStep("phone")}>
              <Text style={{ textAlign: "center", color: C.muted, fontSize: 13 }}>
                ← Change number
              </Text>
            </TouchableOpacity>
          </>
        )}
        <Text style={{ textAlign: "center", color: C.muted, fontSize: 13 }}>
          For Rwandan nationals only 🇷🇼
        </Text>
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
      style={{
        backgroundColor: color, borderRadius: 16,
        paddingVertical: 18, alignItems: "center",
      }}
    >
      {loading
        ? <ActivityIndicator color="#fff" />
        : <Text style={{ color: color === C.blue ? C.yellow : C.white, fontWeight: "900", fontSize: 17 }}>{label}</Text>
      }
    </TouchableOpacity>
  );
}
