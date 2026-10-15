/// <reference types="vite/client" />
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
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

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Export Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);

// Initialize Analytics conditionally for browser/iframe runtime compatibility
export let analyticsPromise: Promise<ReturnType<typeof getAnalytics> | null> = (async () => {
  if (typeof window !== "undefined") {
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
