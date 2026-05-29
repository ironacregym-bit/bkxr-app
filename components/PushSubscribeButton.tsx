// File: components/PushSubscribeButton.tsx
"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export default function PushSubscribeButton() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setSupported(ok);

    if (!ok) return;

    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) return;
        const existing = await reg.pushManager.getSubscription();
        setSubscribed(!!existing);
      } catch {
        // ignore
      }
    })();
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
      setError("");

      const reg = await ensureRegistration();

      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setError("Notifications are blocked in your browser settings.");
        return;
      }

      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapid) {
        throw new Error("Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY");
      }

      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid),
        }));

      const res = await fetch("/api/notifications/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });

      if (!res.ok) {
        throw new Error("Failed to register subscription");
      }

      setSubscribed(true);
    } catch (e) {
      console.error("[push subscribe]", e);
      setError("Failed to enable push notifications.");
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;

  return (
    <section className="futuristic-card p-3 mb-3" aria-label="Push notifications">
      <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Device alerts
          </div>
          <h2 className="m-0" style={{ fontSize: "1.05rem" }}>
            Push notifications
          </h2>
          <div className="text-dim mt-2" style={{ lineHeight: 1.45 }}>
            Get reminders for workouts, updates and important gym alerts straight to your device.
          </div>
          {!!error && (
            <div className="mt-2" style={{ color: "#ff9b9b", fontSize: 13 }}>
              {error}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={subscribe}
          disabled={busy || subscribed}
          className="btn btn-outline-light"
          style={{
            borderRadius: 999,
            padding: "10px 16px",
            whiteSpace: "nowrap",
            opacity: busy ? 0.85 : 1,
          }}
        >
          {busy ? "Enabling..." : subscribed ? "Push enabled" : "Enable push"}
        </button>
      </div>
    </section>
  );
}
