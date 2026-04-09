import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";

import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import rw from "@/locales/rw.json";
import sw from "@/locales/sw.json";

const LANGUAGE_DETECTION_KEY = "jali_language";

const resources = {
  en: { translation: en },
  fr: { translation: fr },
  rw: { translation: rw },
  sw: { translation: sw },
};

async function detectLanguage(): Promise<string> {
  // Check user preference first
  const saved = await AsyncStorage.getItem(LANGUAGE_DETECTION_KEY);
  if (saved && resources[saved]) return saved;

  // Fall back to device locale
  const locales = Localization.getLocales();
  const deviceLang = locales[0]?.languageCode?.toLowerCase();

  // Map device language to supported languages
  if (deviceLang === "fr") return "fr";
  if (deviceLang === "rw") return "rw";
  if (deviceLang === "sw") return "sw";
  return "en"; // Default to English
}

// Initialize i18n asynchronously
let initPromise: Promise<void> | null = null;

export async function initI18n(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const lng = await detectLanguage();

    await i18n.use(initReactI18next).init({
      resources,
      lng,
      fallbackLng: "en",
      interpolation: { escapeValue: false },
      compatibilityJSON: "v4",
    });
  })();

  return initPromise;
}

export async function setLanguage(lng: string): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_DETECTION_KEY, lng);
  await i18n.changeLanguage(lng);
}

export function getLanguage(): string {
  return i18n.language;
}

export default i18n;
