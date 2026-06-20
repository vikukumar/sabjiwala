import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";

// All Firebase credentials MUST come from environment variables.
// Never hardcode API keys here — they are public and will be exposed in the browser bundle.
// Copy .env.example to .env.local and fill in your Firebase project values.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Guard: skip initialization if required config is missing
const isFirebaseConfigured = (): boolean => {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
  );
};

// Initialize Firebase App
export const initFirebase = () => {
  if (typeof window === "undefined") return null;
  if (!isFirebaseConfigured()) {
    console.warn("Firebase: Missing required env vars. Skipping initialization.");
    return null;
  }
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  return app;
};

// Initialize Firebase Analytics
export const initFirebaseAnalytics = async () => {
  if (typeof window === "undefined") return null;
  try {
    const supported = await isSupported();
    if (supported) {
      const app = initFirebase();
      if (app) {
        return getAnalytics(app);
      }
    } else {
      console.warn("Firebase Analytics is not supported in this environment");
    }
  } catch (err) {
    console.warn("Firebase Analytics initialization failed:", err);
  }
  return null;
};
