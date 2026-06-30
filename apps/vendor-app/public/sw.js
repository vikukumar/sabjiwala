const CACHE_NAME = "sbjiwala-vendor-cache-v1";
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
  // Only intercept GET requests
  if (event.request.method !== "GET") return;

  // Skip chrome-extension or external schemes
  if (!event.request.url.startsWith(self.location.origin)) return;

  const url = new URL(event.request.url);
  const acceptHeader = event.request.headers.get("accept") || "";
  const isNavigation = event.request.mode === "navigate" || acceptHeader.includes("text/html");

  if (isNavigation && !url.pathname.includes(".") && url.pathname !== "/") {
    // Rewrite path to append .html
    const newUrl = `${url.origin}${url.pathname}.html${url.search}${url.hash}`;
    const newRequest = new Request(newUrl, {
      method: event.request.method,
      headers: event.request.headers,
      mode: event.request.mode,
      credentials: event.request.credentials,
      redirect: event.request.redirect
    });

    event.respondWith(
      fetch(newRequest)
        .then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              // Cache under the original request URL
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return caches.match(`${url.pathname}.html`).then((htmlResponse) => {
              if (htmlResponse) return htmlResponse;
              return caches.match(OFFLINE_URL).then((offlineResp) => {
                return offlineResp || new Response("Offline Mode", { status: 503, headers: { "Content-Type": "text/plain" } });
              });
            });
          });
        })
    );
    return;
  }

  // Fallback for standard assets / pages
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
          if (acceptHeader.includes("text/html")) {
            return caches.match(OFFLINE_URL).then((offlineResp) => {
              return offlineResp || new Response("Offline Mode", { status: 503, headers: { "Content-Type": "text/plain" } });
            });
          }
          return new Response("Service Unavailable", { status: 503, headers: { "Content-Type": "text/plain" } });
        });
      })
  );
});

self.addEventListener("push", (event) => {
  let data = { title: "Vendor Dashboard", body: "New order received!" };
  if (event.data) {
    try {
      data = event.data.json().notification;
    } catch (e) {
      data = { title: "Vendor Dashboard", body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: "/icon-192x192.png",
    badge: "/icon-192x192.png",
    vibrate: [150, 75, 150],
    data: {
      url: data.action_url || "/"
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

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
