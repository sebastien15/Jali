import axios from "axios";
import { Alert } from "react-native";
import { router } from "expo-router";
import { isProd, isTest } from "@/lib/env";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DEV_URL = "http://localhost:8000/api";
const PROD_URL = "https://api.jali.rw/api";
const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? (isProd ? PROD_URL : DEV_URL);

const TOKEN_KEY = "jali_api_token";

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
});

// Attach Laravel API token to every request
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors globally
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const url = error.config?.url ?? "";
    if (error.response?.status === 401 && !isTest && !url.includes("/auth/logout")) {
      // Token expired or invalid — clear and redirect to login
      await AsyncStorage.removeItem(TOKEN_KEY);
      router.replace("/(auth)/login");
    } else if (error.response?.status === 403) {
      Alert.alert(
        "Access Denied",
        "You don't have permission for this action.",
      );
    }
    return Promise.reject(error);
  },
);

export async function setApiToken(token: string) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearApiToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function getApiToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export default api;
