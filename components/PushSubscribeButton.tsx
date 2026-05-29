// components/PushSubscribeButton.tsx
"use client";

import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function usePushNotifications() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setSupported(ok);

    if (!ok) {
      setPermission("unsupported");
      setSubscribed(false);
      return;
    }

    setPermission(Notification.permission);

    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        setSubscribed(false);
        return;
      }

      const existing = await reg.pushManager.getSubscription();
      setSubscribed(!!existing);
    } catch {
      setSubscribed(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const subscribe = useCallback(async () => {
    try {
      setBusy(true);
      setError("");

      const ok =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;

      if (!ok) {
        setSupported(false);
        setPermission("unsupported");
        setError("Push notifications are not supported on this device.");
        return false;
      }

      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        reg = await navigator.serviceWorker.register("/sw.js");
      }

      let perm = Notification.permission;
      if (perm !== "granted") {
        perm = await Notification.requestPermission();
      }

      setPermission(perm);

      if (perm !== "granted") {
        setError("Notifications are blocked in your browser settings.");
        setSubscribed(false);
        return false;
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
      return true;
    } catch (e) {
      console.error("[push subscribe]", e);
      setError("Failed to enable push notifications.");
      setSubscribed(false);
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    supported,
    subscribed,
    busy,
    permission,
    error,
    subscribe,
    refresh,
  };
}

type PushSubscribeButtonProps = {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

export default function PushSubscribeButton({
  className,
  style,
  children,
}: PushSubscribeButtonProps) {
  const { supported, subscribed, busy, subscribe } = usePushNotifications();

  if (!supported || subscribed) return null;

  return (
    <button
      type="button"
      onClick={() => {
        subscribe().catch(() => {});
      }}
      disabled={busy}
      className={className || "btn btn-outline-light"}
      style={style}
    >
      {busy ? "Enabling..." : children || "Enable push notifications"}
    </button>
  );
}
