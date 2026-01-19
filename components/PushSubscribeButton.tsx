
// components/PushSubscribeButton.tsx
"use client";
import { useEffect, useState } from "react";

export default function PushSubscribeButton() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ok = typeof window !== "undefined"
      && "serviceWorker" in navigator
      && "PushManager" in window
      && "Notification" in window;
    setSupported(ok);
  }, []);

  async function ensureRegistration(): Promise<ServiceWorkerRegistration> {
    let reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      reg = await navigator.serviceWorker.register("/sw.js");
    }
    return reg;
  }

  async function subscribe() {
    try {
      setBusy(true);
      const reg = await ensureRegistration();

      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        alert("Notifications blocked in browser settings.");
        return;
      }

      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      });

      const res = await fetch("/api/notifications/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) throw new Error("Failed to register subscription");
      setSubscribed(true);
    } catch (e) {
      console.error("[push subscribe]", e);
      alert("Failed to subscribe to push.");
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;

  return (
    <button
      className="bxkr-pill"
      onClick={subscribe}
      disabled={busy || subscribed}
      title={subscribed ? "Push enabled" : "Enable push notifications"}
    >
      {busy ? "Enabling…" : subscribed ? "Push enabled" : "Enable push notifications"}
    </button>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}
