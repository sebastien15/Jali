import Constants from "expo-constants";
import axios, { InternalAxiosRequestConfig } from "axios";
import { Alert } from "react-native";
import { isProd, isTest } from "@/lib/env";
import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n from "i18next";
import { getSessionGeneration, getSessionSignal } from "@/core/session/generation";

const DEV_URL = "http://192.168.1.64:8000/api";
const PROD_URL = "https://jali.stoka.rw/api";
// The LAN fallback is only ever used for an explicit dev build.
const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || (isProd ? PROD_URL : DEV_URL);
if (!process.env.EXPO_PUBLIC_API_URL && isProd) {
  console.warn(`[api] EXPO_PUBLIC_API_URL is not set — using ${PROD_URL}`);
}

const TOKEN_KEY = "jali_api_token";

// In-memory token — set synchronously on login so requests never wait for
// AsyncStorage. `undefined` = not known yet (cold start: read the disk copy);
// `null` = signed out (never fall back to a disk copy that may still be
// mid-removal — that would resurrect the old token).
let _token: string | null | undefined = undefined;

async function currentToken(): Promise<string | null> {
  if (_token !== undefined) return _token;
  return AsyncStorage.getItem(TOKEN_KEY);
}

type SessionStampedConfig = InternalAxiosRequestConfig & { _sessionGen?: number };

// S23.1: the server version-gates new requests only for clients that report a version
const APP_VERSION = Constants.expoConfig?.version;

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json", ...(APP_VERSION ? { "X-App-Version": APP_VERSION } : {}) },
  timeout: 10000,
});

// Stamp the session generation, share its abort signal, and attach the
// Laravel API token (memory first, AsyncStorage as cold-start fallback).
api.interceptors.request.use(async (config) => {
  (config as SessionStampedConfig)._sessionGen = getSessionGeneration();
  if (!config.signal) config.signal = getSessionSignal();
  const token = await currentToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function isStale(config: SessionStampedConfig | undefined): boolean {
  return config?._sessionGen !== undefined && config._sessionGen !== getSessionGeneration();
}

/** Registered by core/session/teardown.ts: ends the session on a 401. */
let unauthorizedHandler: (() => Promise<void> | void) | null = null;
export function setUnauthorizedHandler(handler: () => Promise<void> | void) {
  unauthorizedHandler = handler;
}

// Several queries usually fail with 401 at once when a session expires —
// only the first one may tear down and redirect.
let redirectingToLogin = false;
let lastForbiddenAlertAt = 0;

// Handle responses globally
api.interceptors.response.use(
  (response) => {
    // A response for a previous session must never reach the query cache.
    if (isStale(response.config as SessionStampedConfig)) {
      return Promise.reject(new axios.CanceledError("Response from a previous session ignored"));
    }
    return response;
  },
  async (error) => {
    if (isStale(error?.config as SessionStampedConfig | undefined)) {
      return Promise.reject(new axios.CanceledError("Response from a previous session ignored"));
    }
    const url: string = error.config?.url ?? "";
    const isAuthCall = url.includes("/auth/logout") || url.includes("/auth/login");
    if (error.response?.status === 401 && !isTest && !isAuthCall) {
      // Token expired or invalid — one teardown (token, caches, view state)
      // then the login screen.
      if (!redirectingToLogin) {
        redirectingToLogin = true;
        Promise.resolve(unauthorizedHandler ? unauthorizedHandler() : clearApiToken())
          .catch(() => {})
          .finally(() => {
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
  AsyncStorage.setItem(TOKEN_KEY, token).catch(() => {}); // persist in background, don't block
}

/**
 * Forget the API token in memory and on disk. Session teardown (view state,
 * caches, Firebase) lives in core/session/teardown.ts — use endSession().
 */
export async function clearApiToken(): Promise<void> {
  _token = null;
  await AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
}

export async function getApiToken(): Promise<string | null> {
  return currentToken();
}

export default api;
