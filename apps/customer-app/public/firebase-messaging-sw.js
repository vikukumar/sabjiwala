// Firebase Cloud Messaging Service Worker for Web Push
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// To allow Firebase to process push notifications in the background, we must provide the same config.
// Next.js static files do not have access to process.env, so we retrieve the config from the query string
// or initialize it dynamically if passed via indexedDB/URL. However, since the config might be secret or dynamic,
// the easiest way is to let the user replace these values manually here, OR use an API endpoint.
// We'll fallback to dummy values and expect the app to register the service worker with a query string if needed.
// For now, this is a placeholder. You must build your project with Next.js PWA or inject ENV here.

// Please replace these with your actual Firebase config or use a build step to inject them.
const firebaseConfig = {
  apiKey: "REPLACE_WITH_YOUR_API_KEY",
  authDomain: "REPLACE_WITH_YOUR_AUTH_DOMAIN",
  projectId: "REPLACE_WITH_YOUR_PROJECT_ID",
  storageBucket: "REPLACE_WITH_YOUR_STORAGE_BUCKET",
  messagingSenderId: "REPLACE_WITH_YOUR_MESSAGING_SENDER_ID",
  appId: "REPLACE_WITH_YOUR_APP_ID"
};

// Initialize Firebase App only if config is somewhat valid
if (firebaseConfig.apiKey !== "REPLACE_WITH_YOUR_API_KEY") {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage(function(payload) {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
      body: payload.notification.body,
      icon: '/icon-192x192.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
}
