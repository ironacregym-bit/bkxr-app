
// hooks/useWakeLock.ts
"use client";

import { useEffect, useRef } from "react";

export default function useWakeLock(enabled: boolean) {
  const lockRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function requestLock() {
      if (!enabled) return release();
      // @ts-ignore
      const api = (navigator as any).wakeLock;
      if (!api?.request) return;
      try {
        const sentry = await api.request("screen");
        if (cancelled) {
          try { sentry.release(); } catch {}
          return;
        }
        lockRef.current = sentry;
        sentry.addEventListener?.("release", () => {
          // re-request if still enabled and visible
        });
      } catch {
        // ignore
      }
    }

    function release() {
      if (lockRef.current) {
        try { lockRef.current.release(); } catch {}
        lockRef.current = null;
      }
    }

    requestLock();

    const onVis = () => {
      if (document.visibilityState === "visible" && enabled) requestLock();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      release();
    };
  }, [enabled]);
}
