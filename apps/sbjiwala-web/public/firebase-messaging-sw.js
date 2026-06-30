// Firebase Cloud Messaging Service Worker for Web Push
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

const urlParams = new URLSearchParams(self.location.search);
const firebaseConfig = {
  apiKey: urlParams.get("apiKey"),
  authDomain: urlParams.get("authDomain") || `${urlParams.get("projectId")}.firebaseapp.com`,
  projectId: urlParams.get("projectId"),
  storageBucket: urlParams.get("storageBucket") || `${urlParams.get("projectId")}.appspot.com`,
  messagingSenderId: urlParams.get("messagingSenderId"),
  appId: urlParams.get("appId")
};

// Initialize Firebase App only if config is valid
if (firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage(function(payload) {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification?.title || "Sbjiwala Update";
    const notificationOptions = {
      body: payload.notification?.body || "",
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      data: payload.data
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
}
