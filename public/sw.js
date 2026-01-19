
/* public/sw.js */

/**
 * BXKR Service Worker for Web Push
 * - Lifecycle: install/activate + SKIP_WAITING message
 * - Push: expects JSON payload { title, body, url, icon, badge, data? }
 * - Click: focuses existing tab if possible, else opens new window to payload.url
 */

// --- Lifecycle ---
self.addEventListener("install", (event) => {
  // Immediately activate the updated SW
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Take control of open clients
  event.waitUntil(self.clients.claim());
});

// Optional: allow a page to force update immediately
self.addEventListener("message", (event) => {
  try {
    if (event && (event.data === "SKIP_WAITING" || event.data?.type === "SKIP_WAITING")) {
      self.skipWaiting();
    }
  } catch {}
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
    icon: data.icon || "/icons/icon-192.png",
    // Uncomment if you have a badge asset
    // badge: data.badge || "/icons/badge-72.png",
    data: {
      url: data.url || "/",
      ...(data.data || {}),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url =
    (event.notification && event.notification.data && event.notification.data.url) || "/";

  // Focus any existing BXKR tab, navigate if needed, else open a new one
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

      // Try to find a visible client (tab) we can focus
      for (const client of clientList) {
        // If you want to strictly match origins or paths, you can check client.url here
        if ("focus" in client) {
          try {
            await client.focus();
            // If the tab is on a different page than url, try to navigate it
            if ("navigate" in client && url && client.url !== url) {
              await client.navigate(url);
            }
            return;
          } catch {
            // If focusing fails, continue to next client
          }
        }
      }

      // No client to focus—open a new window
      if (self.clients.openWindow && url) {
        return self.clients.openWindow(url);
      }
    })()
  );
});

// Optional: handle subscription refresh (some browsers rotate push keys)
// You can implement a callback to your app if needed
self.addEventListener("pushsubscriptionchange", (event) => {
  // You can re-subscribe here if you want fully automatic renewal.
  // Many apps choose to re-subscribe from the page (client code) instead.
});
