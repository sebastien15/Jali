import { isDev } from "@/lib/env";

interface GoogleSigninInterface {
  configure: (options: { webClientId: string }) => void;
  hasPlayServices: () => Promise<boolean>;
  signIn: () => Promise<{ data: { idToken: string | null } | null }>;
  signOut: () => Promise<void>;
}

// Dev stub — no-op, works in Expo Go without native binary
const stub: GoogleSigninInterface = {
  configure: () => {},
  hasPlayServices: async () => true,
  signIn: async () => ({ data: null }),
  signOut: async () => {},
};

let _GoogleSignin: GoogleSigninInterface = stub;

if (!isDev) {
  try {
    _GoogleSignin = require("@react-native-google-signin/google-signin").GoogleSignin;
  } catch {
    _GoogleSignin = stub;
  }
}

export const GoogleSignin = _GoogleSignin;
