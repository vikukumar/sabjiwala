const CACHE_NAME = "sabjiwala-delivery-cache-v1";
const OFFLINE_URL = "/offline.html";

const ASSETS_TO_CACHE = [
  "/",
  "/favicon.ico",
  "/logo_horizontal.png",
  "/logo_vertical.png",
  "/icon-192x192.png",
  "/icon-512x512.png",
  OFFLINE_URL
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.headers.get("accept").includes("text/html")) {
            return caches.match(OFFLINE_URL);
          }
        });
      })
  );
});

// Push notification event listener
self.addEventListener("push", (event) => {
  let data = { title: "New Assignment", body: "You have received a new delivery assignment!" };
  if (event.data) {
    try {
      data = event.data.json().notification;
    } catch (e) {
      data = { title: "Delivery Agent Alert", body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: "/icon-192x192.png",
    badge: "/icon-192x192.png",
    vibrate: [200, 100, 200, 100, 200],
    data: {
      url: data.action_url || "/assignments"
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event listener
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientList) => {
      const targetUrl = event.notification.data.url;
      for (const client of clientList) {
        if (client.url === targetUrl && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
