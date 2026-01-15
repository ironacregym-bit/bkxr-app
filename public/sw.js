
/* public/sw.js */

// --- Lifecycle ---
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  self.clients.claim();
});

// Optional: allow a page to force update immediately
self.addEventListener("message", (event) => {
  if (event && event.data === "SKIP_WAITING") self.skipWaiting();
});

// --- Web Push handlers ---
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Fallback if payload isn't JSON
    data = { title: "BXKR", body: "You have a new message", url: "/" };
  }

  const title = data.title || "BXKR";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    // badge: "/icons/badge-72x72.png", // enable only if the file exists
    data: { url: data.url || "/", ...(data.data || {}) }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url =
    (event.notification && event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) return client.focus();
        }
        return self.clients.openWindow(url);
      })
  );
});
