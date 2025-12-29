
/* public/sw.js */

// --- Lifecycle ---
self.addEventListener("install", (event) => {
  // Immediately take control after install
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Claim all open clients/tabs so push clicks can focus them
  clients.claim();
});

// Optional: allow pages to trigger an immediate skipWaiting via postMessage
self.addEventListener("message", (event) => {
  if (event?.data === "SKIP_WAITING") self.skipWaiting();
});

// --- Web Push (VAPID) handlers ---
// We send JSON payloads like: { title, body, url, data? }
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    // If payload isn't JSON, fall back to a generic notification
    data = { title: "BXKR", body: "You have a new message", url: "/" };
  }

  const title = data.title || "BXKR";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192x192.png",   // Adjust to your icon path if needed
    badge: "/icons/badge-72x72.png",   // Optional
    // You can also add vibration for mobile:
    // vibrate: [150, 75, 150],
    data: { url: data.url || "/", ...(data.data || {}) },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// When the user clicks the notification, focus an open tab or open a new one
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus first matching client if any
      for (const client of clientList) {
               if ("focus" in client) return client.focus();
      }
      // Otherwise open a new tab
      return self.clients.openWindow(url);
    })
  );
}
