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

  if ((window as any).Capacitor?.isNative) {
    try {
      const capAnalytics = await import("@capacitor-firebase/analytics");
      // @ts-ignore
      await capAnalytics.FirebaseAnalytics.setCollectionEnabled({ enabled: true });
      console.log("Capacitor Firebase Analytics initialized");
      return capAnalytics.FirebaseAnalytics;
    } catch (err) {
      console.warn("Capacitor Firebase Analytics error", err);
      return null;
    }
  }

  // Handle Web Analytics
  try {
    const supported = await isSupported();
    if (supported) {
      const app = initFirebase();
      if (app) {
        // Intercept and suppress the global uncaught promise rejection warning if Firebase Analytics configuration fetch fails.
        const rejectHandler = (event: PromiseRejectionEvent) => {
          if (event.reason && (
            (event.reason.message && event.reason.message.includes("config-fetch-failed")) ||
            (event.reason.code && event.reason.code.includes("config-fetch-failed"))
          )) {
            event.preventDefault(); // Prevents it from bubbling as uncaught exception to browser console
            console.warn("Firebase Analytics config fetch failed (Analytics not enabled in console or incorrect App ID). Gracefully suppressed.");
          }
        };
        window.addEventListener("unhandledrejection", rejectHandler);
        
        const analytics = getAnalytics(app);
        
        // Remove handler after 3 seconds, as the dynamic fetch is initiated immediately.
        setTimeout(() => {
          window.removeEventListener("unhandledrejection", rejectHandler);
        }, 3000);

        return analytics;
      }
    } else {
      console.warn("Firebase Analytics is not supported in this environment");
    }
  } catch (err) {
    console.warn("Firebase Analytics initialization failed:", err);
  }
  return null;
};
