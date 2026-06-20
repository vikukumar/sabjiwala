import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyB-d0vl0SSQ1p57uG9cGBRnxeCzqwwa8tY",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "sbjiwala-app.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "sbjiwala-app",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "sbjiwala-app.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "443467134830",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:443467134830:web:d26ab1a5b6f3c17822003c"
};

// Initialize Firebase App
export const initFirebase = () => {
  if (typeof window === "undefined") return null;
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
        console.log("Firebase Analytics initialized successfully");
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
