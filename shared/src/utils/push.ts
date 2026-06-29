import { api } from "../api-client";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function registerWebPush(apiClient: typeof api) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("Web Push is not supported in this browser");
    return;
  }
  try {
    const settingsRes = await apiClient.get("/installation/public-settings");
    const vapidKey = settingsRes.data?.vapid_public_key;
    if (!vapidKey) {
      console.warn("VAPID public key not found in system settings");
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    const subJSON = subscription.toJSON();
    if (subJSON.endpoint && subJSON.keys?.p256dh && subJSON.keys?.auth) {
      await apiClient.post("/notifications/subscriptions", {
        endpoint: subJSON.endpoint,
        p256dh_key: subJSON.keys.p256dh,
        auth_key: subJSON.keys.auth,
        device_type: "web",
      });
      console.log("Web push notification registered successfully");
    }
  } catch (err) {
    console.error("Error registering web push notifications:", err);
  }
}

async function registerCapacitorPush(apiClient: typeof api) {
  if (typeof window === "undefined" || !(window as any).Capacitor?.Plugins?.PushNotifications) {
    console.warn("Capacitor PushNotifications plugin not available");
    return;
  }
  try {
    const PushNotifications = (window as any).Capacitor.Plugins.PushNotifications;
    
    // Create Default Notification Channel for Android 8.0+
    if ((window as any).Capacitor.getPlatform() === 'android') {
      try {
        await PushNotifications.createChannel({
          id: 'fcm_default_channel',
          name: 'Default Channel',
          description: 'Default notification channel',
          importance: 5, // IMPORTANCE_HIGH
          visibility: 1, // VISIBILITY_PUBLIC
          sound: 'default',
          vibration: true,
        });
        console.log("FCM Default Notification Channel created");
      } catch (channelErr) {
        console.warn("Failed to create FCM default channel:", channelErr);
      }
    }
    
    // Add listeners first (as recommended by Capacitor docs to ensure no event is missed)
    await PushNotifications.addListener("registration", async (token: any) => {
      console.log("Capacitor Push token:", token.value);
      try {
        await apiClient.post("/notifications/subscriptions", {
          endpoint: "fcm",
          p256dh_key: token.value,
          auth_key: token.value,
          device_type: "mobile",
        });
        console.log("Capacitor push notification registered successfully");
      } catch (err: any) {
        console.error("Failed to save Capacitor push token to server:", err);
      }
    });

    await PushNotifications.addListener("registrationError", (err: any) => {
      console.error("Capacitor Push registration error:", err);
    });

    await PushNotifications.addListener("pushNotificationReceived", (notification: any) => {
      console.log("Push received:", notification);
    });

    try {
      const { Device } = await import("@capacitor/device");
      const info = await Device.getInfo();
      if (info.manufacturer && info.manufacturer.toLowerCase() === "infinix") {
        console.warn("Bypassing PushNotifications.checkPermissions() on Infinix device to avoid NPE crash.");
        // Attempt to just register directly and skip check
        await PushNotifications.register();
        return;
      }
    } catch (err) {
      console.warn("Could not check device manufacturer:", err);
    }

    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === "prompt") {
      permStatus = await PushNotifications.requestPermissions();
    }
    if (permStatus.receive !== "granted") {
      console.warn("User denied push notifications permission");
      return;
    }

    await PushNotifications.register();
  } catch (err) {
    console.error("Error setting up Capacitor push notifications:", err);
  }
}

export async function initPushNotifications() {
  if (typeof window === "undefined") return;

  const isNative = !!(window as any).Capacitor;
  if (isNative) {
    await registerCapacitorPush(api);
  } else {
    await registerWebPush(api);
  }
}
