import {
  View, Text, ScrollView, TouchableOpacity, StatusBar, Alert, Switch, Linking, Platform,
  ActivityIndicator,
} from "react-native";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { auth } from "@/lib/firebase";
import api from "@/lib/api";
import { endSession, clearLocalSession } from "@/lib/session";
import { C } from "@/constants/theme";
import { useDriverMode } from "@/lib/DriverModeContext";
import { useMe, isDriverRole } from "@/lib/useMe";
import { setLanguage, getLanguage } from "@/lib/i18n";

const APP_VERSION = "1.0.0";
const SUPPORT_WHATSAPP = "https://wa.me/250788451691?text=Hi%20Jali%20Support%2C%20I%20need%20help%20with%20my%20booking.";
const PLAY_STORE_URL   = "market://details?id=com.jali.app";
const APP_STORE_URL    = "https://apps.apple.com/app/jali/id0000000000"; // update when live

type MenuItem = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  sub: string;
  onPress: () => void;
};

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { driverMode, setDriverMode, driverType, setDriverType } = useDriverMode();

  const { data: me } = useMe();
  const isDriver = isDriverRole(me);
  const driverActive = driverMode && isDriver;

  function handleDriverToggle(value: boolean) {
    if (!value) {
      setDriverMode(false);
      return;
    }
    // The driver role is granted by Jali (superadmin) — there is no
    // self-service signup, and every /driver/* endpoint 403s without it.
    if (!isDriver) {
      Alert.alert(
        t('profile.driverMode'),
        t('profile.becomeDriverInfo'),
        [
          { text: t('profile.cancel'), style: "cancel" },
          { text: t('profile.contactJali'), onPress: () => Linking.openURL(SUPPORT_WHATSAPP) },
        ],
      );
      return;
    }
    // Ask which role before enabling
    Alert.alert(
      t('profile.driverMode'),
      t('profile.driverModeQuestion'),
      [
        {
          text: t('profile.privateSeatTrips'),
          onPress: () => {
            setDriverType("private");
            setDriverMode(true);
            router.push("/(tabs)/drive");
          },
        },
        {
          text: t('profile.ownRentalCars'),
          onPress: () => {
            setDriverType("rental");
            setDriverMode(true);
            router.push("/(tabs)/drive");
          },
        },
        { text: t('profile.cancel'), style: "cancel" },
      ],
    );
  }

  function handleLogout() {
    doLogout();
  }

  async function doLogout() {
    await endSession();
    router.replace("/(auth)/login");
  }

  const [deleting, setDeleting] = useState(false);

  // Two-step destructive confirmation: deletion is permanent, so a single
  // stray tap must never be enough.
  function handleDeleteAccount() {
    if (deleting) return;
    if (Platform.OS === "web") {
      const ok =
        typeof window !== "undefined" &&
        window.confirm(`${t('profile.deleteAccountWarning')}\n\n${t('profile.deleteAccountDetails')}`);
      if (ok) doDeleteAccount();
      return;
    }
    Alert.alert(
      t('profile.deleteAccount'),
      t('profile.deleteAccountWarning'),
      [
        { text: t('profile.keepAccount'), style: "cancel" },
        {
          text: t('profile.deleteAccount'),
          style: "destructive",
          onPress: () =>
            Alert.alert(
              t('profile.areYouSure'),
              t('profile.deleteAccountDetails'),
              [
                { text: t('profile.keepAccount'), style: "cancel" },
                { text: t('profile.deleteEverything'), style: "destructive", onPress: doDeleteAccount },
              ],
            ),
        },
      ],
    );
  }

  async function doDeleteAccount() {
    setDeleting(true);
    try {
      await api.delete("/auth/me");
      await clearLocalSession();
      router.replace("/(auth)/login");
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 401) {
        Alert.alert(t('profile.pleaseSignInAgain'), t('profile.signInAgainDetails'));
      } else {
        Alert.alert(
          t('profile.error'),
          e?.response?.data?.message ?? t('profile.deleteAccountFailed'),
        );
      }
    } finally {
      setDeleting(false);
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
      t('profile.language'),
      t('profile.languageSub'),
      [
        ...LANGUAGES.map(lang => ({
          text: current === lang.code ? `✓ ${lang.label}` : lang.label,
          onPress: () => setLanguage(lang.code),
        })),
        { text: t('profile.cancel'), style: "cancel" as const },
      ]
    );
  }

  const MENU: MenuItem[] = [
    {
      icon: "notifications-outline",
      label: t('profile.notifications'),
      sub: t('profile.notificationsSub'),
      onPress: () => {},
    },
    {
      icon: "language-outline",
      label: t('profile.language'),
      sub: t('profile.languageSub'),
      onPress: pickLanguage,
    },
    {
      icon: "help-circle-outline",
      label: t('profile.helpSupport'),
      sub: t('profile.helpSub'),
      onPress: () => Linking.openURL(SUPPORT_WHATSAPP),
    },
    {
      icon: "star-outline",
      label: t('profile.rateJali'),
      sub: t('profile.rateSub'),
      onPress: () => {
        const url = Platform.OS === "ios" ? APP_STORE_URL : PLAY_STORE_URL;
        Linking.openURL(url);
      },
    },
    {
      icon: "document-text-outline",
      label: t('profile.faq'),
      sub: t('profile.faqSub'),
      onPress: () => router.push("/legal/faq"),
    },
    {
      icon: "shield-checkmark-outline",
      label: t('profile.privacyPolicy'),
      sub: t('profile.privacySub'),
      onPress: () => router.push("/legal/privacy"),
    },
    {
      icon: "reader-outline",
      label: t('profile.termsConditions'),
      sub: t('profile.termsSub'),
      onPress: () => router.push("/legal/terms"),
    },
    {
      icon: "information-circle-outline",
      label: t('profile.aboutJali'),
      sub: `${t('profile.version')} ${APP_VERSION}`,
      onPress: () =>
        Alert.alert("Jali", `${t('profile.version')} ${APP_VERSION}\n${t('profile.aboutDetails')}`),
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.blue }} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor={C.blue} />
      <View style={{ flex: 1, backgroundColor: C.bg }}>

      {/* Header */}
      <View style={{ backgroundColor: C.blue, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <View style={{
            backgroundColor: C.yellow, borderRadius: 50, width: 60, height: 60,
            alignItems: "center", justifyContent: "center",
          }}>
            <Ionicons name="person" size={28} color={C.dark} />
          </View>
          <View>
            <Text style={{ color: C.white, fontWeight: "900", fontSize: 22 }}>
              {auth.currentUser?.displayName ?? "Jali User"}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
              {auth.currentUser?.email ?? auth.currentUser?.phoneNumber ?? ""}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          {[{ v: "0", l: t('profile.trips') }, { v: "—", l: t('profile.rating') }, { v: "0", l: t('profile.pending') }].map((s, i) => (
            <View key={i} style={{
              flex: 1, backgroundColor: "rgba(255,255,255,0.15)",
              borderRadius: 12, paddingVertical: 10, alignItems: "center",
            }}>
              <Text style={{ color: C.yellow, fontWeight: "900", fontSize: 18 }}>{s.v}</Text>
              <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 12 }}>{s.l}</Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>

        {/* Driver Mode */}
        <View style={{
          backgroundColor: driverActive ? C.tealLt : C.white,
          borderRadius: 16, padding: 16, marginBottom: 16,
          borderWidth: 2, borderColor: driverActive ? C.teal : C.border,
          flexDirection: "row", alignItems: "center", gap: 14,
        }}>
          <View style={{
            backgroundColor: driverActive ? C.teal : C.bg,
            borderRadius: 12, width: 44, height: 44,
            alignItems: "center", justifyContent: "center",
          }}>
            <Ionicons name="car" size={22} color={driverActive ? C.white : C.mid} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "800", fontSize: 15, color: driverActive ? C.teal : C.dark }}>
              {t('profile.driverMode')}
            </Text>
            <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
              {driverActive
                ? driverType === "rental" ? t('profile.fleetOwner') : t('profile.privateDriver')
                : t('profile.switchToDrive')}
            </Text>
          </View>
          <Switch
            value={driverActive}
            onValueChange={handleDriverToggle}
            trackColor={{ false: C.border, true: C.teal }}
            thumbColor={C.white}
          />
        </View>

        {/* Menu */}
        {MENU.map((item, i) => (
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
            <View style={{
              backgroundColor: C.bg, borderRadius: 10, width: 38, height: 38,
              alignItems: "center", justifyContent: "center",
            }}>
              <Ionicons name={item.icon} size={20} color={C.mid} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.dark, fontWeight: "700", fontSize: 14 }}>{item.label}</Text>
              <Text style={{ color: C.muted, fontSize: 12 }}>{item.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.muted} />
          </TouchableOpacity>
        ))}

        {/* Log Out */}
        <TouchableOpacity
          onPress={handleLogout}
          style={{
            backgroundColor: "rgba(220,38,38,0.08)", borderRadius: 14,
            paddingVertical: 16, alignItems: "center", marginTop: 8,
            flexDirection: "row", justifyContent: "center", gap: 8,
          }}
        >
          <Ionicons name="log-out-outline" size={18} color="#DC2626" />
          <Text style={{ color: "#DC2626", fontWeight: "800", fontSize: 15 }}>{t('profile.logOut')}</Text>
        </TouchableOpacity>

        {/* Delete Account */}
        <TouchableOpacity
          onPress={handleDeleteAccount}
          disabled={deleting}
          style={{ paddingVertical: 16, alignItems: "center", marginTop: 4 }}
        >
          {deleting ? (
            <ActivityIndicator color={C.muted} />
          ) : (
            <Text style={{ color: C.muted, fontSize: 13, textDecorationLine: "underline" }}>
              {t('profile.deleteMyAccount')}
            </Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 16 }} />
      </ScrollView>
      </View>
    </SafeAreaView>
  );
}
