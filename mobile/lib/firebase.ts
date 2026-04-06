import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth, getAuth, inMemoryPersistence, Auth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey:            "AIzaSyC17heA77gvw5kFiB3Pj0Qt8CIeVU24eG4",
  authDomain:        "jali-8cad5.firebaseapp.com",
  projectId:         "jali-8cad5",
  storageBucket:     "jali-8cad5.firebasestorage.app",
  messagingSenderId: "563763864352",
  appId:             "1:563763864352:web:4287b43247318adb502d45",
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
