import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { C } from "@/constants/theme";
import api, { clearApiToken } from "@/lib/api";
import { startSession } from "@/lib/session";
import { isAdminRole } from "@/constants/roles";
import { useAdminNav } from "@/components/admin/AdminNavContext";
import { useTranslation } from "react-i18next";

export default function AdminLoginScreen() {
  const { t } = useTranslation();
  const { refetch } = useAdminNav();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-redirect if already logged in via Firebase session
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken(true);
          const res = await api.post("/auth/login/google", { firebase_token: token });
          const role: string = res.data.user?.roles ?? "";
          // Only an admin session may be resumed here — never store a
          // plain user's token from the admin portal.
          if (res.data.token && isAdminRole(role)) {
            await startSession(res.data.token);
            await refetch();
            router.replace("/(admin)/dashboard");
          }
        } catch {}
      }
    });
    return () => unsub();
  }, []);

  /** Shared by every login path: only admins/superadmins get a session here. */
  async function finishAdminLogin(data: any) {
    const role: string = data?.user?.roles ?? "";
    if (data?.token && isAdminRole(role)) {
      await startSession(data.token);
      await refetch();
      router.replace("/(admin)/dashboard");
    } else {
      setError(data?.token ? t("authErrors.noAdminAccess") : t("authErrors.unknown"));
      clearApiToken();
      try { await signOut(auth); } catch {}
    }
  }

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      // Try Laravel direct login first
      const res = await api.post("/auth/login", {
        email: email.trim().toLowerCase(),
        password,
      });

      if (res.data.token) return res.data;

      // Fallback: Firebase → Laravel Google login
      const userCred = await signInWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password,
      );
      const firebaseToken = await userCred.user.getIdToken(true);
      const googleRes = await api.post("/auth/login/google", {
        firebase_token: firebaseToken,
      });
      return googleRes.data;
    },
    onSuccess: async (data) => {
      await finishAdminLogin(data);
    },
    onError: (e: any) => {
      if (e?.response?.status === 401 || e?.response?.status === 422) {
        setError(e?.response?.data?.message ?? t("authErrors.invalidCredentials"));
      } else if (e?.code === "auth/network-request-failed") {
        setError(t("authErrors.noInternet"));
      } else {
        setError(e?.message ?? t("authErrors.unknown"));
      }
    },
  });

  const googleMutation = useMutation({
    mutationFn: async () => {
      const userCred = await signInWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password || "placeholder",
      );
      const firebaseToken = await userCred.user.getIdToken(true);
      const res = await api.post("/auth/login/google", { firebase_token: firebaseToken });
      return res.data;
    },
    onSuccess: async (data) => {
      await finishAdminLogin(data);
    },
    onError: (e: any) => {
      setError(e?.response?.data?.message ?? e?.message ?? t("login.googleSignInFailed"));
    },
  });

  function handleLogin() {
    if (!email.trim() || !password) {
      setError(t("login.emailPasswordRequired"));
      return;
    }
    setError(null);
    loginMutation.mutate({ email, password });
  }

  const isLoading = loginMutation.isPending || googleMutation.isPending;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />

      {/* Header */}
      <View
        style={{
          backgroundColor: C.teal,
          paddingTop: 72,
          paddingBottom: 36,
          paddingHorizontal: 28,
        }}
      >
        <Text style={{ color: C.yellow, fontWeight: "900", fontSize: 36, letterSpacing: -1 }}>
          Jali
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 15, marginTop: 4, fontWeight: "600" }}>
          Admin Portal
        </Text>
      </View>

      {/* Body */}
      <View style={{ flex: 1, padding: 28, gap: 16 }}>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="admin@jali.rw"
          keyboardType="email-address"
          autoCapitalize="none"
          style={{
            backgroundColor: C.white,
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: 18,
            fontSize: 16,
            borderWidth: 1.5,
            borderColor: C.border,
          }}
        />

        <View
          style={{
            backgroundColor: C.white,
            borderRadius: 16,
            flexDirection: "row",
            alignItems: "center",
            borderWidth: 1.5,
            borderColor: C.border,
            overflow: "hidden",
          }}
        >
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry={!showPass}
            style={{ flex: 1, fontSize: 16, paddingHorizontal: 16, paddingVertical: 18 }}
          />
          <TouchableOpacity onPress={() => setShowPass((s) => !s)} style={{ paddingHorizontal: 16 }}>
            <Ionicons name={showPass ? "eye-off" : "eye"} size={22} color={C.mid} />
          </TouchableOpacity>
        </View>

        {error && (
          <Text style={{ color: "#DC2626", fontWeight: "700", fontSize: 13, textAlign: "center" }}>
            {error}
          </Text>
        )}

        <TouchableOpacity
          onPress={handleLogin}
          disabled={isLoading}
          style={{
            backgroundColor: C.teal,
            borderRadius: 16,
            paddingVertical: 18,
            alignItems: "center",
            marginTop: 8,
          }}
        >
          {loginMutation.isPending ? (
            <ActivityIndicator color={C.white} />
          ) : (
            <Text style={{ color: C.white, fontWeight: "900", fontSize: 17 }}>Sign In</Text>
          )}
        </TouchableOpacity>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 4 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
          <Text style={{ color: C.muted, fontSize: 13 }}>or</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
        </View>

        <TouchableOpacity
          onPress={() => { setError(null); googleMutation.mutate(); }}
          disabled={isLoading}
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
          {googleMutation.isPending ? (
            <ActivityIndicator color={C.mid} />
          ) : (
            <>
              <Text style={{ fontSize: 20 }}>🌐</Text>
              <Text style={{ fontWeight: "700", color: C.dark, fontSize: 15 }}>
                Continue with Google
              </Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={{ textAlign: "center", color: C.muted, fontSize: 12 }}>
          Google sign-in is available for international travelers
        </Text>
      </View>
    </SafeAreaView>
  );
}
