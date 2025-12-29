
// components/NotificationsInit.tsx
"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export default function NotificationsInit() {
  const { status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;

    (async () => {
      // Require SW + Push support
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

      // Wait for your single SW (/sw.js) to be ready
      const reg = await navigator.serviceWorker.ready;

      // Request permission if not already granted
      let perm = Notification.permission;
      if (perm === "default") perm = await Notification.requestPermission();
      if (perm !== "granted") return;

      // Avoid duplicate subscriptions if the browser already has one
      const existing = await reg.pushManager.getSubscription();

      const subscription = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });

      // Serialise and POST to server
      const subObj = JSON.parse(JSON.stringify(subscription));
      await fetch("/api/notifications/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subObj }),
      });
    })().catch(() => {});
  }, [status]);

  return null;
}
