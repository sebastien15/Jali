import { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { auth } from "@/lib/firebase";
import {
  signInWithPhoneNumber,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import { C } from "@/constants/theme";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID =
  "563763864352-oi6rut9aru8t4q7q922f2lpim4usfj0m.apps.googleusercontent.com";

export default function LoginScreen() {
  const [step, setStep]           = useState<"phone" | "otp">("phone");
  const [phone, setPhone]         = useState("");
  const [otp, setOtp]             = useState(["", "", "", "", "", ""]);
  const [loading, setLoading]     = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [confirmation, setConfirmation]   = useState<any>(null);

  const otpRefs = Array.from({ length: 6 }, () => useRef<TextInput>(null));

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    redirectUri: "https://auth.expo.io/@sebastien12/jali",
  });

  useEffect(() => {
    if (response?.type === "success") {
      const { id_token } = response.params;
      setGoogleLoading(true);
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential)
        .catch((e) => Alert.alert("Google sign-in failed", e.message))
        .finally(() => setGoogleLoading(false));
    } else if (response?.type === "error") {
      Alert.alert("Google sign-in error", response.error?.message ?? "Unknown error");
    }
  }, [response]);

  async function sendCode() {
    if (phone.length < 9) {
      Alert.alert("Enter a valid Rwandan number");
      return;
    }
    setLoading(true);
    try {
      const fullPhone = `+250${phone.replace(/\s/g, "")}`;
      // Mock verifier — works with Firebase test phone numbers (no reCAPTCHA WebView needed).
      // Production phone auth will be handled by the Laravel backend via Firebase Admin SDK.
      const mockVerifier = { type: "recaptcha", verify: async () => "" } as any;
      const result = await signInWithPhoneNumber(auth, fullPhone, mockVerifier);
      setConfirmation(result);
      setStep("otp");
    } catch (e: any) {
      Alert.alert("Error sending code", e.message);
    } finally {
      setLoading(false);
    }
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
              onPress={() => promptAsync()}
              disabled={!request || googleLoading}
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
