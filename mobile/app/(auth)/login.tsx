import { useRef, useState } from "react";
import { router } from "expo-router";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { GoogleSignin } from "@/lib/native/google-signin";
import { auth } from "@/lib/firebase";
import {
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import { C } from "@/constants/theme";
import api, { setApiToken, clearApiToken } from "@/lib/api";
import { isDev } from "@/lib/env";

export default function LoginScreen() {
  const { t } = useTranslation();
  const [step, setStep] = useState<"phone" | "email" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [confirmation, setConfirmation] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const otpRef0 = useRef<TextInput>(null);
  const otpRef1 = useRef<TextInput>(null);
  const otpRef2 = useRef<TextInput>(null);
  const otpRef3 = useRef<TextInput>(null);
  const otpRef4 = useRef<TextInput>(null);
  const otpRef5 = useRef<TextInput>(null);
  const otpRefs = [otpRef0, otpRef1, otpRef2, otpRef3, otpRef4, otpRef5];

  async function signInWithGoogle() {
    if (isDev) {
      router.replace("/(tabs)");
      return;
    }

    setGoogleLoading(true);
    setError(null);

    try {
      GoogleSignin.configure({
        webClientId:
          "563763864352-oi6rut9aru8t4q7q922f2lpim4usfj0m.apps.googleusercontent.com",
      });
      await GoogleSignin.hasPlayServices();
      const { data } = await GoogleSignin.signIn();
      const credential = GoogleAuthProvider.credential(data?.idToken ?? null);
      await signInWithCredential(auth, credential);

      // Get Laravel token via Google Firebase token
      try {
        const firebaseToken = await auth.currentUser?.getIdToken(true);
        if (firebaseToken) {
          const res = await api.post("/auth/login/google", {
            firebase_token: firebaseToken,
          });
          if (res.data.token) await setApiToken(res.data.token);
        }
      } catch (err: any) {
        console.warn("Backend sync failed:", err?.response?.data?.message);
      }

      router.replace("/(tabs)");
    } catch (e: any) {
      Alert.alert(t("login.googleSignInFailed"), e.message);
    } finally {
      setGoogleLoading(false);
    }
  }

  async function signInWithEmail() {
    if (!email.trim() || !password) {
      setError(t("login.emailPasswordRequired"));
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await api.post("/auth/login", {
        email: email.trim().toLowerCase(),
        password,
      });
      await setApiToken(res.data.token);
      router.replace("/(tabs)");
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 401 || status === 422) {
        setError(t("authErrors.invalidCredentials"));
      } else if (!e?.response) {
        setError(t("authErrors.noInternet"));
      } else {
        setError(t("authErrors.unknown"));
      }
    } finally {
      setLoading(false);
    }
  }

  async function sendCode() {
    if (phone.length < 9) {
      Alert.alert(t("login.validPhoneRequired"));
      return;
    }

    Alert.alert(t("login.comingSoon"), t("login.phoneNotAvailable"));
  }

  async function verifyCode() {
    const code = otp.join("");
    if (code.length < 6) return;

    setLoading(true);
    try {
      await confirmation.confirm(code);
    } catch (e: any) {
      Alert.alert(t("login.wrongCode"), e.message);
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

  const subtitle =
    step === "phone"
      ? t("login.enterPhone")
      : step === "email"
        ? t("login.emailLoginHint")
        : t("login.enterCode");

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        style={{
          backgroundColor: C.blue,
          paddingTop: 72,
          paddingBottom: 36,
          paddingHorizontal: 28,
        }}
      >
        <Text
          style={{
            color: C.yellow,
            fontWeight: "900",
            fontSize: 36,
            letterSpacing: -1,
          }}
        >
          Jali
        </Text>
        <Text
          style={{
            color: "rgba(255,255,255,0.75)",
            fontSize: 15,
            marginTop: 4,
            fontWeight: "600",
          }}
        >
          {subtitle}
        </Text>
      </View>

      <View style={{ flex: 1, padding: 28, gap: 16 }}>
        {step !== "otp" && (
          <View
            style={{
              backgroundColor: C.white,
              borderRadius: 16,
              padding: 6,
              flexDirection: "row",
              gap: 6,
              borderWidth: 1,
              borderColor: C.border,
            }}
          >
            {(
              [
                { id: "phone", label: t("login.phoneTab") },
                { id: "email", label: t("login.emailTab") },
              ] as const
            ).map((option) => {
              const active = step === option.id;

              return (
                <TouchableOpacity
                  key={option.id}
                  onPress={() => {
                    setError(null);
                    setStep(option.id);
                  }}
                  style={{
                    flex: 1,
                    borderRadius: 12,
                    backgroundColor: active ? C.blue : "transparent",
                    paddingVertical: 12,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: active ? C.white : C.mid,
                      fontWeight: "800",
                      fontSize: 14,
                    }}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {error && (
          <View
            style={{
              backgroundColor: C.orangeLt,
              borderRadius: 14,
              padding: 12,
            }}
          >
            <Text style={{ color: C.orange, fontWeight: "700", fontSize: 13 }}>
              {error}
            </Text>
          </View>
        )}

        {step === "phone" ? (
          <>
            <View
              style={{
                backgroundColor: C.white,
                borderRadius: 16,
                flexDirection: "row",
                alignItems: "center",
                borderWidth: 2.5,
                borderColor: C.blue,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  paddingHorizontal: 14,
                  borderRightWidth: 2,
                  borderRightColor: C.border,
                  paddingVertical: 18,
                }}
              >
                <Text style={{ fontWeight: "700", color: C.mid, fontSize: 15 }}>
                  🇷🇼 +250
                </Text>
              </View>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="7XX XXX XXX"
                keyboardType="phone-pad"
                maxLength={12}
                style={{
                  flex: 1,
                  fontSize: 18,
                  fontWeight: "800",
                  color: C.dark,
                  paddingHorizontal: 16,
                  paddingVertical: 18,
                }}
              />
            </View>

            <PrimaryBtn
              label={t("login.sendCode")}
              color={C.blue}
              onPress={sendCode}
              loading={loading}
            />

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                marginVertical: 4,
              }}
            >
              <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
              <Text style={{ color: C.muted, fontSize: 13 }}>
                {t("login.or")}
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
            </View>

            <TouchableOpacity
              onPress={signInWithGoogle}
              disabled={googleLoading}
              style={{
                backgroundColor: C.white,
                borderRadius: 16,
                paddingVertical: 16,
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 10,
                borderWidth: 2,
                borderColor: C.border,
              }}
            >
              {googleLoading ? (
                <ActivityIndicator color={C.mid} />
              ) : (
                <>
                  <Text style={{ fontSize: 20 }}>🌐</Text>
                  <Text
                    style={{ fontWeight: "700", color: C.dark, fontSize: 15 }}
                  >
                    {t("login.continueWithGoogle")}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={{ textAlign: "center", color: C.muted, fontSize: 12 }}>
              {t("login.googleAvailable")}
            </Text>

            <AdminPortalLink />
          </>
        ) : step === "email" ? (
          <>
            <View
              style={{
                backgroundColor: C.white,
                borderRadius: 18,
                padding: 18,
                gap: 14,
                borderWidth: 1,
                borderColor: C.border,
              }}
            >
              <View>
                <Text
                  style={{
                    fontWeight: "700",
                    fontSize: 13,
                    color: C.mid,
                    marginBottom: 6,
                  }}
                >
                  {t("login.emailLabel")}
                </Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t("login.emailPlaceholder")}
                  placeholderTextColor={C.muted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                  style={{
                    backgroundColor: C.bg,
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 14,
                    fontSize: 15,
                    color: C.dark,
                    borderWidth: 1.5,
                    borderColor: C.border,
                  }}
                />
              </View>

              <View>
                <Text
                  style={{
                    fontWeight: "700",
                    fontSize: 13,
                    color: C.mid,
                    marginBottom: 6,
                  }}
                >
                  {t("login.passwordLabel")}
                </Text>
                <View style={{ position: "relative" }}>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder={t("login.passwordPlaceholder")}
                    placeholderTextColor={C.muted}
                    secureTextEntry={!showPass}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{
                      backgroundColor: C.bg,
                      borderRadius: 12,
                      paddingHorizontal: 14,
                      paddingVertical: 14,
                      paddingRight: 48,
                      fontSize: 15,
                      color: C.dark,
                      borderWidth: 1.5,
                      borderColor: C.border,
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPass((value) => !value)}
                    style={{ position: "absolute", right: 14, top: 14 }}
                  >
                    <Ionicons
                      name={showPass ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color={C.muted}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <PrimaryBtn
              label={t("login.signInWithEmail")}
              color={C.blue}
              onPress={signInWithEmail}
              loading={loading}
            />

            <Text style={{ textAlign: "center", color: C.muted, fontSize: 12 }}>
              {t("login.emailLoginHint")}
            </Text>

            <AdminPortalLink />
          </>
        ) : (
          <>
            <View
              style={{ flexDirection: "row", gap: 8, justifyContent: "center" }}
            >
              {otp.map((val, i) => (
                <TextInput
                  key={i}
                  ref={otpRefs[i]}
                  value={val}
                  onChangeText={(v) => handleOtpChange(v.slice(-1), i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  style={{
                    width: 48,
                    height: 60,
                    textAlign: "center",
                    fontSize: 26,
                    fontWeight: "900",
                    borderWidth: 3,
                    borderColor: C.blue,
                    borderRadius: 14,
                    color: C.blue,
                    backgroundColor: C.white,
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
            <TouchableOpacity
              onPress={() => {
                setStep("phone");
                setOtp(["", "", "", "", "", ""]);
              }}
            >
              <Text
                style={{ textAlign: "center", color: C.muted, fontSize: 13 }}
              >
                ← Change number
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function AdminPortalLink() {
  return (
    <TouchableOpacity
      onPress={() => router.push("/(admin)/login")}
      style={{ marginTop: 8, alignItems: "center" }}
    >
      <Text style={{ color: C.muted, fontSize: 12 }}>
        Admin?{" "}
        <Text style={{ color: C.teal, fontWeight: "700" }}>Sign in here</Text>
      </Text>
    </TouchableOpacity>
  );
}

function PrimaryBtn({
  label,
  color,
  onPress,
  loading,
}: {
  label: string;
  color: string;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      style={{
        backgroundColor: color,
        borderRadius: 16,
        paddingVertical: 18,
        alignItems: "center",
      }}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text
          style={{
            color: color === C.blue ? C.yellow : C.white,
            fontWeight: "900",
            fontSize: 17,
          }}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}
