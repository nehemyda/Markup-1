/// <reference types="vite/client" />
import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";

// User's Firebase Configuration
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBHKA8osVw1wW5Qny5j0wCtHdy00vGnE00",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "webreview-pro.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "webreview-pro",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "webreview-pro.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "791994178772",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:791994178772:web:ee55b4d5b17a645f7caf41",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-3M3JK86QE7"
};

// Local Firebase Emulator: run `npm run emulators` and set VITE_USE_EMULATOR=true in .env
export const useEmulator = import.meta.env.VITE_USE_EMULATOR === "true";
if (useEmulator) {
  // "demo-" project IDs never reach the cloud; must match --project in the emulators script
  firebaseConfig.projectId = "demo-markup";
}

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Export Firebase services
// ignoreUndefinedProperties: optional fields (e.g. a pin without a screenshot) are left out instead of failing the write
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
export const auth = getAuth(app);

if (useEmulator) {
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
}

// Initialize Analytics conditionally for browser/iframe runtime compatibility
export let analyticsPromise: Promise<ReturnType<typeof getAnalytics> | null> = (async () => {
  if (typeof window !== "undefined" && !useEmulator) {
    try {
      const supported = await isSupported();
      if (supported) {
        return getAnalytics(app);
      }
    } catch (e) {
      console.warn("Firebase Analytics not supported in current environment:", e);
    }
  }
  return null;
})();

export default app;
