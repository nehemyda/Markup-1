// Server-side Firebase access (Admin SDK). It verifies who is calling and reads/writes data that browsers are not
// allowed to touch (e.g. WordPress keys, the audit log). Admin access is not limited by firestore.rules.
import 'dotenv/config';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export const useEmulator = process.env.VITE_USE_EMULATOR === 'true';
if (useEmulator) {
  process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
}

// Must match the browser app: "demo-markup" for the local emulator, otherwise the real Firebase project.
// With real Firebase, credentials come from the environment (GOOGLE_APPLICATION_CREDENTIALS / hosting defaults).
const projectId = useEmulator ? 'demo-markup' : process.env.VITE_FIREBASE_PROJECT_ID || 'webreview-pro';

const adminApp = getApps()[0] || initializeApp({ projectId });
export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
