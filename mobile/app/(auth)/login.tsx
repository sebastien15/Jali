import { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { auth } from "@/lib/firebase";
import { signInAnonymously, GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { C } from "@/constants/theme";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID =
  "563763864352-oi6rut9aru8t4q7q922f2lpim4usfj0m.apps.googleusercontent.com";

export default function LoginScreen() {
  const [step, setStep]       = useState<"phone" | "otp">("phone");
  const [phone, setPhone]     = useState("");
  const [otp, setOtp]         = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const otpRefs = [
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
  ];

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: "563763864352-90a5m3b776hv9t2g5aq9f3b04er1jcbm.apps.googleusercontent.com",
    webClientId: GOOGLE_WEB_CLIENT_ID,
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
      // TODO: replace with expo-firebase-recaptcha for production phone auth
      Alert.alert("Code sent to " + fullPhone, "Use 123456 in dev mode");
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
      // TODO: replace with real Firebase phone credential once recaptcha is wired up
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
        <Text style={{ color: C.yellow, fontWeight: "900", fontSize: 36, letterSpacing: -1 }}>
          Jali
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 15, marginTop: 4, fontWeight: "600" }}>
          {step === "phone" ? "Enter your Rwandan number" : "Type the code we sent you"}
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
            <PrimaryBtn label="✓ Verify & Enter" color={C.green} onPress={verifyCode} loading={loading} />
            <TouchableOpacity onPress={() => setStep("phone")}>
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
