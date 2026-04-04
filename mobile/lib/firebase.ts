import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth, getAuth, inMemoryPersistence, Auth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Replace these values with your Firebase project config
// from https://console.firebase.google.com → Project Settings → Your apps → Web app
const firebaseConfig = {
  apiKey:            "REPLACE_WITH_YOUR_API_KEY",
  authDomain:        "REPLACE_WITH_YOUR_AUTH_DOMAIN",
  projectId:         "REPLACE_WITH_YOUR_PROJECT_ID",
  storageBucket:     "REPLACE_WITH_YOUR_STORAGE_BUCKET",
  messagingSenderId: "REPLACE_WITH_YOUR_MESSAGING_SENDER_ID",
  appId:             "REPLACE_WITH_YOUR_APP_ID",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// NOTE: Firebase v12 removed getReactNativePersistence.
// For session persistence across app restarts, downgrade to firebase@10 and use:
//   import { getReactNativePersistence } from 'firebase/auth/react-native';
//   initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
// For now, inMemoryPersistence is used (user stays logged in while app is open).
let auth: Auth;
try {
  auth = initializeAuth(app, { persistence: inMemoryPersistence });
} catch {
  auth = getAuth(app);
}

export { auth };
export const storage = getStorage(app);
export default app;
