// components/PushSubscribeButton.tsx
"use client";

import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

const DISMISS_KEY = "ia_push_toast_dismissed";

export function usePushNotifications() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [firestoreHasCurrentDevice, setFirestoreHasCurrentDevice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [checked, setChecked] = useState(false);

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
      setFirestoreHasCurrentDevice(false);
      setChecked(true);
      return;
    }

    setPermission(Notification.permission);

    try {
      const storedDismissed =
        typeof window !== "undefined" && window.sessionStorage.getItem(DISMISS_KEY) === "1";
      setDismissed(storedDismissed);

      const reg = await navigator.serviceWorker.getRegistration();

      if (!reg) {
        setSubscribed(false);
        setFirestoreHasCurrentDevice(false);
        setChecked(true);
        return;
      }

      const existing = await reg.pushManager.getSubscription();
      const hasBrowserSub = !!existing;
      setSubscribed(hasBrowserSub);

      if (!existing) {
        setFirestoreHasCurrentDevice(false);
        setChecked(true);
        return;
      }

      const endpoint = String((existing.toJSON() as any)?.endpoint || "").trim();

      if (!endpoint) {
        setFirestoreHasCurrentDevice(false);
        setChecked(true);
        return;
      }

      const res = await fetch("/api/notifications/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setFirestoreHasCurrentDevice(false);
      } else {
        setFirestoreHasCurrentDevice(Boolean(json?.endpoint_present));
      }
    } catch {
      setSubscribed(false);
      setFirestoreHasCurrentDevice(false);
    } finally {
      setChecked(true);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const dismissPrompt = useCallback(() => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    }
  }, []);

  const resetDismissed = useCallback(() => {
    setDismissed(false);
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(DISMISS_KEY);
    }
  }, []);

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
        setFirestoreHasCurrentDevice(false);
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
      setFirestoreHasCurrentDevice(true);
      setError("");
      resetDismissed();
      return true;
    } catch (e) {
      console.error("[push subscribe]", e);
      setError("Failed to enable push notifications.");
      setSubscribed(false);
      setFirestoreHasCurrentDevice(false);
      return false;
    } finally {
      setBusy(false);
    }
  }, [resetDismissed]);

  const shouldPrompt = useMemo(() => {
    if (!checked) return false;
    if (!supported) return false;
    if (dismissed) return false;

    if (!subscribed) return true;
    if (!firestoreHasCurrentDevice) return true;

    return false;
  }, [checked, supported, dismissed, subscribed, firestoreHasCurrentDevice]);

  return {
    supported,
    subscribed,
    firestoreHasCurrentDevice,
    busy,
    permission,
    error,
    subscribe,
    refresh,
    dismissed,
    dismissPrompt,
    resetDismissed,
    shouldPrompt,
    checked,
  };
}

type PushSubscribeButtonProps = {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  variant?: "button" | "toast";
  title?: string;
  message?: string;
  hideIfDenied?: boolean;
};

export default function PushSubscribeButton({
  className,
  style,
  children,
  variant = "button",
  title = "Turn on notifications",
  message = "Get class reminders, gym updates and weekly booking notifications straight to your device.",
  hideIfDenied = false,
}: PushSubscribeButtonProps) {
  const {
    supported,
    subscribed,
    firestoreHasCurrentDevice,
    busy,
    subscribe,
    permission,
    error,
    shouldPrompt,
    dismissPrompt,
  } = usePushNotifications();

  if (variant === "button") {
    if (!supported || (subscribed && firestoreHasCurrentDevice)) {
      return null;
    }

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

  if (!supported || !shouldPrompt) {
    return null;
  }

  if (hideIfDenied && permission === "denied") {
    return null;
  }

  const missingDeviceRegistration = subscribed && !firestoreHasCurrentDevice;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        bottom: 88,
        zIndex: 1200,
        maxWidth: 460,
        margin: "0 auto",
        borderRadius: 20,
        padding: 14,
        background: "rgba(11,15,20,0.96)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 18px 48px rgba(0,0,0,0.45)",
        color: "#fff",
        ...style,
      }}
      className={className}
    >
      <div className="d-flex align-items-start justify-content-between gap-3">
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
              borderRadius: 999,
              padding: "6px 10px",
              background: "rgba(36,255,160,0.10)",
              border: "1px solid rgba(36,255,160,0.22)",
              color: "#24FFA0",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Iron Acre alerts
          </div>

          <div style={{ fontWeight: 800, fontSize: "1rem", marginBottom: 6 }}>
            {title}
          </div>

          <div
            style={{
              color: "rgba(255,255,255,0.80)",
              fontSize: 14,
              lineHeight: 1.45,
              marginBottom: 12,
            }}
          >
            {permission === "denied"
              ? "Notifications are currently blocked in your browser settings. Enable them there to receive class and gym reminders."
              : missingDeviceRegistration
              ? "This device/browser has permission for notifications, but it is not currently registered in Firestore. Enable again to register this device properly."
              : message}
          </div>

          {!!error && (
            <div
              style={{
                color: "#ffb3b3",
                fontSize: 13,
                lineHeight: 1.45,
                marginBottom: 10,
              }}
            >
              {error}
            </div>
          )}

          <div className="d-flex flex-wrap gap-2">
            {permission !== "denied" ? (
              <button
                type="button"
                onClick={() => {
                  subscribe().catch(() => {});
                }}
                disabled={busy}
                className="ia-btn"
              >
                {busy
                  ? "Enabling..."
                  : missingDeviceRegistration
                  ? "Register this device"
                  : "Enable notifications"}
              </button>
            ) : null}

            <button type="button" onClick={dismissPrompt} className="ia-btn ia-btn-outline">
              Not now
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={dismissPrompt}
          aria-label="Dismiss notification prompt"
          style={{
            width: 34,
            height: 34,
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.04)",
            color: "#fff",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "0 0 auto",
          }}
        >
          <i className="fas fa-times" />
        </button>
      </div>
    </div>
  );
}
