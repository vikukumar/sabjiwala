import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";

// All Firebase credentials MUST come from environment variables.
declare const process: any;
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

// Initialize Firebase Analytics and Crashlytics
export const initFirebaseAnalyticsAndCrashlytics = async () => {
  if (typeof window === "undefined") return null;

  if ((window as any).Capacitor?.isNative) {
    try {
      // @ts-ignore
      const capAnalytics = await import("@capacitor-firebase/analytics");
      // @ts-ignore
      await capAnalytics.FirebaseAnalytics.setCollectionEnabled({ enabled: true });
      console.log("Capacitor Firebase Analytics initialized");

      // Auto sync user session info
      syncFirebaseUser().catch(() => {});

      // Initialize Crashlytics for JS errors
      // @ts-ignore
      const capCrashlytics = await import("@capacitor-firebase/crashlytics");
      // Native crashes are caught automatically. Here we add global listeners for JS errors.
      window.addEventListener('error', (event) => {
        capCrashlytics.FirebaseCrashlytics.recordException({
          message: event.error?.message || event.message || "Unknown error",
          stacktrace: event.error?.stack,
        }).catch((e: any) => console.warn("Crashlytics error:", e));
      });
      window.addEventListener('unhandledrejection', (event) => {
        const error = event.reason;
        capCrashlytics.FirebaseCrashlytics.recordException({
          message: error?.message || (typeof error === "string" ? error : "Unhandled Promise Rejection"),
          stacktrace: error?.stack,
        }).catch((e: any) => console.warn("Crashlytics error:", e));
      });
      console.log("Capacitor Firebase Crashlytics JS listeners registered");

      return capAnalytics.FirebaseAnalytics;
    } catch (err) {
      console.warn("Capacitor Firebase plugins error", err);
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

        // Auto sync user session info
        syncFirebaseUser().catch(() => {});

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

// Initialize Firebase Performance Monitoring for native apps
export const initFirebasePerformance = async () => {
  if (typeof window === "undefined") return null;
  if ((window as any).Capacitor?.isNative) {
    try {
      // @ts-ignore
      const capPerf = await import("@capacitor-firebase/performance");
      await capPerf.FirebasePerformance.setPerformanceCollectionEnabled({ enabled: true });
      console.log("Capacitor Firebase Performance initialized");
      return capPerf.FirebasePerformance;
    } catch (err) {
      console.warn("Capacitor Firebase Performance plugin error:", err);
      return null;
    }
  }
  return null;
};

// Helper to log analytics events
export const logFirebaseEvent = async (name: string, params?: any) => {
  if (typeof window === "undefined") return;
  if ((window as any).Capacitor?.isNative) {
    try {
      // @ts-ignore
      const capAnalytics = await import("@capacitor-firebase/analytics");
      await capAnalytics.FirebaseAnalytics.logEvent({ name, params });
    } catch (err) {
      console.warn("Capacitor logEvent error:", err);
    }
  } else {
    try {
      const { logEvent } = await import("firebase/analytics");
      const app = getApps().length > 0 ? getApp() : null;
      if (app) {
        const analytics = getAnalytics(app);
        logEvent(analytics, name, params);
      }
    } catch (err) {
      console.warn("Web logEvent error:", err);
    }
  }
};

// Helper to log ecommerce transactions / purchases
export const logFirebasePurchase = async (
  transactionId: string,
  value: number,
  currency: string = "INR",
  items?: any[]
) => {
  await logFirebaseEvent("purchase", {
    transaction_id: transactionId,
    value: value,
    currency: currency,
    items: items || [],
  });
};

// Helper to log app version and latest version to Firebase Analytics
export const logFirebaseVersionInfo = async (currentVersion: string, latestVersion: string) => {
  if (typeof window === "undefined") return;
  if ((window as any).Capacitor?.isNative) {
    try {
      // @ts-ignore
      const capAnalytics = await import("@capacitor-firebase/analytics");
      // @ts-ignore
      await capAnalytics.FirebaseAnalytics.setUserProperty({ key: "app_version", value: currentVersion });
      // @ts-ignore
      await capAnalytics.FirebaseAnalytics.setUserProperty({ key: "latest_version", value: latestVersion });
    } catch (err) {
      console.warn("Capacitor setUserProperty error:", err);
    }
  } else {
    try {
      const { setUserProperties } = await import("firebase/analytics");
      const app = getApps().length > 0 ? getApp() : null;
      if (app) {
        const analytics = getAnalytics(app);
        setUserProperties(analytics, { app_version: currentVersion, latest_version: latestVersion });
      }
    } catch (err) {
      console.warn("Web setUserProperties error:", err);
    }
  }

  // Also log as an event
  await logFirebaseEvent("app_version_info", {
    current_version: currentVersion,
    latest_version: latestVersion,
  });
};

// Helper to decode JWT token client-side
function decodeToken(token: string): any {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split("")
        .map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

// Sync current logged in user session information with Firebase Analytics
export const syncFirebaseUser = async () => {
  if (typeof window === "undefined") return;
  const token = localStorage.getItem("sw_access_token");
  if (!token) return;

  const decoded = decodeToken(token);
  if (!decoded || !decoded.sub) return;

  const userId = decoded.sub;
  const userType = decoded.user_type || "unknown";
  const nameOrPhone = decoded.username || decoded.phone || "user";

  if ((window as any).Capacitor?.isNative) {
    try {
      // @ts-ignore
      const capAnalytics = await import("@capacitor-firebase/analytics");
      await capAnalytics.FirebaseAnalytics.setUserId({ userId });
      await capAnalytics.FirebaseAnalytics.setUserProperty({ key: "user_type", value: userType });
      await capAnalytics.FirebaseAnalytics.setUserProperty({ key: "username", value: nameOrPhone });
      console.log("Firebase Analytics sync: User ID & properties set natively");
    } catch (err) {
      console.warn("Capacitor syncFirebaseUser error:", err);
    }
  } else {
    try {
      const { setUserId, setUserProperties } = await import("firebase/analytics");
      const app = getApps().length > 0 ? getApp() : null;
      if (app) {
        const analytics = getAnalytics(app);
        setUserId(analytics, userId);
        setUserProperties(analytics, { user_type: userType, username: nameOrPhone });
        console.log("Firebase Analytics sync: User ID & properties set on web");
      }
    } catch (err) {
      console.warn("Web syncFirebaseUser error:", err);
    }
  }
};

// Clear logged in user session details from Firebase Analytics
export const clearFirebaseUser = async () => {
  if (typeof window === "undefined") return;
  if ((window as any).Capacitor?.isNative) {
    try {
      // @ts-ignore
      const capAnalytics = await import("@capacitor-firebase/analytics");
      await capAnalytics.FirebaseAnalytics.setUserId({ userId: "" });
      await capAnalytics.FirebaseAnalytics.setUserProperty({ key: "user_type", value: "" });
      await capAnalytics.FirebaseAnalytics.setUserProperty({ key: "username", value: "" });
    } catch (err) {
      console.warn("Capacitor clearFirebaseUser error:", err);
    }
  } else {
    try {
      const { setUserId, setUserProperties } = await import("firebase/analytics");
      const app = getApps().length > 0 ? getApp() : null;
      if (app) {
        const analytics = getAnalytics(app);
        setUserId(analytics, "");
        setUserProperties(analytics, { user_type: "", username: "" });
      }
    } catch (err) {
      console.warn("Web clearFirebaseUser error:", err);
    }
  }
};
