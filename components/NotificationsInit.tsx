
// components/NotificationsInit.tsx
"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export default function NotificationsInit() {
  const { status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

      // Register the SW
      const reg = await navigator.serviceWorker.register("/notification-sw.js", { scope: "/" });

      // Request permission
      let perm = Notification.permission;
      if (perm === "default") perm = await Notification.requestPermission();
      if (perm !== "granted") return;

      // Subscribe
      const vapidPub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPub),
      });

      // Serialise subscription (toJSON covers endpoint + keys)
      const subObj = JSON.parse(JSON.stringify(sub));

           // Send subscription to server
      await fetch("/api/notifications/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subObj }),
      });
    })().catch(() => {});
  }, [status]);

  return null; // headless initialiser
}
