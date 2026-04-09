import axios from "axios";
import { auth } from "@/lib/firebase";
import { Alert } from "react-native";
import { router } from "expo-router";
import { isProd, isTest } from "@/lib/env";

const DEV_URL  = "http://192.168.1.65:8000/api";
const PROD_URL = "https://api.jali.rw/api";
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? (isProd ? PROD_URL : DEV_URL);

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
});

// Automatically attach the Firebase ID token to every request
api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isTest) {
      // Token expired or invalid — redirect to login (skip in test mode)
      router.replace("/(auth)/login");
    } else if (error.response?.status === 403) {
      Alert.alert("Access Denied", "You don't have permission for this action.");
    }
    return Promise.reject(error);
  },
);

export default api;
