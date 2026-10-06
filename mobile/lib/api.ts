import axios from "axios";
import { Alert } from "react-native";
import { router } from "expo-router";
import { isProd, isTest } from "@/lib/env";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearQueryCache } from "@/lib/queryClient";
import i18n from "i18next";

const DEV_URL = "http://192.168.1.64:8000/api";
const PROD_URL = "https://jali.stoka.rw/api";
// The LAN fallback is only ever used for an explicit dev build.
const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || (isProd ? PROD_URL : DEV_URL);
if (!process.env.EXPO_PUBLIC_API_URL && isProd) {
  console.warn(`[api] EXPO_PUBLIC_API_URL is not set — using ${PROD_URL}`);
}

const TOKEN_KEY = "jali_api_token";

// In-memory cache — set synchronously on login so requests never wait for AsyncStorage
let _token: string | null = null;

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
});

// Attach Laravel API token to every request — memory first, AsyncStorage as cold-start fallback
api.interceptors.request.use(async (config) => {
  const token = _token ?? await AsyncStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Several queries usually fail with 401 at once when a session expires —
// only the first one may clear state and redirect.
let redirectingToLogin = false;
let lastForbiddenAlertAt = 0;

// Handle response errors globally
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const url: string = error.config?.url ?? "";
    const isAuthCall = url.includes("/auth/logout") || url.includes("/auth/login");
    if (error.response?.status === 401 && !isTest && !isAuthCall) {
      // Token expired or invalid — clear it (memory + disk) and the cached
      // data of that account, then go to login once.
      if (!redirectingToLogin) {
        redirectingToLogin = true;
        clearApiToken();
        clearQueryCache().finally(() => {
          router.replace("/(auth)/login");
          setTimeout(() => { redirectingToLogin = false; }, 1500);
        });
      }
    } else if (error.response?.status === 403) {
      // Parallel requests often 403 together — show one alert per burst.
      const now = Date.now();
      if (now - lastForbiddenAlertAt > 3000) {
        lastForbiddenAlertAt = now;
        Alert.alert(
          i18n.t("common.accessDenied"),
          error.response?.data?.message ?? i18n.t("common.accessDeniedMsg"),
        );
      }
    }
    return Promise.reject(error);
  },
);

export function setApiToken(token: string) {
  _token = token;
  AsyncStorage.setItem(TOKEN_KEY, token); // persist in background, don't block
}

export function clearApiToken() {
  _token = null;
  AsyncStorage.removeItem(TOKEN_KEY);
  // Per-user state that must not leak to the next account on this phone
  AsyncStorage.removeItem("jali_driver_mode"); // DRIVER_MODE_KEY in core/session/DriverModeContext.tsx
}

export async function getApiToken(): Promise<string | null> {
  return _token ?? AsyncStorage.getItem(TOKEN_KEY);
}

export default api;
