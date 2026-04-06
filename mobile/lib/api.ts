import axios from "axios";
import { auth } from "@/lib/firebase";

const DEV_URL  = "http://192.168.100.23:8000/api";
const PROD_URL = "https://api.jali.rw/api";

const api = axios.create({
  baseURL: __DEV__ ? DEV_URL : PROD_URL,
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

export default api;
